# Multi-chain animation UX correction — 2026-11-02

## Scope and model decisions

Starts from production dcc03746179a03dae8a3d1e4eaf9747d91fbb7b4 on `learning/multichain-ux`. Preserve layout, palettes, existing protocol rules and unrelated workspace changes. No dashboard, collector, FX, API, database, security, dependency or deployment configuration changes.

- XRPL: elapsed presentation time no longer selects a supposedly achieved protocol stage. Actual agreement/execution/candidate/validation flags determine the current stage, heading and complete/current/waiting/unentered labels. An offline 3/5 agreement leaves execution and Validation unentered and keeps ledger9000 validated. The last chapter is neutral “확정 조건 확인”. Ledger/UNL are explained in Korean in the existing inspector.
- Solana: candidate7001 and its Processed/Finalized commitment are separate from latest finalized7000/7001. Historical finality is not relabeled Processed. Notar, Final and Skip certificate panels appear when relevant; hidden panels leave keyboard traversal. A missing leader is described as waiting/skipping while no candidate exists.
- URL: menu selection creates a history entry; hashchange/popstate synchronize the network. A network change resets playback/scenarios/narrative/selected objects, closes dialogs and removes stale focus targets. A closed dialog on navigation focuses the network menu. Invalid hashes normalize to Ethereum. Ethereum lesson tabs remain internal to Ethereum.
- Semantic KPI tones are pure projections of protocol evidence, not translated display-string matching. Pending/unsafe/incomplete conditions use neutral or purple warning tokens; achieved safe/finalized/validated/solidified conditions use teal. An already finalized historical Solana block remains success with an explicit reference-block label. Text remains available independently of color. Only learning-page KPI rules change.
- TRON: keep the 36-second presentation and existing player, but redistribute the compressed protocol clock around the 18th and 19th distinct producers. Normal and skipped-slot scenarios retain the 18-producer state ~2.1 presentation seconds and the 19-producer state ~2.1 seconds. Highlight the new contributing SR and target5001 together. The final chain/history/solidification rules and early transaction sequence remain intact. Nine offline SRs still cap support at18.
- Base: output claim and Portal cards are hidden in ordinary block lessons, expandable through an accessible control. Withdrawals show both; deposits show Portal without an unrelated output claim. Existing bridge/derivation state transitions are unchanged.
- All network lessons show “객체를 선택하면 설명을 볼 수 있습니다”. Phase/title changes are announced; no decorative icons or libraries were added.

Protocol sources remain the existing reviewed official links in each network module and ADR0128/0129. This correction changes educational presentation and navigation, not consensus thresholds or live network data. No new network RPC/provider calls were made.

## Verification and reproduction

Existing toolchain: `source .state/dev-env.sh` (Node25.2.1). No downloads/new dependencies.

- `node --test tests/knowledge-*.test.mjs tests/ethereum-learning*.test.mjs`:83pass,0fail.
- `npm run check`:891 main +74 archived passes,0fail,8 pre-existing optional compiler-cache skips. Final rerun log `.state/multichain-ux-final-check.log`.
- Loopback preview: `node experiments/blockchain-knowledge/server.mjs`,127.0.0.1:54874.
- `KNOWLEDGE_CHAIN=xrpl KNOWLEDGE_OUTPUT=docs/design/knowledge/ux-xrpl node tools/knowledge-browser-check.mjs` (repeat tron/solana/base).
- Production uses `KNOWLEDGE_URL=https://atlas.whatto.me/knowledge/index.html`, never `/knowledge/`.
- `KNOWLEDGE_RENDER_ONLY=1` verifies render/interactions, not full playback. Full playback results are separately recorded in `verification.json`.

Harness samples presentation seconds0,6,12,18,24,30,36 (model times0,4,8,12,16,20,24), plus transition points. Images use model-time filenames. Viewports1440x900,1280x800,390x844 plus360x800. Checks include real hash navigation/history/menu state, play/pause/reset, steps, arbitrary seek and exact rewind, four speeds, selected-object dialogs/Escape/focus, model/KPI/tones/stage consistency, SVG/panel bounds, reduced motion, Base disclosure and progressive Solana certificate visibility. TRON screenshots at model17 and17.5 straddle the focused transition.

Ethereum Slot/consensus/Fork/Epoch full-play harnesses and all protocol tests preserve existing learning behavior. The separate dashboard harness covers overview/assets/routes, color mode, filters and mobile layout without changing the data API. Screenshots/reports stay local under `docs/design/knowledge/ux-*`; comparison page `ux-review.html`.

## Failures, limitations and release gate

Router debugging-review submission failed before a request ID (`agent_not_found`); no review response or delegated implementation is claimed. Two old KPI tests initially failed because they asserted the old mixed-reference text; assertions now independently bind candidate commitment and finalized/solid target labels to their reference blocks. Consensus-condition tests remain unchanged.

All20 XRPL/TRON/Solana/Base scenarios completed full playback locally. Final render passes additionally cover the screen-reader announcement and dialog-focus corrections. Ethereum full Slot/consensus/Fork and Epoch passes are recorded separately; added real presentation-time sampling to the Ethereum harnesses. Fork playback ends at24 seconds, so no nonexistent30/36-second Fork frame is claimed. The first additional timestamp-loop harness used a repeated top-level lexical variable; corrected it to a scoped expression and reran successfully (harness issue, not an application error).

Full playback is measured in Chrome on this development machine, not a cross-device performance guarantee. Synthetic educational data is still explicitly labeled. Model exclusions (real cryptographic verification, full node execution and unmodeled recovery paths) remain as documented by each lesson.

The exact deployment SHA, CI outcome, production playback and health evidence are recorded in `docs/handoff/2026-11-02-multichain-animation-ux.md` after release. Local/browser success alone is not deployment success.
