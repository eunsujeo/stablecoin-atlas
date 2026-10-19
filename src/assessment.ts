import type { Address } from 'viem';
import type { AssessmentReport, Profile } from './domain/model.js';
import { EvmReadOnlyAdapter } from './evm/adapter.js';
import { assessEvm } from './evm/assessment.js';
import type { Actors } from './evm/scenarios.js';
import type { Rpc } from './evm/rpc.js';

// Preserve the existing CLI/library input shape at this boundary.
export async function assessReadOnly(input: { rpcUrl: string; networkId: string; token: string; holder?: string }): Promise<AssessmentReport> {
  return new EvmReadOnlyAdapter(input.rpcUrl).assessReadOnly({
    networkId: input.networkId, assetAddress: input.token,
    ...(input.holder ? { accountAddress: input.holder } : {}),
  });
}
export async function assessFixture(rpc: Rpc, token: Address, actors: Actors, profile: Profile = 'baseline'): Promise<AssessmentReport> {
  return assessEvm(rpc, '31337', token, profile, actors);
}
