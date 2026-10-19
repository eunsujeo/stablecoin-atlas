import { getAddress } from 'viem';
import type { ReadOnlyAdapter, ReadOnlyAssessmentRequest } from '../domain/adapter.js';
import { assessEvm } from './assessment.js';
import { Rpc } from './rpc.js';

export class EvmReadOnlyAdapter implements ReadOnlyAdapter {
  readonly chainFamily = 'EVM' as const;
  constructor(private readonly rpcUrl: string) {}
  async assessReadOnly(request: ReadOnlyAssessmentRequest) {
    const holder = request.accountAddress ? getAddress(request.accountAddress) : undefined;
    // A new evidence namespace per request also isolates concurrent calls.
    return assessEvm(new Rpc(this.rpcUrl), request.networkId, request.assetAddress, 'baseline', undefined, holder);
  }
}
