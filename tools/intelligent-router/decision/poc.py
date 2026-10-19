#!/usr/bin/env python3
"""Local-only d3-lite PoC. Never starts Codex/Herdr or downloads models."""
import argparse
import hashlib
import importlib.util
import json
import resource
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "routing"))
from policy import recommend


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", type=Path, required=True,
                        help="Previously downloaded, reviewed pinned d3-lite package")
    parser.add_argument("--cases", type=Path, required=True,
                        help="JSON array: id, request, optional explicit code excerpt context")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--device", choices=["cpu", "mps"], default="mps")
    args = parser.parse_args()
    config = json.loads((ROOT / "config/policy.json").read_text())
    cases = json.loads(args.cases.read_text())
    questions = json.loads((ROOT / "decision/questions.json").read_text())
    model_dir = args.model_dir.resolve()
    manifest_bytes = (model_dir / "MODEL_MANIFEST.json").read_bytes()
    if hashlib.sha256(manifest_bytes).hexdigest() != config["decision"]["manifest_sha256"]:
        parser.error("Model manifest does not match the reviewed pinned package")
    manifest = json.loads(manifest_bytes)
    for name, expected in manifest["files_sha256"].items():
        if name.endswith(".py"):
            path = (model_dir / name).resolve()
            if not path.is_relative_to(model_dir) or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                parser.error("Model executable source does not match the pinned manifest")
    sys.path.insert(0, str(model_dir))
    # Local reviewed code, not trust_remote_code against a floating Hub revision.
    spec = importlib.util.spec_from_file_location("router_d3_runtime", model_dir / "d3_runtime.py")
    runtime = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = runtime
    spec.loader.exec_module(runtime)
    import torch
    torch.set_num_threads(4)
    if args.device == "mps" and not torch.backends.mps.is_available():
        parser.error("MPS unavailable; use --device cpu explicitly")
    started = time.perf_counter()
    model = runtime.D3.from_pretrained(str(model_dir), device=args.device, verify="full", batch_size=3)
    load_seconds = time.perf_counter() - started
    records = []
    for case in cases:
        request, context = case["request"], case.get("context", "")
        incomplete = (case.get("context_incomplete", False) or
                      len(request) > config["max_request_chars"] or
                      len(context) > config["max_context_chars"])
        state = {"request": request[:config["max_request_chars"]],
                 "context": context[:config["max_context_chars"]]}
        if args.device == "mps":
            torch.mps.synchronize()
        wall, cpu = time.perf_counter(), time.process_time()
        try:
            raw = model.system_one(state=state, questions=questions)
            error = None
        except Exception as exc:
            raw, error = {}, type(exc).__name__
        if args.device == "mps":
            torch.mps.synchronize()
        cpu_seconds, seconds = time.process_time() - cpu, time.perf_counter() - wall
        decision = recommend(raw, config, context_incomplete=incomplete,
                             **{k: case[k] for k in ["previous_failure", "sensitive_change",
                                                    "changed_files", "module_count"] if k in case})
        records.append({"id": case["id"], "raw": raw, "decision": decision,
                        "error": error, "wall_seconds": seconds, "cpu_seconds": cpu_seconds,
                        "cpu_percent_one_core": cpu_seconds / seconds * 100,
                        "max_rss_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                        "codex_tokens": None, "task_success": None, "test_pass": None})
        print(json.dumps({"id": case["id"], "seconds": seconds, "decision": decision}, ensure_ascii=False), flush=True)
    result = {"status": "shadow_poc", "decision_repository": config["decision"]["repository"],
              "revision": config["decision"]["revision"], "device": args.device,
              "manifest_sha256": config["decision"]["manifest_sha256"],
              "torch_version": torch.__version__, "load_seconds": load_seconds,
              "rss_scope": "process high-water RSS on macOS; not GPU/unified-memory total",
              "records": records}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
