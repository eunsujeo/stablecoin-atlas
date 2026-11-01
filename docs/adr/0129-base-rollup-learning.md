# 0129 — Base rollup learning, explicit L1 inputs and bridge gates

2026-11-02 · fifth independent learning network, within the user's autonomous development/deployment policy.

Keep the Atlas player, layout, pacing, inspection and exact public asset allowlist. Add a pure Base model and an L1/L2 renderer. No Ethereum validator/slot model is reused for L2. Synthetic hashes, transactions, heights and explicit observations drive deterministic seek/rewind. Normal, sequencer outage/recovery, publication delay, local derivation delay, L1 publication reorg, unsafe replacement, deposit, single-proof withdrawal, dual-proof withdrawal and invalid-claim challenge are independent scenarios.

Protocol version is explicit: Base Mainnet before Denim. Official Denim status on the review date is Sepolia live (October 21) and Mainnet planning (November); canonical 200ms blocks are therefore not presented as active Mainnet. Flashblocks preconfirmations (~200ms) remain distinct from full L2 blocks (~2s). The current Azul/Beryl proof system is used instead of describing historical OP binary fault games as the current implementation. Single-proof game resolution window is 5 days, TEE+ZK is 1 day; a ZK challenge starts its separate 7-day window. These are game windows, not guaranteed end-to-end withdrawal times.

Safe requires canonical L1 inputs plus successful derivation. Finalized additionally requires a matching L1 finality input; elapsed presentation time alone is insufficient. Publication-block reorg can remove Safe evidence without changing L2 hashes when the origin remains valid. Conflicting unsafe payloads are replaced by canonical derivation, preserving the prior finalized boundary. L1 origin and publication location are distinct.

Batch data, output-root claim, message inclusion proof and L1 finalization transaction have separate events. Withdrawal eligibility requires valid/resolved claim, elapsed game window, proof maturity, registry game finality and non-paused/non-blacklisted conditions. Synthetic gate observations are not current onchain configuration values. An invalid claim blocks withdrawal without rolling back the finalized Base chain. Deposit events enter derivation separately from batches and withdrawal games.

Scope excludes actual EVM execution, cryptography, channel compression, a complete derivation pipeline, long-outage sequencing-window recovery, guardian actions and live network RPC. No funds or network transactions are involved. Existing APIs, collector, FX, database and deployment/security configuration are unchanged.

Sources and reproducible checks: `docs/research/2026-11-02-base-learning.md`. Router architecture submission failed before a request ID with `agent_not_found`; no review or delegated implementation is claimed. Use the existing learning branch CI then fast-forward the same successful SHA to main and verify the LOCAL_GIT deployment.
