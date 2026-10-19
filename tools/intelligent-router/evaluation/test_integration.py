"""Verify routing failure handling and owned-pane cleanup without GPT or Herdr mutations."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "adapters"))
import request
import agents


class RequestTests(unittest.TestCase):
    def test_no_raw_request_in_log_or_hook_context(self):
        with tempfile.TemporaryDirectory() as temp:
            state = Path(temp)
            value = request.fallback(request.read_config(), "test_unavailable")
            with patch.object(request, "classify", return_value=(value, None)) as classify:
                result = request.handle({"prompt": "PRIVATE_SENTINEL", "session_id": "s", "turn_id": "t"}, state=state)
                repeated = request.handle({"prompt": "PRIVATE_SENTINEL", "session_id": "s", "turn_id": "t"}, state=state)
            self.assertEqual(classify.call_count, 1)
            self.assertEqual(result, repeated)
            self.assertNotIn("PRIVATE_SENTINEL", json.dumps(result))
            self.assertNotIn("PRIVATE_SENTINEL", json.dumps(request.hook_output(result)))
            self.assertIsNone(result["codex_tokens"])
            self.assertFalse(result["model_changed"])

    def test_timeout_returns_conservative_recommendation(self):
        config = request.read_config()
        runtime = json.dumps({"enabled": True, "python": "/unused/python", "model_dir": "/unused/model"})
        with tempfile.TemporaryDirectory() as temp, patch.object(Path, "exists", return_value=True), \
                patch.object(Path, "read_text", return_value=runtime), \
                patch.object(request.subprocess, "run", side_effect=subprocess.TimeoutExpired("local", 25)):
            decision, measurement = request.classify("fix", "", config, Path(temp))
        self.assertEqual(decision["recommended_tier"], "advanced")
        self.assertIsNone(decision["confidence"])
        self.assertIn("local_classifier_unavailable", decision["fallback_reasons"])

    def test_disabled_hook_returns_no_instructions(self):
        with patch.object(Path, "exists", return_value=True), \
                patch.object(Path, "read_text", return_value='{"enabled":false}'), \
                patch.object(request, "read_config", return_value={}):
            self.assertIsNone(request.handle({"prompt": "x"}))
        self.assertEqual(request.hook_output(None), {})


class CleanupTests(unittest.TestCase):
    def run_case(self, status="done", terminal="owned", name="router-explorer", has_result=True):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        folder = Path(temporary.name)
        path, result = folder / "owned.json", folder / "result.txt"
        path.write_text(json.dumps({"status": "ready", "pane_id": "w99:p2", "terminal_id": "owned",
                                   "name": "router-explorer", "cwd": str(agents.REPO)}))
        if has_result:
            result.write_text("Completed read-only task; verification collected.")
        calls = []
        def fake(*args):
            calls.append(args)
            if args[:2] == ("pane", "get"):
                return {"pane": {"terminal_id": terminal}}
            if args[:2] == ("agent", "get"):
                return {"agent": {"name": name, "agent_status": status, "agent": "codex", "cwd": str(agents.REPO)}}
            return {}
        with patch.object(agents, "herdr", side_effect=fake):
            if status not in {"idle", "done"} or terminal != "owned" or name != "router-explorer" or not has_result:
                with self.assertRaises(RuntimeError):
                    agents.finish(path, result)
                self.assertFalse(any(c[:2] == ("pane", "close") for c in calls))
            else:
                self.assertEqual(agents.finish(path, result)["status"], "closed")
                self.assertIn(("pane", "close", "w99:p2"), calls)
                self.assertTrue(result.exists())

    def test_closes_owned_settled_pane_after_result_collection(self):
        self.run_case()

    def test_preserves_working_blocked_unknown_and_missing_results(self):
        for status in ["working", "blocked", "unknown"]:
            self.run_case(status=status)
        self.run_case(has_result=False)

    def test_never_closes_replaced_or_existing_lead(self):
        self.run_case(terminal="replaced")
        self.run_case(name="router-lead")


if __name__ == "__main__":
    unittest.main()
