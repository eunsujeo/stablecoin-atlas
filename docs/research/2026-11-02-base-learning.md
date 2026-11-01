# Base learning — 2026-11-02

## Implementation and evidence

Branch `learning/base` starts at four-network production commit `7973bb31aa230102dd44bb041c2fbd215cd1c436`. Preserve unrelated workspace edits. Base adds two exact public modules (`base.mjs`, `base-renderer.mjs`), registry/selector wiring and deterministic model tests. Existing player chapters now accept scenario-specific labels; shared network chapters without explicit keys use their stage time, fixing multiple simultaneous selected chapter indicators. No dependencies or compiler downloads were needed.

The L2 band contains sequencer/preconfirmation, three parent-linked block candidates and the deriving node. The L1 band separates origin, batch/deposit event, output claim and Portal message. Ten scenarios share all player controls, inspection, reduced-motion support and synthetic-data notices. See ADR0129 for model boundaries.

Official sources reviewed (public documentation only, no provider/RPC calls):
- [Flashblocks](https://docs.base.org/specifications/flashblocks)
- [Denim activation status](https://docs.base.org/upgrades/denim/overview)
- [Beryl activation and game windows](https://docs.base.org/upgrades/beryl/overview)
- [Transaction finality](https://docs.base.org/specifications/transactions/transaction-finality)
- [Derivation](https://docs.base.org/specifications/base-protocol/consensus/derivation)
- [Batcher](https://docs.base.org/specifications/base-protocol/batcher)
- [Deposits](https://docs.base.org/specifications/base-protocol/bridging/deposits)
- [Withdrawals](https://docs.base.org/specifications/base-protocol/bridging/withdrawals)
- [Proof contracts](https://docs.base.org/specifications/base-protocol/proofs/proof-contracts)

Do not infer Mainnet activation from Sepolia. Mainnet is modeled pre-Denim (Flashblocks distinct from full blocks); current Azul/Beryl proof windows are modeled separately from proof maturity, registry finality and guardian gates. Production contract settings were not queried. The challenge scenario is a fixed successful challenge and invalidation example, not a complete cryptographic game or a guarantee that every challenge wins.

## Failures and corrections

Router architecture submission failed before an ID (`agent_not_found`); no subagent or review outcome exists. Initially guessed upgrade subpage paths were inaccessible; canonical documentation-index/specification paths supplied the evidence instead. This was not treated as missing protocol documentation.

First browser pass found the L1 reorg narrative overflowing the existing 1280x800 panel. Shortened the visible explanation without shrinking typography or altering layout; detail remains available. Mobile inspection found the derivation line passing through a block; routed it around the right edge. Flow captions now follow actual state, so publication/derivation delays never falsely display a received finality signal. Existing sources, dashboards and data APIs are unchanged.

## Reproduction

Use the existing `.state/dev-env.sh` toolchain; Node25.2.1 meets >=24.5. No new dependency installation.

- `node --test tests/ethereum-learning*.test.mjs tests/knowledge-*.test.mjs`
- `npm run check`
- `node experiments/blockchain-knowledge/server.mjs` (loopback54874)
- `KNOWLEDGE_CHAIN=base node tools/knowledge-browser-check.mjs`
- Optional render-only: `KNOWLEDGE_RENDER_ONLY=1`; this does not establish full playback.
- Production: same harness with `KNOWLEDGE_URL=https://atlas.whatto.me/knowledge/index.html` and separate `KNOWLEDGE_OUTPUT`.

Local images and browser JSON: `docs/design/knowledge/base/`. Four viewports:1440x900,1280x800,390x844,360x800. Checks include model/DOM KPI and block-parent/transaction/bridge-state agreement, exact rewind, bounds, pause/restart/steps, all four playback speeds, keyboard inspection/focus and reduced motion. Generated images remain local review artifacts.

## Results

Local final `npm run check`: rc0, 887 main +74 archived tests passed (961 total), 0 failures, 8 pre-existing optional pinned-compiler cache skips. Focused Ethereum and all-network models:79/79, including10 new Base tests. Base:all10 full36-second plays passed, frame median ~16.7ms and p95 16.7–16.8ms; final render pass confirms the later caption/connector corrections. All four viewport/model/rewind/keyboard/reduced-motion checks passed. Existing Ethereum Slot/consensus/Fork full playback, XRPL/TRON/Solana render/interactions and dashboard overview/assets/responsive-route checks passed. Local evidence is in `.state/base-*.log`, `.state/knowledge-base-final-check.log`, and `docs/design/knowledge/`; `base-review.html` compares ten scenarios at start/middle/end.

Protected CI/deployment is the next gate. The release handoff must record exact SHA, CI and actual production evidence; local success alone is not deployment success.

Production harness initially used `/knowledge/`, which correctly returned404 under the existing exact asset allowlist. The actual entry is `/knowledge/index.html`; corrected the verification URL and this reproduction command. No server routing or security policy change was needed.
