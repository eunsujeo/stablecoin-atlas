# XRPL initial transaction intake — 2026-11-02

## Scope and evidence

XRPL-only initial educational scene and UNL explanation. Existing design tokens, transport, protocol quorum/execution/validation rules and other chains are preserved. No dependencies, downloads, provider RPC, DB, Collector or FX changes. Branch `learning/xrpl-intake` starts at38c4e9382ae62b176cfebd4891a459e185b82806. Existing unrelated handoff modifications are preserved.

Reviewed official [XRPL Consensus Structure](https://xrpl.org/docs/concepts/consensus-protocol/consensus-structure): clients sign/submit transactions; servers observe and relay candidates; propagation means their candidate sets may differ. The server evaluates its trusted validators' proposals, then independently verifies computed ledger results. Receiving a candidate is not transaction-set agreement or a validated ledger. The existing five-validator/four-support example remains explicitly educational, not the global validator population or a complete dynamic quorum implementation.

## Implementation

The first four presentation seconds still map1:1 to model time. `xrplState().intake` separates TX01 milestones from unchanged proposal/Validation evidence:

| Educational time | State | Visible change |
| --- | --- | --- |
| 0–0.6s | Signing | User card highlights TX01 signing |
| 0.6–1.8s | Submitted / sending | Labeled TX01 moves from user toward observation server |
| 1.8–2.7s | Received | Server acknowledges receipt; candidate transfer runs2.2–2.7s |
| 2.7–4s | Candidate | This server's next-ledger candidate shows TX01; no agreement yet |
| 4s onward | Existing proposal sequence | Original transaction and ledger scene resumes |

The first KPI reports signing/transit/receipt/candidate state. Agreement and Validation remain0/5 before4s. Candidate receipt does not set `accepted`, executed count, computed ledger candidate or validated status. Server-specific candidates and conditional final inclusion are explained. Existing TX01 later detail correctly distinguishes executed from validated inclusion.

The three existing top-card positions display user/server/candidate during the introduction. A labeled transaction object travels between them; reduced motion suppresses travel while retaining discrete state explanations. No new icon, theme, control or panel stack. UNL nodes share a visual/semantic group with the full Korean definition, educational size and threshold; proposal versus Validation text remains separate. Inactive context is subdued. Hidden cards leave keyboard tab order; intake objects open the existing detail dialog.

## Validation and reproduction

Existing Node25.2.1 toolchain: `source .state/dev-env.sh`.

- `node --test tests/knowledge-*.test.mjs tests/ethereum-learning*.test.mjs`:89pass,0fail.
- `npm run check`: final result in `.state/xrpl-intake-check.log` and matching handoff.
- `KNOWLEDGE_OUTPUT=docs/design/knowledge/xrpl-intake-seconds node tools/xrpl-intake-browser-check.mjs`: actual uninterrupted first4s in normal/offline; snapshots0/1/2/3/4s at1440×900,1280×800,390×844; exact rewind DOM/state; transaction-vs-quorum KPI and five-node group; keyboard dialog/focus. PASS.
- `KNOWLEDGE_CHAIN=xrpl KNOWLEDGE_OUTPUT=docs/design/knowledge/xrpl-intake-complete node tools/knowledge-browser-check.mjs`: full normal/offline/delayed playback plus layout, timeline, four speeds, learning auto-pauses, history, dialogs, reduced motion and exact rewind. Includes360×800 in addition to requested sizes.
- TRON/Solana/Base use the same harness with `KNOWLEDGE_RENDER_ONLY=1` for all scenario states and controls; those runs are not claimed as full playback. Ethereum beginner harness plays Slot/consensus/Fork fully.
- Production checks use `KNOWLEDGE_URL=https://atlas.whatto.me/knowledge/index.html`; release SHA/CI/health recorded in the matching handoff after completion.

Screenshots/report directories remain local. `docs/design/knowledge/xrpl-intake-review.html` compares the initial seconds; filenames are exact model/presentation seconds in this initial interval.

## Findings and limitations

First browser pass found that reparenting UNL nodes on every frame disrupted keyboard focus restoration. Grouping now happens once during renderer construction; keyboard regression passes. A dedicated harness initially compared desktop DOM with a not-yet-settled mobile viewport; awaiting two animation frames after device metrics fixes that harness race. Neither failure was ignored.

The targeted local review submission failed before a request ID with `agent_not_found`; no delegated implementation or review approval is claimed. Direct model tests and real browser checks provide the verification evidence.

The scene is a synthetic explanation of one observation server, not real submission, signatures, network observations, a global shared pool or a real4-second XRPL latency guarantee. Later normal/failure consensus conditions are unchanged.
