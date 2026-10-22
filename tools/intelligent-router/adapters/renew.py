#!/usr/bin/env python3
"""Start a fresh Codex conversation (/new) in a named Herdr agent pane.

An agent cannot clear its own conversation, so the coordinator (router-coord) or the
Lead bridge sends /new from outside. Never resends after an uncertain step.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lead  # noqa: E402

CHOOSER = "Where should the new conversation run"
BANNER = "OpenAI Codex"
HANDOFF = lead.REPO / "docs/handoff"
RECORDS = lead.ROOT / ".state/renew"


def wait_output(pane, text, timeout_ms=8000):
    process = subprocess.run(["herdr", "pane", "wait-output", pane, "--match", text,
                              "--source", "visible", "--timeout", str(timeout_ms)],
                             capture_output=True, text=True, timeout=timeout_ms / 1000 + 5)
    return process.returncode == 0


def renew(name):
    """Send /new, accept the current-worktree default, and confirm a fresh idle session."""
    entry = lead.agent(name)
    if entry.get("agent_status") not in {"idle", "done"}:
        raise RuntimeError("agent_not_idle")
    pane = entry["pane_id"]
    lead.herdr("agent", "prompt", name, "/new")
    if not wait_output(pane, CHOOSER):
        raise RuntimeError("renew_uncertain: worktree chooser not shown")
    lead.herdr("agent", "send-keys", name, "enter")
    if not wait_output(pane, BANNER):
        raise RuntimeError("renew_uncertain: new conversation banner not shown")
    entry = lead.agent(name)
    if entry.get("agent_status") not in {"idle", "done"}:
        raise RuntimeError("renew_uncertain: agent not idle after /new")
    return entry


def checked_handoff(name, value):
    path = (lead.REPO / value).resolve()
    if path.parent != HANDOFF or path.name == "README.md" or not path.is_file():
        raise ValueError("Handoff must be an existing docs/handoff/<file>.md")
    record = RECORDS / (name + ".json")
    if record.exists() and path.stat().st_mtime <= json.loads(record.read_text())["renewed_at"]:
        raise ValueError("Handoff is not newer than the last renewal")
    return path.relative_to(lead.REPO)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("agent", choices=["router-impl", "router-lead"])
    parser.add_argument("--handoff", help="docs/handoff/<file>.md (required for router-impl)")
    args = parser.parse_args()
    if args.agent == "router-lead":
        # Lead keeps no task state; lead.py pump renews it before each request.
        with (lead.STATE / "dispatch.lock").open("a") as lock:
            lead.fcntl.flock(lock, lead.fcntl.LOCK_EX | lead.fcntl.LOCK_NB)
            if any(row["state"] in {"dispatching", "delivered", "delivery_uncertain"}
                   for row in lead.entries()):
                raise SystemExit("Lead has an open request; not renewing")
            renew(args.agent)
        print(json.dumps({"agent": args.agent, "state": "renewed"}))
        return
    if not args.handoff:
        raise SystemExit("--handoff docs/handoff/<file>.md is required for router-impl")
    handoff = checked_handoff(args.agent, args.handoff)
    renew(args.agent)
    lead.write(RECORDS / (args.agent + ".json"), {"handoff": str(handoff), "renewed_at": time.time()})
    lead.herdr("agent", "prompt", args.agent,
               f"새 대화입니다. 인계문 {handoff}을 읽고 '다음 행동'부터 이어서 진행하세요. "
               "AGENTS.md 규칙을 따릅니다.")
    print(json.dumps({"agent": args.agent, "state": "renewed", "handoff": str(handoff)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
