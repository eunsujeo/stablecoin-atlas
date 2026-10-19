"""Lead bridge lifecycle and recursion tests; no GPT turns or live pane changes."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "adapters"))
import lead


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        replacement = patch.object(lead, "STATE", self.folder)
        replacement.start()
        self.addCleanup(replacement.stop)
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


if __name__ == "__main__":
    unittest.main()
