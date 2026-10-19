#!/usr/bin/env python3
"""Automatic local routing requests, usable as a Codex hook or stdin CLI.

Never calls GPT, changes a model, sends another agent a prompt or resets a chat.
"""
import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
sys.path.insert(0, str(ROOT / "routing"))
from policy import recommend


def read_config():
    return json.loads((ROOT / "config/policy.json").read_text())


def fallback(config, reason):
    result = recommend({}, config, context_incomplete=True)
    result["fallback_reasons"].append(reason)
    return result


@contextmanager
def inference_lock(state):
    state.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (state / "inference.lock").open("a") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def classify(prompt, context, config, state):
    if not isinstance(prompt, str) or not prompt.strip():
        return fallback(config, "missing_request"), None
    runtime_file = ROOT / "config/runtime.local.json"
    if not runtime_file.exists():
        return fallback(config, "local_runtime_not_configured"), None
    runtime = json.loads(runtime_file.read_text())
    if not runtime.get("enabled", True):
        return None, "disabled"
    try:
        with inference_lock(state), tempfile.TemporaryDirectory(prefix="router-request-") as temp:
            temporary = Path(temp)
            case = {"id": "request", "request": prompt, "context": context,
                    "context_incomplete": not bool(context.strip())}
            inputs, output = temporary / "input.json", temporary / "output.json"
            inputs.write_text(json.dumps([case], ensure_ascii=False))
            inputs.chmod(0o600)
            subprocess.run([runtime["python"], str(ROOT / "decision/poc.py"),
                            "--model-dir", runtime["model_dir"], "--device", runtime.get("device", "mps"),
                            "--cases", str(inputs), "--output", str(output)],
                           cwd=REPO, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=25, check=True)
            record = json.loads(output.read_text())["records"][0]
            return record["decision"], {k: record[k] for k in
                    ["raw", "error", "wall_seconds", "cpu_seconds", "max_rss_bytes", "codex_tokens"]}
    except BlockingIOError:
        return fallback(config, "local_classifier_busy"), None
    except (OSError, KeyError, ValueError, subprocess.SubprocessError):
        return fallback(config, "local_classifier_unavailable"), None


def handle(payload, *, context="", state=None):
    config = read_config()
    state = state or ROOT / ".state"
    runtime_file = ROOT / "config/runtime.local.json"
    if runtime_file.exists() and not json.loads(runtime_file.read_text()).get("enabled", True):
        return None
    if payload.get("hook_event_name", "UserPromptSubmit") != "UserPromptSubmit":
        return None
    # Bridge delivery is an existing routing request, never a fresh user task.
    if str(payload.get("prompt", "")).startswith("[ROUTER_LEAD_REQUEST "):
        return None
    # A stable turn ID prevents a manual fallback call from repeating an already-run hook.
    session, turn = payload.get("session_id", "manual"), payload.get("turn_id") or uuid.uuid4().hex
    key = hashlib.sha256((str(session) + ":" + str(turn)).encode()).hexdigest()
    routes = state / "routes"
    routes.mkdir(mode=0o700, parents=True, exist_ok=True)
    saved = routes / (key + ".json")
    if saved.exists():
        return json.loads(saved.read_text())
    started = time.monotonic()
    decision, measurement = classify(payload.get("prompt"), context, config, state)
    if decision is None:
        return None
    result = {"request_id": key, "decision": decision, "measurement": measurement,
              "adapter_wall_seconds": time.monotonic() - started,
              "model_changed": False, "agent_spawned": False, "codex_tokens": None}
    # Do not persist prompts, code, session IDs, paths, environment or conversation history.
    with tempfile.NamedTemporaryFile(mode="w", dir=routes, delete=False) as handle:
        json.dump(result, handle, ensure_ascii=False)
        pending = Path(handle.name)
    os.replace(pending, saved)
    return result


def hook_output(result):
    if result is None:
        return {}
    decision = result["decision"]
    # Only fixed model/config fields and validated decisions reach developer context.
    selection = {k: decision[k] for k in ["task_type", "complexity", "risk", "selected_model",
                                        "reasoning_effort", "confidence", "requires_review"]}
    context = ("Local Router recommendation (shadow; current model unchanged): " +
               json.dumps(selection, ensure_ascii=False) +
               ". Do not request routing again for this turn. Prefer rg and targeted tools. "
               "If targeted investigation confirms complex debugging, architecture, financial/security "
               "or concurrency risk, or a previous failed attempt, submit one short non-secret "
               "summary via adapters/lead.py submit under tools/intelligent-router. Read the "
               "response with lead.py result <id>. Do not escalate solely for low confidence. "
               "Use tests directly for test-only work. Spawn Herdr agents only for necessary "
               "independent work; collect results then close only owned temporary panes. "
               "After a completed and verified task, save a concise handoff before /new; "
               "never reset a working/blocked task or send /new as an LLM prompt.")
    return {"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": context}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hook", action="store_true")
    parser.add_argument("--context-file", type=Path,
                        help="Explicit short non-secret excerpt, never an entire transcript")
    args = parser.parse_args()
    try:
        incoming = sys.stdin.read(65537)
        if len(incoming) > 65536:
            raise ValueError("input too large")
        payload = json.loads(incoming) if args.hook else {"prompt": incoming}
        if not isinstance(payload, dict):
            raise ValueError("expected hook object")
        context = args.context_file.read_text() if args.context_file else ""
        result = handle(payload, context=context)
        print(json.dumps(hook_output(result) if args.hook else result, ensure_ascii=False))
    except (OSError, ValueError, KeyError, TypeError):
        result = {"decision": fallback(read_config(), "adapter_input_or_state_error")}
        print(json.dumps(hook_output(result) if args.hook else result, ensure_ascii=False))


if __name__ == "__main__":
    main()
