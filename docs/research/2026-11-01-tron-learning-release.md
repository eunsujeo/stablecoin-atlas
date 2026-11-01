# TRON production learning — 2026-11-01

Scope: independent deterministic TRON model and renderer in the existing learning shell. Ethereum and XRPL remain intact. No chain RPC, keys, collection, schema or policy changes.

Official sources reviewed: [Consensus and DPoS](https://developers.tron.network/docs/concensus), [java-tron DposService](https://github.com/tronprotocol/java-tron/blob/develop/consensus/src/main/java/org/tron/consensus/dpos/DposService.java), [confirmed data](https://tronweb.network/docu/docs/references/confirmed-vs-unconfirmed).

Fixed27 SR schedule;3-second protocol slots distinct from36-second educational pacing. Sequential execution/signing and first block hold precede compressed subsequent production. Missing slot6001 creates no block;6002 references existing parent5001. Normal, missed slot and9 offline SR scenarios. Track each active SR's latest production height; sort and choose index8, preserve previous solid boundary.18 producers can generate36 blocks without advancing solid height. No invented per-block explicit attestations or fixed confirmation countdown. SR election votes are distinct from production evidence. Maintenance rotation, real signatures/TVM and fork switching remain outside this focused model, explained in details.

Tests assert execution/inclusion order, missing-slot parents,19-vs18 distinct producers, monotonic solidification, deterministic rewind/KPI. Browser harness checks actual SR history/parent/solid DOM attributes in addition to playback, screen bounds, keyboard and reduced motion. Runtime uses exact public asset allowlist. No packages installed.

Reproduce: `source .state/dev-env.sh`; `node --test tests/knowledge-*.test.mjs`; `npm run check`; preview `node experiments/blockchain-knowledge/server.mjs`; `KNOWLEDGE_CHAIN=tron node tools/knowledge-browser-check.mjs`. Production harness uses explicit `KNOWLEDGE_URL=https://atlas.whatto.me/knowledge/index.html`, blocks only known analytics, preserves application requests and TLS.

## Local gate

Full check exit0:870 main+74 archived tests pass,0fail,8pre-existing compiler skips.9 focused knowledge tests pass. TRON all3 full36-second plays and4 viewports pass; final render rerun passes keyboard object inspection, focus restoration and unchanged layout after target/latest-block wording correction and short block-appearance motion. Screenshots inspected at1280×800 and360×800. Existing production Ethereum and XRPL full regressions pass. Production deployment remains gated on this candidate's successful Actions run.

## Production result

Candidate518f48c6b74e0b98747be42cf7bc44979efdf2c4 passed Actions41317714219 before main update. Existing LOCAL_GIT broker deployed successfully, health200/SHA match, prior28d3b2c retained. Real production TRON all3 full36-second plays,4 viewports,network switching,KPI/SR history/parent/solid synchronization,keyboard focus and reduced motion pass. Frame p95≤16.8ms in this headless sample. CollectorPID69372 unchanged. Evidence `docs/design/knowledge/production-tron/verification.json`. Ethereum production Epoch3,consensus3 andtransaction2 full-scenario checks also pass; no runtime fixes were needed for them.
