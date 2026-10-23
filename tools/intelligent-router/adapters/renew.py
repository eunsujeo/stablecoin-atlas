#!/usr/bin/env python3
"""Start a fresh Codex conversation (/new) in a named Herdr agent pane.

An agent cannot clear its own conversation. router-impl schedules its own renewal as the
last step of a task; a detached watcher sends /new after the turn ends and the pane stays
idle for a grace period. The Lead bridge renews router-lead per request. Never resends
after an uncertain step.
"""
import argparse
import fcntl
import os
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
EMPTY_INPUT = "Ask Codex to do anything"
GRACE_SECONDS = 5
DEADLINE_SECONDS = 3600
POLL_SECONDS = 1
DAILY_LIMIT = 6
CHAIN_LIMIT = 3
BACKGROUND = "background terminal"
HANDOFF_FIELDS = ("목표", "끝난 것", "변경 파일", "검증", "기다리는 것", "다음 행동", "사용자 확인 필요", "읽을 파일")
HANDOFF_MAX_CHARS = 3000


def wait_output(pane, text, timeout_ms=8000):
    process = subprocess.run(["herdr", "pane", "wait-output", pane, "--match", text,
                              "--source", "visible", "--timeout", str(timeout_ms)],
                             capture_output=True, text=True, timeout=timeout_ms / 1000 + 5)
    return process.returncode == 0


def ready_for_input(name, timeout=15, now=time.time, sleep=time.sleep):
    deadline = now() + timeout
    while now() < deadline:
        text = screen(name)
        if CHOOSER not in text and EMPTY_INPUT in text and BANNER in text:
            return True
        sleep(0.5)
    return False


def renew(name):
    """Send /new, accept the current-worktree default, and confirm a fresh idle session."""
    entry = lead.agent(name)
    if entry.get("agent_status") not in {"idle", "done"}:
        raise RuntimeError("agent_not_idle")
    pane = entry["pane_id"]
    lead.herdr("agent", "prompt", name, "/new")
    if wait_output(pane, CHOOSER):
        lead.herdr("agent", "send-keys", name, "enter")
    # An old banner can still be on screen, so require the chooser gone and an empty input box.
    if not ready_for_input(name):
        raise RuntimeError("renew_uncertain: input box not ready after /new")
    # Herdr may report a brief non-idle state right after /new; wait for it to settle.
    subprocess.run(["herdr", "agent", "wait", name, "--timeout", "15000"], capture_output=True, timeout=20)
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
    fields = handoff_fields(path.read_text())
    missing = [field for field in HANDOFF_FIELDS if field not in fields]
    if missing:
        raise ValueError("Handoff misses fields (docs/handoff/README.md): " + ", ".join(missing))
    if len(path.read_text()) > HANDOFF_MAX_CHARS:
        raise ValueError("Handoff is too long; point to files instead of copying content")
    return path.relative_to(lead.REPO), fields


def handoff_fields(text):
    fields = {}
    for line in text.splitlines():
        if line.startswith("- ") and ":" in line:
            key, value = line[2:].split(":", 1)
            fields[key.strip()] = value.strip()
    return fields


def needs_user(fields):
    return not fields.get("사용자 확인 필요", "").startswith("아니오")


def history(name):
    path = RECORDS / (name + ".history.json")
    return json.loads(path.read_text()) if path.exists() else {"renewals": []}


def limit_reason(name, now=time.time):
    value = history(name)
    if sum(1 for at in value["renewals"] if at > now() - 86400) >= DAILY_LIMIT:
        return "stopped_daily_limit"
    if value.get("chain", 0) >= CHAIN_LIMIT:
        return "stopped_chain_limit"
    return None


def remember(name, state):
    """Count automatic renewals; any human/other-session continuation resets the chain."""
    value = history(name)
    if state in {"renewed", "renewed_waiting"}:
        value["renewals"] = [at for at in value["renewals"] if at > time.time() - 86400] + [time.time()]
        # A waiting renewal hands the next turn to the user, which ends an automatic chain.
        value["chain"] = value.get("chain", 0) + 1 if state == "renewed" else 0
    elif state.startswith("cancelled"):
        value["chain"] = 0
    lead.write(RECORDS / (name + ".history.json"), value)


