import { RpcError } from './evm/rpc.js';
import { JsonRpcError } from './rpc/json-rpc.js';

const localMessages = new Set([
  'lab accepts only --profile and --out', 'Unknown profile', 'assess uses the read-only baseline profile',
  'Provide --network positive chain-id and --token address', 'Set RPC_URL in the environment',
  'Unknown command. Use --help.', 'Invalid RPC URL.', 'RPC must use HTTP(S).',
  'RPC transport/protocol failure', 'Token address has no contract code.',
  'Invalid RPC block reference.',
  'Cannot start Anvil. Install Foundry and ensure anvil is on PATH.', 'Cannot allocate local port',
  'Anvil startup timed out', 'Unexpected local server', 'Unexpected local chain',
  'Need three isolated fixture accounts', 'Failed to restore scenario snapshot',
  'Receipt timeout; execution outcome unknown',
  'Report output must be a regular file path.', 'Could not save report; details omitted.',
  'Report saved, but temporary cleanup failed.',
  'Set TRON_RPC_URL in the environment', 'Unknown chain. Use evm or tron.',
  'Set SOLANA_RPC_URL in the environment', 'Unknown chain. Use evm, tron or solana.',
  'Invalid Solana token account address.', 'Invalid XRPL holder address.', '--token-account requires --chain solana.',
  'Solana requires --token-account instead of --holder.', 'XRPL accepts issuer, currency and optional holder.',
  'Invalid Solana network reference.', 'Solana holder queries are not implemented.',
  'Solana mint is outside the supported read-only set.',
  'Set XRPL_RPC_URL in the environment', 'Unknown chain. Use evm, tron, solana or xrpl.',
  'Issuer and currency options require XRPL.', 'Currency code requires XRPL.',
  'Invalid XRPL network reference.', 'XRPL accepts issuer and currency only.',
  'Unsupported XRPL currency and issuer pair.', 'XRPL holder queries are not implemented.',
  'Invalid TRON address.', 'Invalid TRON network id.', 'Invalid TRON head reference.',
  'Unsupported TRON read method.', 'TRON spender requires holder.', '--spender requires --chain tron.',
]);

// Never interpolate arbitrary exception text, causes, stack, input or endpoint fragments.
export function commandErrorMessage(error: unknown): string {
  try { return trustedMessage(error); }
  catch { return 'Unexpected command failure; details omitted.'; }
}

function trustedMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Unexpected command failure; details omitted.';
  if (error instanceof RpcError && Number.isSafeInteger(error.code)) {
    return `${error.reverted ? 'Execution reverted' : 'RPC error'} (code ${error.code})`;
  }
  if (error instanceof JsonRpcError && Number.isSafeInteger(error.code)) return `RPC error (code ${error.code})`;
  if (error.name === 'InvalidAddressError') return 'Invalid address input.';
  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === 'string' && code.startsWith('ERR_PARSE_ARGS_')) return 'Invalid command options. Use --help.';
  if (localMessages.has(error.message) || /^HTTP [1-5][0-9]{2}$/.test(error.message)
    || /^Network mismatch: expected [1-9][0-9]*, observed [0-9]+$/.test(error.message)) return error.message;
  return 'Unexpected command failure; details omitted.';
}
