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
            self.assertEqual(lead.pump(), "preparation_failed")
            self.assertEqual(lead.pump(), "awaiting_response")
            send.assert_not_called()
            self.renew_lead.assert_called_once()
        row = json.loads(lead.path_for(self.row["id"]).read_text())
        self.assertEqual(row["failure"]["phase"], "preparation")
        self.assertEqual(row["dispatch_phase"], "preparation")

    def test_uncertain_delivery_is_not_retried(self):
        with patch.object(lead, "agent", return_value={"agent_status": "done"}), \
                patch.object(lead, "herdr", side_effect=RuntimeError("timeout")) as send:
            self.assertEqual(lead.pump(), "delivery_uncertain")
            self.assertEqual(lead.pump(), "awaiting_response")
            self.assertEqual(send.call_count, 1)
        row = json.loads(lead.path_for(self.row["id"]).read_text())
        self.assertEqual(row["failure"]["phase"], "prompt")
        self.assertEqual(row["dispatch_phase"], "prompt")

    def test_cancel_stale_request_unblocks_next_without_resending(self):
        self.row["state"] = "delivery_uncertain"
        lead.write(lead.path_for(self.row["id"]), self.row)
        next_row = dict(self.row, id="b" * 32, state="pending", created_at=2)
        lead.write(lead.path_for(next_row["id"]), next_row)
        with patch.object(lead, "agent", return_value={"agent_status": "idle", "pane_id": "w1:p2"}), \
                patch.object(lead, "herdr") as send, patch.object(lead, "start_watcher") as watcher:
            row = lead.cancel(self.row["id"], "Pane inspected; obsolete review closed explicitly")
            watcher.assert_called_once()
            send.assert_not_called()
            self.assertEqual(row["state"], "cancelled")
            self.assertIsNone(row["response"])
            self.assertEqual(row["cancellation"]["previous_state"], "delivery_uncertain")
            with self.assertRaises(ValueError):
                lead.record_response(self.row["id"], {"action": "proceed", "summary": "late reply"})
            self.assertEqual(lead.pump(), "delivered")
            self.assertIn(next_row["id"], send.call_args.args[3])
            self.assertNotIn(self.row["id"], send.call_args.args[3])

    def test_cancel_restarts_stopped_watcher_and_delivers_existing_pending_once(self):
        self.row["state"] = "delivery_uncertain"
        lead.write(lead.path_for(self.row["id"]), self.row)
        queued = dict(self.row, id="c" * 32, state="pending", created_at=2)
        lead.write(lead.path_for(queued["id"]), queued)
        lead.watch()  # The earlier delivery error has already stopped the dispatcher.
        with patch.object(lead, "agent", return_value={"agent_status": "idle"}), \
                patch.object(lead, "herdr") as send, \
                patch.object(lead, "start_watcher", side_effect=lead.watch) as watcher:
            lead.cancel(self.row["id"], "Pane inspected; obsolete review")
            watcher.assert_called_once()
            self.assertEqual(send.call_count, 1)
            self.assertIn(queued["id"], send.call_args.args[3])
            self.assertNotIn(self.row["id"], send.call_args.args[3])
            self.assertEqual(lead.pump(), "awaiting_response")
        self.assertEqual(json.loads(lead.path_for(queued["id"]).read_text())["state"], "delivered")

    def test_cancellation_refuses_working_blocked_unknown_and_answered(self):
        for status in ["working", "blocked", "unknown"]:
            with patch.object(lead, "agent", return_value={"agent_status": status}):
                with self.assertRaises(RuntimeError):
                    lead.cancel(self.row["id"], "obsolete")
            self.assertEqual(json.loads(lead.path_for(self.row["id"]).read_text())["state"], "pending")
        lead.record_response(self.row["id"], {"action": "proceed", "summary": "reviewed"})
        with self.assertRaises(ValueError):
            lead.cancel(self.row["id"], "obsolete")

    def test_dispatch_lock_prevents_concurrent_send(self):
        import fcntl
        with (self.folder / "dispatch.lock").open("a") as lock, patch.object(lead, "herdr") as send:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertEqual(lead.pump(), "dispatcher_busy")
            send.assert_not_called()

    def test_watcher_exposes_sanitized_failure_and_stops(self):
        with patch.object(lead, "pump", side_effect=RuntimeError("token=SECRET https://private.test")):
            lead.watch()
        value = json.loads((self.folder / "watcher-status.json").read_text())
        self.assertEqual(value["phase"], "pump")
        self.assertNotIn("SECRET", json.dumps(value))

    def test_herdr_diagnostic_keeps_only_structured_error_code(self):
        import subprocess
        process = subprocess.CompletedProcess([], 1, "", json.dumps({
            "error": {"code": "agent_not_ready", "message": "token=SECRET https://private.test"}}))
        with patch.dict(lead.os.environ, {"HERDR_ENV": "1"}), \
                patch.object(lead.subprocess, "run", return_value=process):
            with self.assertRaises(lead.HerdrError) as caught:
                lead.herdr("agent", "prompt", "router-lead", "private message")
        diagnostic = lead.failure(caught.exception, "prompt")
        self.assertEqual(diagnostic["code"], "agent_not_ready")
        self.assertEqual(diagnostic["returncode"], 1)
        self.assertNotIn("SECRET", json.dumps(diagnostic))
        self.assertNotIn("private", str(caught.exception))

    def test_preparation_failure_blocks_session_renewal_until_cancelled(self):
        self.row["state"] = "preparation_failed"
        lead.write(lead.path_for(self.row["id"]), self.row)
        self.assertTrue(renew.open_lead_request("router-impl"))
        with patch.object(lead, "agent", return_value={"agent_status": "idle"}), \
                patch.object(lead, "start_watcher"):
            lead.cancel(self.row["id"], "Pane inspected; obsolete preparation")
        self.assertFalse(renew.open_lead_request("router-impl"))

    def test_watcher_stops_on_old_uncertain_blocker(self):
        blocker = dict(self.row, id="b" * 32, state="delivery_uncertain")
        lead.write(lead.path_for(blocker["id"]), blocker)
        with patch.object(lead.time, "sleep") as sleep:
            lead.watch()
            sleep.assert_not_called()

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
                patch.object(renew, "wait_output", return_value=True) as seen, \
                patch.object(renew, "ready_for_input", return_value=True), \
                patch.object(renew.subprocess, "run") as settled:
            renew.renew("router-lead")
        self.assertEqual(settled.call_args.args[0][:4], ["herdr", "agent", "wait", "router-lead"])
        self.assertEqual([c.args for c in send.call_args_list],
                         [("agent", "prompt", "router-lead", "/new"), ("agent", "send-keys", "router-lead", "enter")])
        self.assertEqual([c.args[1] for c in seen.call_args_list], [renew.CHOOSER])

    def test_stale_banner_with_open_chooser_is_not_ready(self):
        chooser = "OpenAI Codex\n" + renew.CHOOSER + "\n\u203a 1. Use current Git worktree"
        fresh = "OpenAI Codex\n\u203a " + renew.EMPTY_INPUT
        clock = [0.0]
        def step(seconds):
            clock[0] += seconds
        with patch.object(renew, "screen", return_value=chooser):
            self.assertFalse(renew.ready_for_input("router-lead", now=lambda: clock[0], sleep=step))
        with patch.object(renew, "screen", side_effect=[chooser, fresh]):
            self.assertTrue(renew.ready_for_input("router-lead", now=lambda: clock[0], sleep=step))

    def test_working_agent_is_not_renewed(self):
        with patch.object(lead, "agent", return_value={"agent_status": "working", "pane_id": "w0:p0"}), \
                patch.object(lead, "herdr") as send:
            self.assertRaises(RuntimeError, renew.renew, "router-impl")
        send.assert_not_called()

    def test_missing_chooser_and_unready_input_stops_without_enter(self):
        with patch.object(lead, "agent", return_value=self.idle), patch.object(lead, "herdr") as send, \
                patch.object(renew, "wait_output", return_value=False), \
                patch.object(renew, "ready_for_input", return_value=False):
            self.assertRaises(RuntimeError, renew.renew, "router-impl")
        self.assertEqual(send.call_count, 1)



