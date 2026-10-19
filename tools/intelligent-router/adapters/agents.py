#!/usr/bin/env python3
"""Explicit Herdr temporary-agent lifecycle. No automatic task fan-out.

Open a visible pane, record ownership, collect results before removing that pane.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
STATE = ROOT / ".state/agents"
ROLES = {"explorer": "economy", "impl": "standard", "reviewer": "advanced"}


def herdr(*args):
    if os.environ.get("HERDR_ENV") != "1":
        raise RuntimeError("Must run inside Herdr")
    completed = subprocess.run(["herdr", *args], capture_output=True, text=True,
                               timeout=65, check=False)
    if completed.returncode:
        # Keep JSON error code for diagnosis, never dump a pane transcript here.
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip())
    return json.loads(completed.stdout)["result"]


def save(path, entry):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = path.with_suffix(".pending")
    temporary.write_text(json.dumps(entry, ensure_ascii=False, indent=2) + "\n")
    temporary.chmod(0o600)
    os.replace(temporary, path)


def open_agent(role, caller, direction, task, worktree=None):
    caller_info = herdr("pane", "get", caller)["pane"]
    if Path(caller_info["cwd"]).resolve() != REPO:
        raise RuntimeError("Caller must belong to this repository")
    cwd = REPO
    if role == "impl":
        if worktree is None:
            raise RuntimeError("A distinct existing worktree is required for an additional writer")
        cwd = worktree.resolve()
        listed = subprocess.run(["git", "worktree", "list", "--porcelain"], cwd=REPO,
                                text=True, capture_output=True, check=True)
        known = {Path(line[len("worktree "):]).resolve() for line in listed.stdout.splitlines()
                 if line.startswith("worktree ")}
        if cwd == REPO or cwd not in known:
            raise RuntimeError("Writer path must be a separate registered Git worktree")
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    config = json.loads((ROOT / "config/policy.json").read_text())
    if sum(json.loads(p.read_text()).get("status") != "closed" for p in STATE.glob("*.json")) >= config["max_agents"]:
        raise RuntimeError("Temporary-agent budget reached; collect existing results first")
    from catalog import discover
    catalog = discover()  # Reject API-key auth; do not load auth.json.
    selection = config["tiers"][ROLES[role]]
    model = next((m for m in catalog["models"] if m["model"] == selection["model"] and not m["hidden"]), None)
    if model is None or selection["effort"] not in {e["reasoningEffort"] for e in model["supportedReasoningEfforts"]}:
        raise RuntimeError("Configured model/effort missing from current Codex catalog")
    live = herdr("agent", "list")["agents"]
    names = {a.get("name") for a in live}
    name = "router-" + role
    index = 1
    while name in names:
        name = "router-" + role + "-" + str(index)
        index += 1
    created = herdr("pane", "split", "--pane", caller, "--direction", direction,
                    "--cwd", str(cwd), "--no-focus")["pane"]
    key = uuid.uuid4().hex
    path = STATE / (key + ".json")
    entry = {"id": key, "pane_id": created["pane_id"], "terminal_id": None,
             "name": name, "role": role, "status": "created", "task": task[:500],
             "cwd": str(cwd), "created_at": time.time(), "codex_tokens": None}
    save(path, entry)  # Preserve even a partial startup for manual recovery.
    try:
        entry["terminal_id"] = herdr("pane", "get", entry["pane_id"])["pane"]["terminal_id"]
        save(path, entry)
        herdr("agent", "start", name, "--kind", "codex", "--pane", entry["pane_id"],
              "--", "-m", selection["model"], "-c", 'model_reasoning_effort="' + selection["effort"] + '"',
              "-s", "workspace-write" if role == "impl" else "read-only")
        entry["status"] = "ready"
        save(path, entry)
    except Exception:
        entry["status"] = "startup_error_preserved"
        save(path, entry)
        raise
    return entry


def finish(path, result_file):
    entry = json.loads(path.read_text())
    if entry["status"] == "closed":
        return entry
    if not entry.get("terminal_id"):
        raise RuntimeError("Missing owned terminal identity; preserve pane for inspection")
    result_file = result_file.resolve()
    if not result_file.is_file() or not result_file.stat().st_size:
        raise RuntimeError("Collect a nonempty result/verification summary file before closing")
    pane = herdr("pane", "get", entry["pane_id"])["pane"]
    agent = herdr("agent", "get", entry["pane_id"])["agent"]
    if (pane["terminal_id"] != entry["terminal_id"] or agent.get("name") != entry["name"] or
            agent.get("agent") != "codex" or agent.get("cwd") != entry["cwd"]):
        raise RuntimeError("Pane/agent ownership changed; do not close")
    if agent.get("agent_status") not in {"idle", "done"}:
        raise RuntimeError("Agent is not settled; preserve working/blocked/unknown/error pane")
    # Lead must verify task completion; a settled lifecycle alone is not task success.
    entry.update({"result_file": str(result_file),
                  "result_sha256": hashlib.sha256(result_file.read_bytes()).hexdigest(),
                  "status": "result_collected"})
    save(path, entry)
    herdr("pane", "close", entry["pane_id"])
    entry["status"] = "closed"
    save(path, entry)
    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    opening = commands.add_parser("open")
    opening.add_argument("--role", required=True, choices=ROLES)
    opening.add_argument("--caller-pane", required=True)
    opening.add_argument("--direction", required=True, choices=["right", "down"])
    opening.add_argument("--task", required=True, help="Short task summary, no secrets")
    opening.add_argument("--worktree", type=Path)
    closing = commands.add_parser("finish", help="Lead verified completion; save result then close owned pane")
    closing.add_argument("id")
    closing.add_argument("--result-file", required=True, type=Path)
    commands.add_parser("list")
    args = parser.parse_args()
    if args.command == "open":
        STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
        with (STATE / "create.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = open_agent(args.role, args.caller_pane, args.direction, args.task, args.worktree)
    elif args.command == "finish":
        if len(args.id) != 32 or any(c not in "0123456789abcdef" for c in args.id):
            parser.error("Invalid owned-agent id")
        result = finish(STATE / (args.id + ".json"), args.result_file)
    else:
        result = [json.loads(p.read_text()) for p in STATE.glob("*.json")]
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
