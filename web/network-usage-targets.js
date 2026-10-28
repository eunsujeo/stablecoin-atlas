// Reviewed registered scope, not a provider/issuer support certification.
export const registeredUsageTargets=Object.freeze([
 {
  "deploymentId": "usdt-tron",
  "coinId": "usdt",
  "networkId": "tron",
  "chain": "tron",
  "reason": null
 },
 {
  "deploymentId": "usdt-ethereum",
  "coinId": "usdt",
  "networkId": "ethereum",
  "chain": "ethereum",
  "reason": null
 },
 {
  "deploymentId": "usdt-bsc",
  "coinId": "usdt",
  "networkId": "bsc",
  "chain": "bsc",
  "reason": null
 },
 {
  "deploymentId": "usdt-solana",
  "coinId": "usdt",
  "networkId": "solana",
  "chain": "solana",
  "reason": null
 },
 {
  "deploymentId": "usdt-arbitrum",
  "coinId": "usdt",
  "networkId": "arbitrum",
  "chain": "arbitrum_one",
  "reason": null
 },
 {
  "deploymentId": "usdt-polygon",
  "coinId": "usdt",
  "networkId": "polygon",
  "chain": "polygon",
  "reason": null
 },
 {
  "deploymentId": "usdt-plasma",
  "coinId": "usdt",
  "networkId": "plasma",
  "chain": "plasma",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "usdt-ton",
  "coinId": "usdt",
  "networkId": "ton",
  "chain": "ton",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "usdt-aptos",
  "coinId": "usdt",
  "networkId": "aptos",
  "chain": "aptos",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "usdt-mantle",
  "coinId": "usdt",
  "networkId": "mantle",
  "chain": "mantle",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "usdc-ethereum",
  "coinId": "usdc",
  "networkId": "ethereum",
  "chain": "ethereum",
  "reason": null
 },
 {
  "deploymentId": "usdc-solana",
  "coinId": "usdc",
  "networkId": "solana",
  "chain": "solana",
  "reason": null
 },
 {
  "deploymentId": "usdc-hyperliquid-l1",
  "coinId": "usdc",
  "networkId": "hyperliquid-l1",
  "chain": "hyperliquid-l1",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "usdc-base",
  "coinId": "usdc",
  "networkId": "base",
  "chain": "base",
  "reason": null
 },
 {
  "deploymentId": "usdc-arbitrum",
  "coinId": "usdc",
  "networkId": "arbitrum",
  "chain": "arbitrum_one",
  "reason": null
 },
 {
  "deploymentId": "usdc-polygon",
  "coinId": "usdc",
  "networkId": "polygon",
  "chain": "polygon",
  "reason": null
 },
 {
  "deploymentId": "usdc-bsc",
  "coinId": "usdc",
  "networkId": "bsc",
  "chain": "bsc",
  "reason": null
 },
 {
  "deploymentId": "usdc-arc",
  "coinId": "usdc",
  "networkId": "arc",
  "chain": "arc",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "usdc-avalanche",
  "coinId": "usdc",
  "networkId": "avalanche",
  "chain": "avalanche",
  "reason": null
 },
 {
  "deploymentId": "usdc-stellar",
  "coinId": "usdc",
  "networkId": "stellar",
  "chain": "stellar",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "usdc-xrpl",
  "coinId": "usdc",
  "networkId": "xrpl",
  "chain": "xrpl",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "rlusd-ethereum",
  "coinId": "rlusd",
  "networkId": "ethereum",
  "chain": "ethereum",
  "reason": null
 },
 {
  "deploymentId": "rlusd-xrpl",
  "coinId": "rlusd",
  "networkId": "xrpl",
  "chain": "xrpl",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "rlusd-base",
  "coinId": "rlusd",
  "networkId": "base",
  "chain": "base",
  "reason": "EXACT_ADDRESS_NOT_AVAILABLE"
 },
 {
  "deploymentId": "rlusd-ink",
  "coinId": "rlusd",
  "networkId": "ink",
  "chain": "ink",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "rlusd-optimism",
  "coinId": "rlusd",
  "networkId": "optimism",
  "chain": "optimism",
  "reason": "EXACT_ADDRESS_NOT_AVAILABLE"
 },
 {
  "deploymentId": "rlusd-unichain",
  "coinId": "rlusd",
  "networkId": "unichain",
  "chain": "unichain",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "rlusd-xrpl-evm",
  "coinId": "rlusd",
  "networkId": "xrpl-evm",
  "chain": "xrpl-evm",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "jpyc-ethereum",
  "coinId": "jpyc",
  "networkId": "ethereum",
  "chain": "ethereum",
  "reason": null
 },
 {
  "deploymentId": "jpyc-polygon",
  "coinId": "jpyc",
  "networkId": "polygon",
  "chain": "polygon",
  "reason": null
 },
 {
  "deploymentId": "jpyc-avalanche",
  "coinId": "jpyc",
  "networkId": "avalanche",
  "chain": "avalanche",
  "reason": null
 },
 {
  "deploymentId": "jpyc-kaia",
  "coinId": "jpyc",
  "networkId": "kaia",
  "chain": "kaia",
  "reason": "CHAIN_NOT_LISTED"
 },
 {
  "deploymentId": "jpysc-ethereum",
  "coinId": "jpysc",
  "networkId": "ethereum",
  "chain": "ethereum",
  "reason": null
 }
].map(t=>Object.freeze(t)));
export const expandedUsageTargets=Object.freeze(registeredUsageTargets.filter(t=>t.reason===null));
