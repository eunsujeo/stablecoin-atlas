# Adaptive educational pacing and step learning — 2026-11-02

## Scope and implementation

User authorizes the existing CI/CD route after tests and real browser verification. Preserve dashboard, API, Collector, FX, DB, deployment security and protocol conditions. No new dependencies or downloads. Work is isolated on `learning/adaptive-pacing`; unrelated handoff edits are preserved.

`web/knowledge/pacing.mjs` maps the existing deterministic model interval0..24 to presentation seconds. Network/scenario profiles replace the uniform six-second chapters. Ethereum continuous profiles remain unchanged. Base recovery, derivation delay, reorg, deposit and withdrawal receive dedicated profiles; Solana skipped-leader recovery also has its own profile. The ordinary profiles last XRPL38s, TRON32s, Solana37s and Base30s at1×. These are educational durations, not protocol latency claims.

- XRPL distinguishes transaction-set agreement, sequential execution, candidate hash and independent Validation. Failed quorum remains in agreement wait, with no execution or validation fabricated.
- TRON gives the18-producer interval4s and the19-producer/target5001 result5s. Existing new-contributor highlight and real production-history threshold are preserved.
- Solana gives the60% Notar result4s before the80% fast certificate. Narrative and visual focus follow actual certificate evidence. Certificate sufficiency and finality are not invented as separate protocol timers. The slow path still requires the two existing rounds.
- Base gives normal L1 publication6s, derivation/Safe6s and Finalized5s; delayed/failed conditions stay delayed/failed.

The compact mode selector offers continuous playback (default) and step learning. A key interval auto-pauses immediately before the next event, preserving the explanation just read. Next plays to the next stop; Previous/seek/pause/reset remain deterministic. Switching to continuous while playing removes subsequent automatic stops. Reduced motion remains non-animated, including Next. Speed stays0.5/1/1.5/2 and is preserved through rewind/network/scenario switches. No extra wall-clock timers own protocol state.

## 0.5× investigation

`tools/knowledge-rate-browser-check.mjs` measures `performance.now()` and `knowledgeSnapshot.playbackTime` within the same browser, over1.2s windows; CDP round-trip/automation waits are excluded. It records model-time delta separately: model time is intentionally nonlinear and must not be used as the speed ratio. Native select change events are dispatched; this is not a claim to have reproduced the remote Cloud Browser's exact interaction stack.

Four chains × seven conditions: initial0.5 selection, after network switch, speed change during playback, pause/resume, seek/resume, scenario change, rewind preserving speed.

- Before implementation:28/28 passed, ratio0.4997535–0.5004113.
- After implementation:28/28 passed, ratio0.4991793–0.5039768 under concurrent browser verification.
- The suspected1× behavior was **not reproduced**. No speed multiplier fix is claimed. Reports: `docs/design/knowledge/pacing-baseline/rate-measurements.json` and `pacing-rate/rate-measurements.json`.

## Validation and reproduction

Use the existing toolchain: `source .state/dev-env.sh` (Node25.2.1).

- `node --test tests/knowledge-*.test.mjs tests/ethereum-learning*.test.mjs`:87pass,0fail.
- `npm run check`:895main+74archived passes,0fail;8 existing optional compiler-cache skips. Log `.state/pacing-check.log`.
- `KNOWLEDGE_CHAIN=xrpl KNOWLEDGE_OUTPUT=docs/design/knowledge/pacing-xrpl node tools/knowledge-browser-check.mjs`, repeat tron/solana/base. Reports distinguish full playback and render-only. Checks include all scenarios, presentation timestamps0/6/12/18/24/30/36 within each duration, model transitions, exact rewind, KPI/narrative/state colors, all speeds, history/hash routing, selected-object dialogs, reduced motion, real auto-pauses/Next/continuous resume and SVG/layout bounds.
- Viewports1440×900,1280×800,390×844,360×800. Screenshots retain model-time filenames; `pacing-milestones` captures execution/certificate/18→19/Safe/Finalized transitions explicitly.
- Ethereum `experiments/blockchain-knowledge/beginner-browser-check.mjs`: full Slot/consensus/Fork playback and controls/layout regression.
- Dashboard `node tools/ui-selected-design-browser-check.mjs http://127.0.0.1:54873 --production`:PASS, desktop/mobile/theme/filters/routes.
- Production uses `KNOWLEDGE_URL=https://atlas.whatto.me/knowledge/index.html`; local preview is127.0.0.1:54874. Release evidence and SHA are recorded in the matching handoff after CI/deployment, not inferred from local success.

## Findings and limitations

The new invertibility test exposed double rounding of presentation/model time (e.g.17.4 becoming17.400000001). Removing premature presentation rounding preserves exact sampled event states while retaining model-time normalization. The initial test failure is preserved in the work record; the corrected suite passes. This is separate from the unconfirmed0.5× issue.

The UI keeps the original layout and visual tokens; only the transport mode selector and relevant educational focus/narrative are added. Real cryptography, node execution and production observations remain outside the educational model. Chrome frame measurements are this machine's results, not a universal60fps guarantee. No remote Cloud Browser or Safari-specific reproduction is claimed.