def reset_limit(name):
    lead.write(RECORDS / (name + ".history.json"), {"renewals": [], "chain": 0})


def screen(name):
    process = subprocess.run(["herdr", "agent", "read", name, "--source", "visible"],
                             capture_output=True, text=True, timeout=10)
    return process.stdout if process.returncode == 0 else ""


def screen_reason(text):
    """Return why the visible Codex screen forbids renewal, or None."""
    if EMPTY_INPUT not in text:
        return "cancelled_input_pending"
    if BACKGROUND in text:
        return "waiting_background"
    body = text.split("\u203a " + EMPTY_INPUT)[0].splitlines()
    tail = [line.strip() for line in body if line.strip()][-12:]
    if any("?" in line or "\uff1f" in line for line in tail):
        return "cancelled_question"
    return None


def open_lead_request(name):
    return any(row.get("source") == name and row["state"] in lead.OPEN
               for row in lead.entries())


def renew_with_handoff(name, handoff, wait=False):
    """Renew, then continue the next action, or only load context when the user must decide."""
    renew(name)
    lead.write(RECORDS / (name + ".json"), {"handoff": str(handoff), "renewed_at": time.time(), "wait": wait})
    if wait:
        text = (f"새 대화입니다. 인계문 {handoff}과 그 안의 읽을 파일만 읽고 맥락을 파악하세요. "
                "다음 일은 사용자 확인이 필요하므로 어떤 작업도 시작하지 말고, 파악했다는 확인 한 줄만 답한 뒤 "
                "사용자 지시를 기다리세요. AGENTS.md 규칙을 따릅니다.")
    else:
        text = (f"새 대화입니다. 인계문 {handoff}을 읽고 '다음 행동'부터 이어서 진행하세요. "
                "AGENTS.md 규칙을 따릅니다.")
    lead.herdr("agent", "prompt", name, text)


def wait_and_renew(name, handoff, awaits_nothing=False, wait=False, now=time.time, sleep=time.sleep):
    """Wait for the scheduling turn to end, then renew after GRACE_SECONDS of untouched idle.

    Any status change after idle (a user, router-coord, or any other prompt) means the session
    continued: cancel, because the handoff no longer describes it. Background terminals or an
    open Lead request restart the grace period; a question or blocked UI cancels. When the
    handoff says it awaits nothing, background terminals are long-running services (collectors,
    servers) whose results no conversation waits for, so they do not block renewal.
    """
    deadline = now() + DEADLINE_SECONDS
    idle_since = idle_seq = None
    while now() < deadline:
        entry = lead.agent(name)
        status, seq = entry.get("agent_status"), entry.get("state_change_seq")
        if status == "blocked":
            return "cancelled_blocked"
        if status in {"idle", "done"}:
            if idle_since is None:
                idle_since, idle_seq = now(), seq
            elif seq != idle_seq:
                return "cancelled_user_continued"
            elif now() - idle_since >= GRACE_SECONDS:
                reason = screen_reason(screen(name))
                if reason == "waiting_background" and awaits_nothing:
                    reason = None
                if reason == "waiting_background" or (reason is None and open_lead_request(name)):
                    idle_since = None
                elif reason:
                    return reason
                else:
                    try:
                        renew_with_handoff(name, handoff, wait=wait)
                    except (RuntimeError, ValueError, OSError, subprocess.SubprocessError):
                        return "renew_uncertain"
                    return "renewed_waiting" if wait else "renewed"
        elif idle_since is not None:
            return "cancelled_user_continued"
        sleep(POLL_SECONDS)
    return "expired"


def notify(name, state):
    if state not in {"renewed", "renewed_waiting"}:
        subprocess.run(["herdr", "notification", "show", f"{name} 자동 새 대화 안 함",
                        "--body", f"{state} (tools/intelligent-router/.state/renew)", "--sound", "request"],
                       capture_output=True, timeout=10)


