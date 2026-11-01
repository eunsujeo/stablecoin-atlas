# XRPL learning and Ethereum production integration

2026-11-01 · user authorized autonomous XRPL → TRON → Solana releases after CI/visual/regression checks. Existing modified handoff files and unrelated untracked design experiments preserved. No subagents, provider/RPC collection, schema changes or secret publication.

## Implementation

Shared learning runtime moved to `web/knowledge`; old experimental imports remain re-exports. The loopback preview and production use the same files. Production registers exact assets only. Sidebar links to `/knowledge/index.html`; the header switches Ethereum/XRPL without reload. Existing Ethereum modules and controls are retained.

XRPL depicts initial differing transaction-set proposals, revisions toward TX01/TX02, canonical application and signed ledger-hash comparison. TX03 remains pending. A fixed local UNL of5 with quorum4 is an illustrative sample. Outsiders, duplicate validators, wrong hashes and invalid signature flags do not add support. Offline2 prevents a new validated ledger; delayed validation holds Closed before sufficient matching results arrive. No chosen block proposer or XRP stake weight is invented. Negative UNL, dynamic quorum, full close-time rules, execution and signatures are outside this teaching model.

Official sources reviewed:
- https://xrpl.org/docs/concepts/consensus-protocol/consensus-structure
- https://xrpl.org/docs/concepts/consensus-protocol/consensus-principles-and-rules
- https://xrpl.org/docs/concepts/consensus-protocol/consensus-protections

## Deployment boundary

Preflight existing SSH mux: web, deploy timer and Collector active; current release `896e74ae04be0500a4420565ceb880846e536884`. GitHub connector identity and repository access verified; no credentials logged. Existing CI was workflow_dispatch only; learning branch trigger uses the same pinned full workflow. Main is updated only after successful CI for the identical candidate SHA. LOCAL_GIT remains responsible for build, immutable packaging, web switching and rollback. No manual file-copy deployment or non-web restart.

## Verification and evidence

Local model/production-route/Ethereum tests58 PASS at targeted verification. New tests cover UNL quorum, false/duplicate/wrong-hash inputs, closed versus validated, stalled and delayed states, deterministic rewind and exact public asset routing without data reads. Actual browser captures at1440×900,1280×800,390×844,360×800 in `docs/design/knowledge/xrpl/`. All3 initial36-second real plays passed. Final refinements clarify initial proposal differences, pending transaction type and network-specific technical help; targeted tests and final render rerun. Full check, dashboard/Ethereum browser regression and actual release results are appended when complete.

Logs `.state/agent-logs/knowledge-xrpl-*`. Reproduce with Node environment `.state/dev-env.sh`, `node --import tsx --test tests/knowledge*.test.mjs tests/ethereum-learning*.test.mjs`, `node tools/knowledge-browser-check.mjs`, `node experiments/blockchain-knowledge/beginner-browser-check.mjs`, `npm run check`. The new UI is not a full validator client and fixed teaching values are never network observations.

Pre-commit checks: `npm run check` exit0,866 main+74 archived=940 PASS,0 FAIL,8 pre-existing compiler SKIP. Ethereum browser full Slot/consensus/Fork replay and desktop/mobile regression PASS. Existing production-mode dashboard browser PASS (themes, filters, responsive overview/assets/live and no candidate assets). Final XRPL render and model/route58 targeted tests PASS. Production browser blocks only known Cloudflare analytics hosts and records those attempts separately; unexpected external hosts remain a failure.
