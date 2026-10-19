"""Regression checks for consequential routing/fallback decisions; no model download."""
import copy
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "routing"))
from policy import recommend


class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.config = json.loads((ROOT / "config/policy.json").read_text())
        questions = json.loads((ROOT / "decision/questions.json").read_text())
        self.raw = {"answers": {key: {"choice": choice, "confidence": 0.95,
                    "probabilities": {option: 1.0 if option == choice else 0.0
                                      for option in questions[key]["criteria"]}}
                               for key, choice in [("task_type", "documentation"),
                                                   ("complexity", "low"), ("risk", "low")]}}

    def test_small_documentation(self):
        self.assertEqual(recommend(self.raw, self.config)["recommended_tier"], "economy")

    def test_invalid_and_missing_outputs_fail_closed(self):
        for raw in [{}, {"answers": {"task_type": {"error": "max_length_exceeded"}}}]:
            result = recommend(raw, self.config)
            self.assertEqual(result["recommended_tier"], "advanced")
            self.assertIsNone(result["confidence"])

    def test_nonfinite_confidence_fails_closed(self):
        raw = copy.deepcopy(self.raw)
        raw["answers"]["risk"]["confidence"] = float("nan")
        self.assertIsNone(recommend(raw, self.config)["confidence"])

    def test_low_confidence_preserved_and_escalated(self):
        self.raw["answers"]["risk"]["confidence"] = 0.42
        result = recommend(self.raw, self.config)
        self.assertEqual(result["confidence"], 0.42)
        self.assertEqual(result["recommended_tier"], "advanced")

    def test_failure_sensitive_scope_and_missing_context_override(self):
        for metadata in [{"previous_failure": True}, {"sensitive_change": True},
                         {"context_incomplete": True}, {"changed_files": 6}, {"module_count": 2}]:
            result = recommend(self.raw, self.config, **metadata)
            self.assertEqual(result["recommended_tier"], "advanced")
            self.assertTrue(result["requires_review"])
            self.assertFalse(result["execution_performed"])


if __name__ == "__main__":
    unittest.main()
