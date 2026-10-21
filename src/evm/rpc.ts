import { JsonRpc, JsonRpcError } from '../rpc/json-rpc.js';
export class RpcError extends JsonRpcError {
  readonly reverted: boolean;
  constructor(code: number, message: string, reverted = false) {
    super(code, message); this.reverted = code === 3 || reverted;
  }
  override get category(): 'REVERT' | 'RPC_ERROR' { return this.reverted ? 'REVERT' : 'RPC_ERROR'; }
}
export class Rpc extends JsonRpc {
  protected override failure(code: number, upstreamMessage: string): RpcError {
    const reverted = code === 3 || ([-32000, -32015, -32603].includes(code)
      && /^execution reverted\b/i.test(upstreamMessage.trim()));
    return new RpcError(code, `${reverted ? 'Execution reverted' : 'RPC error'} (code ${code})`, reverted);
  }
  async pin(): Promise<string> {
    this.block = 'UNKNOWN';
    const invalid = (reason: 'INVALID_BLOCK_NUMBER' | 'INVALID_BLOCK_HEADER'): never => {
      this.record('BLOCK_REFERENCE_ERROR', { reason });
      throw new Error('Invalid RPC block reference.');
    };
    const block = await this.request<unknown>('eth_blockNumber');
    if (!isQuantity(block)) return invalid('INVALID_BLOCK_NUMBER');
    const raw = await this.request<unknown>('eth_getBlockByNumber', [block, false]);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid('INVALID_BLOCK_HEADER');
    const header = raw as Record<string, unknown>;
    if (!isQuantity(header.number) || BigInt(header.number) !== BigInt(block)
      || typeof header.hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(header.hash)) return invalid('INVALID_BLOCK_HEADER');
    this.block = BigInt(block).toString();
    this.record('BLOCK_REFERENCE', { number: this.block, hash: header.hash });
    return block;
  }
}

function isQuantity(value: unknown): value is string {
  return typeof value === 'string' && /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value);
}
export function isRevert(error: unknown): error is RpcError {
  return error instanceof RpcError && error.reverted;
}
