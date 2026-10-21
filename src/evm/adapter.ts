import { getAddress } from 'viem';
import type { ReadOnlyAdapter, ReadOnlyAssessmentRequest } from '../domain/adapter.js';
import { assessEvm } from './assessment.js';
import { Rpc } from './rpc.js';
export interface EvmReadOnlyAssessmentRequest extends ReadOnlyAssessmentRequest { spenderAddress?: string }

export class EvmReadOnlyAdapter implements ReadOnlyAdapter {
  readonly chainFamily = 'EVM' as const;
  constructor(private readonly rpcUrl: string, private readonly rpcFactory = (url: string): Rpc => new Rpc(url)) {}
  async assessReadOnly(request: EvmReadOnlyAssessmentRequest) {
    if (request.currencyCode !== undefined) throw new Error('Currency code requires XRPL.');
    if (request.spenderAddress !== undefined && (request.accountAddress === undefined || request.accountAddress === '' || request.spenderAddress === '')) throw new Error('Allowance requires owner and spender addresses.');
    const holder = request.accountAddress ? getAddress(request.accountAddress) : undefined;
    const spender = request.spenderAddress === undefined ? undefined : getAddress(request.spenderAddress);
    // A new evidence namespace per request also isolates concurrent calls.
    return assessEvm(this.rpcFactory(this.rpcUrl), request.networkId, request.assetAddress, 'baseline', undefined, holder, spender);
  }
}