class ScheduledRenewTests(unittest.TestCase):
    IDLE = renew.GRACE_SECONDS // renew.POLL_SECONDS + 1
    CLEAN = "Done.\n\u203a Ask Codex to do anything\n  ? for shortcuts"

    def run_watch(self, statuses, screens=None, open_request=False, awaits_nothing=False):
        clock = [0.0]
        states = iter(statuses)
        screens = list(screens or [self.CLEAN])
        def shown_next():  # Repeat the last screen once the scripted ones run out.
            return screens.pop(0) if len(screens) > 1 else screens[0]
        def step(_):
            clock[0] += renew.POLL_SECONDS
        def entry(name):
            value = next(states)
            status, seq = value if isinstance(value, tuple) else (value, 1)
            return {"agent_status": status, "state_change_seq": seq}
        with patch.object(lead, "agent", side_effect=entry), \
                patch.object(renew, "screen", side_effect=lambda name: shown_next()), \
                patch.object(renew, "open_lead_request", return_value=open_request), \
                patch.object(renew, "renew_with_handoff") as renewed:
            result = renew.wait_and_renew("router-impl", "docs/handoff/x.md", awaits_nothing=awaits_nothing,
                                          now=lambda: clock[0], sleep=step)
        return result, renewed

    def test_renews_after_grace_once_turn_has_ended(self):
        result, renewed = self.run_watch(["working", "working"] + ["idle"] * self.IDLE)
        self.assertEqual(result, "renewed")
        renewed.assert_called_once_with("router-impl", "docs/handoff/x.md", wait=False)

    def test_handoff_needing_user_renews_into_a_waiting_session(self):
        clock = [0.0]
        with patch.object(lead, "agent", return_value={"agent_status": "idle", "state_change_seq": 1}), \
                patch.object(renew, "screen", return_value=self.CLEAN), \
                patch.object(renew, "open_lead_request", return_value=False), \
                patch.object(renew, "renew_with_handoff") as renewed:
            result = renew.wait_and_renew("router-impl", "docs/handoff/x.md", wait=True,
                                          now=lambda: clock[0], sleep=lambda s: clock.__setitem__(0, clock[0] + s))
        self.assertEqual(result, "renewed_waiting")
        renewed.assert_called_once_with("router-impl", "docs/handoff/x.md", wait=True)

    def test_renewed_session_is_told_to_continue_next_action(self):
        with patch.object(renew, "renew"), patch.object(lead, "herdr") as send, patch.object(lead, "write"):
            renew.renew_with_handoff("router-impl", "docs/handoff/x.md")
        self.assertIn("'다음 행동'부터 이어서 진행", send.call_args.args[3])

    def test_waiting_session_is_told_not_to_start_work(self):
        with patch.object(renew, "renew"), patch.object(lead, "herdr") as send, patch.object(lead, "write"):
            renew.renew_with_handoff("router-impl", "docs/handoff/x.md", wait=True)
        text = send.call_args.args[3]
        self.assertIn("시작하지 말고", text)
        self.assertNotIn("이어서 진행", text)

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

    def test_service_terminals_do_not_block_when_handoff_awaits_nothing(self):
        busy = "Done.\n  4 background terminals running\n\u203a Ask Codex to do anything"
        result, renewed = self.run_watch(["idle"] * self.IDLE, screens=[busy], awaits_nothing=True)
        self.assertEqual(result, "renewed")
        renewed.assert_called_once()

    def test_awaited_background_never_renews_until_done(self):
        busy = "Done.\n  4 background terminals running\n\u203a Ask Codex to do anything"
        result, renewed = self.run_watch(["idle"] * (renew.DEADLINE_SECONDS // renew.POLL_SECONDS + 1),
                                         screens=[busy])
        self.assertEqual(result, "expired")
        renewed.assert_not_called()

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
        pushed = patch.object(renew, "unpushed_commits", return_value=0)
        self.unpushed = pushed.start()
        self.addCleanup(pushed.stop)

    def handoff(self, confirm="아니오", drop=None):
        lines = [f"- {field}: x" for field in renew.HANDOFF_FIELDS if field not in ("사용자 확인 필요", drop)]
        lines.append(f"- 사용자 확인 필요: {confirm}")
        path = self.folder / "docs/handoff/2026-01-01-x.md"
        path.write_text("# x\n" + "\n".join(lines) + "\n")
        return "docs/handoff/2026-01-01-x.md"

    def test_missing_field_is_rejected(self):
        self.assertRaises(ValueError, renew.schedule, "router-impl", self.handoff(drop="기다리는 것"))

    def test_user_confirmation_is_still_scheduled(self):
        with patch.object(renew.subprocess, "Popen") as spawn:
            renew.schedule("router-impl", self.handoff(confirm="예 — 원격 DB 접속"))
        spawn.assert_called_once()

    def test_waiting_renewal_counts_daily_and_ends_the_chain(self):
        renew.remember("router-impl", "renewed")
        renew.remember("router-impl", "renewed_waiting")
        value = renew.history("router-impl")
        self.assertEqual((len(value["renewals"]), value["chain"]), (2, 0))

    def test_chain_limit_stops_until_a_human_continues(self):
        for _ in range(renew.CHAIN_LIMIT):
            renew.remember("router-impl", "renewed")
        with patch.object(renew.subprocess, "Popen") as spawn, patch.object(renew, "notify") as notice:
            self.assertRaises(ValueError, renew.schedule, "router-impl", self.handoff())
        spawn.assert_not_called()
        notice.assert_called_once_with("router-impl", "stopped_chain_limit")
        renew.remember("router-impl", "cancelled_user_continued")
        self.assertIsNone(renew.limit_reason("router-impl"))

    def test_daily_limit_stops_and_notifies_until_reset(self):
        for _ in range(renew.DAILY_LIMIT):
            renew.remember("router-impl", "renewed")
        with patch.object(renew.subprocess, "Popen") as spawn, patch.object(renew, "notify") as notice:
            self.assertRaises(ValueError, renew.schedule, "router-impl", self.handoff())
        spawn.assert_not_called()
        notice.assert_called_once_with("router-impl", "stopped_daily_limit")
        renew.reset_limit("router-impl")
        self.assertIsNone(renew.limit_reason("router-impl"))

    def test_unpushed_work_is_not_scheduled(self):
        self.unpushed.return_value = 2
        with patch.object(renew.subprocess, "Popen") as spawn:
            self.assertRaises(ValueError, renew.schedule, "router-impl", self.handoff())
        spawn.assert_not_called()

    def test_valid_handoff_spawns_one_watcher(self):
        with patch.object(renew.subprocess, "Popen") as spawn:
            renew.schedule("router-impl", self.handoff())
        spawn.assert_called_once()


if __name__ == "__main__":
    unittest.main()
