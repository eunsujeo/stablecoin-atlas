# Solana learning — protocol research and release record

## Official review, 2026-11-01

[Solana Foundation Alpenglow upgrade](https://solana.com/upgrades/alpenglow) reports Votor active on mainnet since epoch1064,2026-10-21. [Anza commitments](https://docs.anza.xyz/consensus/commitments) distinguishes legacy TowerBFT from Alpenglow: confirmed and finalized are equivalent under Alpenglow. Do not teach31-descendant Tower finality as current consensus. Official Foundation page also distinguishes200ms slots from approximate150ms expected finality, and Votor from not-yet-shipped Rotor. These are documentation statements, not Atlas RPC observations.

[SIMD0326](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0326-alpenglow.md) specifies direct validator messages, stake-weighted certificates,80% first-round fast finalization, and60% notarization plus60% finalization certificates for the second-round route. A skip certificate combines60% skip/skip-fallback votes. A notarization certificate alone is not finality. Votes are scoped to slot/block/type, duplicates and unrelated hashes must not contribute. Full fallback safety predicates, adversarial execution, signature aggregation, admission, rewards and fork exploration are outside this first focused teaching model.

## Planned scenes

Fixed educational leader → transaction execution → shreds/replay → direct NotarVote → certificate → finalized parent chain. Independent scenarios: fast normal route, slower two-round route, insufficient participating stake, unavailable leader/skip certificate and subsequent leader recovery. Five validators with unequal weights30/25/20/15/10 illustrate stake rather than headcount. Pacing uses36 seconds independently of protocol latency. No chain API, keys, DB or operational collection changes.

## Implementation and review

Independent pure `solanaState` and `solanaCertificates`, plus own renderer, reused existing player/KPI/detail/layout. Wrong slot/hash, outsiders, unauthenticated flags, duplicate weight and conflicting first-round messages do not inflate certificates. Slow path requires both certificates. Skip recovery is conditional on observed skip certificate, never elapsed time alone. Block7001 references parent7000 even after skipped8000. Offline55% leaves45% despite3 participating validators. UI explicitly explains why second-round Final can remain0% on the fast path.

Initial implementation review found the slow-path producer was also marked offline; corrected its scheduled leader to V01 before testing. Mobile certificate labels moved upward inside their borders. Second-round messages now animate individually; shreds and votes use separate arrival times. All data is synthetic, signature=true means authenticated fixture input, not cryptographic verification. Browser tests assert exact model/DOM votes, certificates, block hash/parent and finality, plus shared controls. No-JS summaries added for all chains.

Reproduce with `node --test tests/knowledge-*.test.mjs`, `npm run check`, loopback preview, and `KNOWLEDGE_CHAIN=solana node tools/knowledge-browser-check.mjs`. Official-link access is user initiated; runtime performs no chain or provider requests.

## Local verification gate

Full `npm run check` exit0:876 main+74 archived=950passed,0fail,8pre-existing compiler skips. Final focused Ethereum+multichain tests68/68pass. Four Solana full36-second plays pass,frame p95≤16.8ms in headless Chrome.4 viewport render/rewind/KPI/parents/votes/certificates/control/speed/keyboard/reduced-motion checks pass. Final render rerun includes second-round motion, adjusted mobile certificate labels and scope explanation. Desktop1280×800/mobile360screens inspected. No clipping or desktop scroll; mobile keeps natural vertical layout. CI must pass this candidate before main/production.
