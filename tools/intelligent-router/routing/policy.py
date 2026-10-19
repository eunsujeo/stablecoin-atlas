"""Pure, conservative adapter. No LLM calls or process execution."""
import math


def recommend(raw, config, *, previous_failure=False, sensitive_change=False,
              context_incomplete=False, changed_files=None, module_count=None):
    answers = raw.get("answers", {})
    choices, confidences = {}, []
    valid = {"task_type": {"documentation", "exploration", "bug_fix", "implementation",
                           "debugging", "architecture", "test_execution"},
             "complexity": {"low", "medium", "high"}, "risk": {"low", "medium", "high"}}
    for field, allowed in valid.items():
        answer = answers.get(field, {})
        choice, confidence = answer.get("choice"), answer.get("confidence")
        probabilities = answer.get("probabilities", {})
        if (answer.get("error") or choice not in allowed or
                isinstance(confidence, bool) or not isinstance(confidence, (float, int)) or
                not math.isfinite(confidence) or not 0 <= confidence <= 1 or
                not isinstance(probabilities, dict) or set(probabilities) != allowed or
                any(isinstance(p, bool) or not isinstance(p, (int, float)) or
                    not math.isfinite(p) or not 0 <= p <= 1 for p in probabilities.values()) or
                abs(sum(probabilities.values()) - 1) > 0.01):
            choices[field] = "unknown"
        else:
            choices[field] = choice
            confidences.append(confidence)
    # Copy the lowest native confidence; this is not a calibrated task-success probability.
    confidence = min(confidences) if len(confidences) == 3 else None
    uncertain = confidence is None or confidence < config["decision"]["confidence_threshold"]
    reasons = []
    for flag, reason in [(uncertain, "uncertain_decision"),
                         (previous_failure, "previous_failure"),
                         (sensitive_change, "explicit_security_financial_or_concurrency_change"),
                         (context_incomplete, "incomplete_context"),
                         (changed_files is not None and changed_files > 5, "wide_change"),
                         (module_count is not None and module_count > 1, "cross_module_change")]:
        if flag:
            reasons.append(reason)
    if sensitive_change:
        choices["risk"] = "high"
    high = (reasons or choices["risk"] == "high" or choices["complexity"] == "high" or
            choices["task_type"] in {"architecture", "debugging"})
    tool_only = (not high and choices["task_type"] == "test_execution" and
                 choices["complexity"] == "low" and choices["risk"] == "low")
    tier = (None if tool_only else config["fallback_tier"] if high else
            "economy" if choices["task_type"] in {"documentation", "exploration"} and
            choices["complexity"] == "low" and choices["risk"] == "low" else "standard")
    selection = config["tiers"][tier] if tier else None
    return {**choices, "recommended_tier": tier,
            "reasoning_effort": selection["effort"] if selection else None,
            "confidence": confidence, "requires_review": bool(high),
            "selected_model": selection["model"] if selection else None,
            "confidence_source": "minimum_native_answer_confidence" if confidence is not None else None,
            "fallback_reasons": reasons, "tool_only": tool_only,
            "mode": "shadow", "execution_performed": False}
