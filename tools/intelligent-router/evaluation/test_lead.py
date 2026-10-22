"""Lead bridge lifecycle and recursion tests; no GPT turns or live pane changes."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "adapters"))
import lead
import renew


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        replacement = patch.object(lead, "STATE", self.folder)
        replacement.start()
        self.addCleanup(replacement.stop)
        renewal = patch.object(lead, "renew_lead")
        self.renew_lead = renewal.start()
        self.addCleanup(renewal.stop)
        self.row = {"id": "a" * 32, "created_at": 1, "state": "pending", "source": "router-impl",
                    "summary": "Review transaction ordering", "reason": "concurrency", "response": None}
        lead.write(lead.path_for(self.row["id"]), self.row)

    def test_busy_lead_queues_without_prompt(self):
        with patch.object(lead, "agent", return_value={"agent_status": "working"}), patch.object(lead, "herdr") as send:
            self.assertEqual(lead.pump(), "lead_busy")
            send.assert_not_called()
        self.assertEqual(json.loads(lead.path_for(self.row["id"]).read_text())["state"], "pending")

    def test_settled_lead_gets_one_prompt_without_wait(self):
        with patch.object(lead, "agent", return_value={"agent_status": "idle"}), patch.object(lead, "herdr") as send:
            self.assertEqual(lead.pump(), "delivered")
            self.assertEqual(lead.pump(), "awaiting_response")
            self.assertEqual(send.call_count, 1)
            args = send.call_args.args
            self.assertEqual(args[:3], ("agent", "prompt", "router-lead"))
            self.assertNotIn("--wait", args)
            self.assertIn(self.row["id"], args[3])
            self.renew_lead.assert_called_once()

    def test_failed_lead_renewal_sends_no_notice_and_is_not_retried(self):
        self.renew_lead.side_effect = RuntimeError("renew_uncertain")
        with patch.object(lead, "agent", return_value={"agent_status": "idle"}), patch.object(lead, "herdr") as send:
            self.assertEqual(lead.pump(), "delivery_uncertain")
            self.assertEqual(lead.pump(), "awaiting_response")
            send.assert_not_called()
            self.renew_lead.assert_called_once()

    def test_uncertain_delivery_is_not_retried(self):
        with patch.object(lead, "agent", return_value={"agent_status": "done"}), \
                patch.object(lead, "herdr", side_effect=RuntimeError("timeout")) as send:
            self.assertEqual(lead.pump(), "delivery_uncertain")
            self.assertEqual(lead.pump(), "awaiting_response")
            self.assertEqual(send.call_count, 1)

    def test_response_is_correlated_and_cannot_be_overwritten(self):
        with patch.object(lead, "start_watcher"):
            result = lead.respond(self.row["id"], {"action": "revise_plan", "summary": "Serialize snapshot/revert"})
            self.assertEqual(result["state"], "answered")
            self.assertEqual(result["id"], self.row["id"])
            with self.assertRaises(ValueError):
                lead.respond(self.row["id"], {"action": "proceed", "summary": "overwrite"})

    def test_invalid_id_response_and_self_consultation_rejected(self):
        with self.assertRaises(ValueError):
            lead.path_for("../../somewhere")
        with self.assertRaises(ValueError):
            lead.record_response(self.row["id"], {"action": "execute", "summary": "wrong"})
        with self.assertRaises(ValueError):
            lead.submit("recursive", "debugging", source="router-lead")

    def test_secret_file_paths_rejected_and_urls_redacted(self):
        with patch.object(lead, "agent"):
            with self.assertRaises(ValueError):
                lead.submit("review", "security", files=[".env.local"])
        text = lead.clean_summary("see https://example.test/secret token=PRIVATE")
        self.assertNotIn("example.test", text)
        self.assertNotIn("PRIVATE", text)

    def test_bridge_notice_bypasses_classification(self):
        import request
        with patch.object(request, "classify") as classify:
            self.assertIsNone(request.handle({"prompt": lead.NOTICE + self.row["id"] + "]"}))
            classify.assert_not_called()



class RenewTests(unittest.TestCase):
    idle = {"agent_status": "idle", "pane_id": "w0:p0"}

    def test_new_then_accepts_current_worktree(self):
        with patch.object(lead, "agent", return_value=self.idle), patch.object(lead, "herdr") as send, \
                patch.object(renew, "wait_output", return_value=True) as seen:
            renew.renew("router-lead")
        self.assertEqual([c.args for c in send.call_args_list],
                         [("agent", "prompt", "router-lead", "/new"), ("agent", "send-keys", "router-lead", "enter")])
        self.assertEqual([c.args[1] for c in seen.call_args_list], [renew.CHOOSER, renew.BANNER])

    def test_working_agent_is_not_renewed(self):
        with patch.object(lead, "agent", return_value={"agent_status": "working", "pane_id": "w0:p0"}), \
                patch.object(lead, "herdr") as send:
            self.assertRaises(RuntimeError, renew.renew, "router-impl")
        send.assert_not_called()

    def test_missing_chooser_stops_without_enter(self):
        with patch.object(lead, "agent", return_value=self.idle), patch.object(lead, "herdr") as send, \
                patch.object(renew, "wait_output", return_value=False):
            self.assertRaises(RuntimeError, renew.renew, "router-impl")
        self.assertEqual(send.call_count, 1)



class ScheduledRenewTests(unittest.TestCase):
    IDLE = renew.GRACE_SECONDS // renew.POLL_SECONDS + 1
    CLEAN = "Done.\n\u203a Ask Codex to do anything\n  ? for shortcuts"

    def run_watch(self, statuses, screens=None, open_request=False):
        clock = [0.0]
        states = iter(statuses)
        shown = iter(screens or [self.CLEAN] * 50)
        def step(_):
            clock[0] += renew.POLL_SECONDS
        def entry(name):
            value = next(states)
            status, seq = value if isinstance(value, tuple) else (value, 1)
            return {"agent_status": status, "state_change_seq": seq}
        with patch.object(lead, "agent", side_effect=entry), \
                patch.object(renew, "screen", side_effect=lambda name: next(shown)), \
                patch.object(renew, "open_lead_request", return_value=open_request), \
                patch.object(renew, "renew_with_handoff") as renewed:
            result = renew.wait_and_renew("router-impl", "docs/handoff/x.md", now=lambda: clock[0], sleep=step)
        return result, renewed

    def test_renews_after_grace_once_turn_has_ended(self):
        result, renewed = self.run_watch(["working", "working"] + ["idle"] * self.IDLE)
        self.assertEqual(result, "renewed")
        renewed.assert_called_once_with("router-impl", "docs/handoff/x.md")

    def test_user_continuing_during_grace_cancels(self):
        result, renewed = self.run_watch(["working", "idle", "idle", "working"])
        self.assertEqual(result, "cancelled_user_continued")
        renewed.assert_not_called()

    def test_short_turn_from_another_session_between_polls_cancels(self):
        result, renewed = self.run_watch(["working", ("idle", 1), ("idle", 1), ("idle", 2)])
        self.assertEqual(result, "cancelled_user_continued")
        renewed.assert_not_called()

    def test_blocked_ui_cancels(self):
        result, renewed = self.run_watch(["working", "idle", "blocked"])
        self.assertEqual(result, "cancelled_blocked")
        renewed.assert_not_called()

    def test_typed_but_unsent_input_cancels(self):
        result, renewed = self.run_watch(["idle"] * self.IDLE, screens=["Done.\n\u203a 이거 왜"])
        self.assertEqual(result, "cancelled_input_pending")
        renewed.assert_not_called()

    def test_final_question_cancels(self):
        question = "어느 쪽으로 할까요?\n\u203a Ask Codex to do anything\n  ? for shortcuts"
        result, renewed = self.run_watch(["idle"] * self.IDLE, screens=[question])
        self.assertEqual(result, "cancelled_question")
        renewed.assert_not_called()

    def test_background_terminal_restarts_grace_until_finished(self):
        busy = "Done.\n  1 background terminal running\n\u203a Ask Codex to do anything"
        result, renewed = self.run_watch(["idle"] * (self.IDLE * 2 + 1), screens=[busy, self.CLEAN])
        self.assertEqual(result, "renewed")
        renewed.assert_called_once()

    def test_open_lead_request_never_renews(self):
        result, renewed = self.run_watch(["idle"] * (renew.DEADLINE_SECONDS // renew.POLL_SECONDS + 1),
                                         open_request=True)
        self.assertEqual(result, "expired")
        renewed.assert_not_called()

    def test_turn_that_never_ends_expires(self):
        result, renewed = self.run_watch(["working"] * (renew.DEADLINE_SECONDS // renew.POLL_SECONDS + 1))
        self.assertEqual(result, "expired")
        renewed.assert_not_called()


class ScheduleGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        folder = Path(self.temp.name).resolve()
        (folder / "docs/handoff").mkdir(parents=True)
        for target, value in ((renew.lead, "REPO"), (renew, "HANDOFF"), (renew, "RECORDS")):
            path = {"REPO": folder, "HANDOFF": folder / "docs/handoff", "RECORDS": folder / "state"}[value]
            replacement = patch.object(target, value, path)
            replacement.start()
            self.addCleanup(replacement.stop)
        self.folder = folder

    def handoff(self, confirm="아니오", drop=None):
        lines = [f"- {field}: x" for field in renew.HANDOFF_FIELDS if field not in ("사용자 확인 필요", drop)]
        lines.append(f"- 사용자 확인 필요: {confirm}")
        path = self.folder / "docs/handoff/2026-01-01-x.md"
        path.write_text("# x\n" + "\n".join(lines) + "\n")
        return "docs/handoff/2026-01-01-x.md"

    def test_missing_field_is_rejected(self):
        self.assertRaises(ValueError, renew.schedule, "router-impl", self.handoff(drop="기다리는 것"))

    def test_user_confirmation_is_not_scheduled(self):
        with patch.object(renew.subprocess, "Popen") as spawn:
            self.assertRaises(ValueError, renew.schedule, "router-impl", self.handoff(confirm="예 — 원격 DB 접속"))
        spawn.assert_not_called()

    def test_chain_limit_stops_and_notifies(self):
        for _ in range(renew.CHAIN_LIMIT):
            renew.remember("router-impl", "renewed")
        with patch.object(renew.subprocess, "Popen") as spawn, patch.object(renew, "notify") as notice:
            self.assertRaises(ValueError, renew.schedule, "router-impl", self.handoff())
        spawn.assert_not_called()
        notice.assert_called_once_with("router-impl", "stopped_chain_limit")
        renew.remember("router-impl", "cancelled_user_continued")
        self.assertIsNone(renew.limit_reason("router-impl"))

    def test_valid_handoff_spawns_one_watcher(self):
        with patch.object(renew.subprocess, "Popen") as spawn:
            renew.schedule("router-impl", self.handoff())
        spawn.assert_called_once()


if __name__ == "__main__":
    unittest.main()