def unpushed_commits():
    process = subprocess.run(["git", "rev-list", "--count", "@{upstream}..HEAD"], cwd=lead.REPO,
                             capture_output=True, text=True, timeout=10)
    return int(process.stdout.strip()) if process.returncode == 0 else -1


def schedule(name, value):
    # Renew only after a large unit of work: committed and pushed, not after each small step.
    if unpushed_commits() != 0:
        raise ValueError("큰 작업 단위가 끝나지 않았다(커밋이 push되지 않음). push 후 예약한다")
    # Always renew; whether the new session continues or waits is decided from the handoff.
    handoff, _ = checked_handoff(name, value)
    reason = limit_reason(name)
    if reason:
        notify(name, reason)
        raise ValueError(reason + ": 사용자 확인 후 renew.py reset router-impl")
    RECORDS.mkdir(parents=True, exist_ok=True, mode=0o700)
    lead.write(RECORDS / (name + ".pending.json"),
               {"handoff": str(handoff), "scheduled_at": time.time(), "state": "scheduled"})
    with open(os.devnull, "wb") as sink:
        subprocess.Popen([sys.executable, __file__, "watch", name], cwd=lead.REPO, stdin=subprocess.DEVNULL,
                         stdout=sink, stderr=sink, start_new_session=True)
    return handoff


def watch(name):
    with (RECORDS / (name + ".watch.lock")).open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return "watcher_busy"
        pending_path = RECORDS / (name + ".pending.json")
        pending = json.loads(pending_path.read_text())
        fields = handoff_fields((lead.REPO / pending["handoff"]).read_text())
        pending["state"] = wait_and_renew(name, pending["handoff"],
                                          awaits_nothing=fields.get("기다리는 것", "").startswith("없음"),
                                          wait=needs_user(fields))
        pending["finished_at"] = time.time()
        lead.write(pending_path, pending)
        remember(name, pending["state"])
        notify(name, pending["state"])
        return pending["state"]


def main():
    if sys.argv[1:2] == ["schedule"]:
        parser = argparse.ArgumentParser(description="Renew router-impl after this turn ends")
        parser.add_argument("command")
        parser.add_argument("agent", choices=["router-impl"])
        parser.add_argument("--handoff", required=True)
        args = parser.parse_args()
        handoff = schedule(args.agent, args.handoff)
        print(json.dumps({"agent": args.agent, "state": "scheduled", "handoff": str(handoff),
                          "grace_seconds": GRACE_SECONDS}, ensure_ascii=False))
        return
    if sys.argv[1:3] == ["reset", "router-impl"]:
        reset_limit("router-impl")
        print(json.dumps({"agent": "router-impl", "renewals_today": 0, "chain": 0}))
        return
    if sys.argv[1:2] == ["watch"]:
        print(watch(sys.argv[2]))
        return
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("agent", choices=["router-impl", "router-lead"])
    parser.add_argument("--handoff", help="docs/handoff/<file>.md (required for router-impl)")
    args = parser.parse_args()
    if args.agent == "router-lead":
        # Lead keeps no task state; lead.py pump renews it before each request.
        with (lead.STATE / "dispatch.lock").open("a") as lock:
            lead.fcntl.flock(lock, lead.fcntl.LOCK_EX | lead.fcntl.LOCK_NB)
            if any(row["state"] in lead.IN_FLIGHT
                   for row in lead.entries()):
                raise SystemExit("Lead has an open request; not renewing")
            renew(args.agent)
        print(json.dumps({"agent": args.agent, "state": "renewed"}))
        return
    if not args.handoff:
        raise SystemExit("--handoff docs/handoff/<file>.md is required for router-impl")
    handoff, fields = checked_handoff(args.agent, args.handoff)
    renew_with_handoff(args.agent, handoff, wait=needs_user(fields))
    remember(args.agent, "cancelled_manual")  # A manual renewal is a human checkpoint: reset the chain.
    print(json.dumps({"agent": args.agent, "state": "renewed", "handoff": str(handoff)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
