# ADR0127 — Deterministic Ethereum teaching prototype

Status: local prototype, pending user visual approval.

The user requested protocol-grounded interactive animation before integration. Keep the existing Atlas dashboard and operational endpoints unchanged. Place all learning runtime code in `experiments/blockchain-knowledge`, served by a separate loopback-only fixed-asset server; no API/DB/provider connection, dependency installation or production publication.

Separate protocol rules (`protocol.mjs`), pure time-indexed event reduction (`engine.mjs`), narrative (`narrative.mjs`), SVG rendering (`renderer.mjs`) and transport state/controller (`playback.mjs`, `controller.mjs`). Reconstruct state for every seek rather than reversing DOM mutations. One requestAnimationFrame clock runs only during user playback, pauses when hidden/off-screen and stops at the end. Render interpolation uses that same time; no independent CSS timeline. Reduced motion exposes static steps, and no-JS content explains the full sequence.

Use a small fixed SVG scene with semantic client checks, block assembly, gossip packets, epoch stake tally and checkpoint transition. Nodes are an illustrative peer sample, not voting weight. Counts normalize stake into 12 equal pedagogical units (bigint), with 8/12 sufficient and 7/12 insufficient. This is not a complete consensus client or live network simulation. See [research and storyboard](../research/2026-11-01-ethereum-learning-model.md) for source links, time compression and excluded cases.

SVG offers inspection, keyboard-accessible objects and stable seek reconstruction at this scale. GSAP adds a second timeline without a present need; Pixi adds complexity without observed node-volume pressure. Reconsider Canvas only if expanded scenes cannot meet measured budgets.

Ethereum is the only enabled protocol in this first review. Other options explicitly say next research, and unknown model IDs are rejected. XRPL will need ledger/candidate consensus semantics rather than Ethereum slots/blocks copied under another label. Expansion and Atlas integration wait for prototype review.

## Beginner lessons extension (2026-11-01)

Keep the consensus engine intact. Add independent deterministic slot-generation and fork-choice teaching snapshots in `lessons.mjs`, a separate fixed SVG renderer, and a glossary with easy descriptions plus opt-in technical detail. A single player switches among lessons, pausing and resetting the clock on switch. The same snapshot drives the scene, vote ledger, KPIs and narrative. SVG visibility is controlled using attributes (not an unsupported HTML hidden property); exactly one matching renderer must be visible.

The fork lesson is a declared educational subset, not a consensus client: known valid candidates/messages, normalized bigint stake, latest-message epoch replacement, weighted descendant branches, deterministic root ties, and fixed justified/finalized ancestry. Delayed messages from different validators avoid teaching same-epoch double voting. Show the decision after proposer boost expiration. See the [reviewed model](../research/2026-11-01-ethereum-beginner-lessons.md) for timings and omissions.

## 2026-11-01 거래 학습 확장

블록 생성의 슬롯/블록 핵심 모형과 합의/Fork 모형을 유지하고, `transactions.mjs`에서 시간·시나리오별 교육용 거래 상태를 파생한다. 거래 목록과 Receipt를 분리하며 Selected/Executed/Included를 같은 상태로 합치지 않는다. 정상·빈 사용자 거래 목록 모두 동일 슬롯 시계를 사용한다. 거래 도착/선택/실행/포함 시각은 모형이 소유하고 렌더러는 이 이벤트 시각으로 이동을 계산한다. 새로운 EVM 실행/서명/공급자 호출/배포는 도입하지 않는다. 세부 가정과 검증은 `docs/research/2026-11-01-ethereum-transactions.md`를 따른다.

## 2026-11-01 교육용 시간 배치

프로토콜 사건을 지연시키거나 거래 순서를 바꾸지 않고 `pacing.mjs`에서 모형 시간과 교육용 표시 시간을 분리한다. 단조·연속 구간 매핑과 역변환을 모든 tick/seek에 공통 적용해 정방향·역방향 상태를 일치시킨다. 중요한 첫 상태는1.5~2초, 반복 구간은 기존 속도,사용자 배속은 표시 시간에 적용한다. 별도 CSS 시계/이벤트 대기열/자동 일시정지는 추가하지 않는다. 구간별 실측과 근거는 `docs/research/2026-11-01-ethereum-pacing.md`를 따른다.

## Epoch extension (2026-11-01)

Add an independent Epoch lesson, preserving existing Slot/Transaction, consensus and Fork models. A pure epoch model derives slots, existing block checkpoint references, weighted target participation and the four Casper FFG finalization patterns at processing boundaries. Use fixed illustrative validator weights and explicit preconditions; do not claim a full client, real assignments, signature execution or reward accounting. Separate wall-clock teaching time from protocol time. Provide normal, skipped-slot and delayed-finality scenarios, with 32-slot inspection in a detail dialog. See [Epoch implementation and verification](../research/2026-11-01-ethereum-epoch.md).

## Consensus learning extension (2026-11-01)

Replace the visible consensus lesson with a single deterministic Attestation → fork choice → FFG narrative. Share the existing weighted fork-choice helpers via `fork-choice.mjs` and reuse the Epoch FFG transition without changing other lesson semantics. Distinguish gossip receipt, latest messages, included target participation and finalization. For result scenes, keep the decision's epoch participation visible while the live head continues forward. Fixed validated inputs and no-proposer-boost observations are explicit simplifications, not a full consensus Store. Normal, offline and delayed-gossip scenarios use the same fixed balances and clock. See [implementation and verification](../research/2026-11-01-ethereum-consensus.md).

## Production authorization supersedes prototype-only boundary

On 2026-11-01 the user explicitly authorized autonomous multichain learning releases, subject to regression, visual, CI and production health gates. ADR0128 now governs runtime publication; earlier prototype-only records remain historical. No production data collection or consensus-client execution is implied.
