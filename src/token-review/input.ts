import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Ajv } from 'ajv';
import { getAddress } from 'viem';
import type { ReviewConfig } from './model.js';

const address = { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' };
const text = { type: 'string', minLength: 1, maxLength: 200 };
export const configSchema = {
  type: 'object', additionalProperties: false, required: ['schemaVersion', 'network', 'token'], properties: {
    schemaVersion: { const: 'TokenReviewConfig1.0' },
    network: { type: 'object', additionalProperties: false, required: ['chainId'], properties: {
      chainId: { type: 'string', pattern: '^[1-9][0-9]{0,77}$' },
      blockNumber: { type: 'string', pattern: '^(0|[1-9][0-9]{0,19})$' },
    } },
    token: { type: 'object', additionalProperties: false, required: ['address'], properties: { address, label: text } },
    dependencies: { type: 'array', maxItems: 8, uniqueItems: true, items: address },
    sources: { type: 'array', maxItems: 8, items: {
      type: 'object', additionalProperties: false, required: ['address', 'contract', 'compilerVersion', 'inputFile'],
      properties: { address, contract: text, compilerVersion: text, inputFile: { ...text, maxLength: 1024 } },
    } },
    audits: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false, required: ['file'],
      properties: { file: { ...text, maxLength: 1024 }, title: text, publisher: text, reference: { ...text, maxLength: 1024 },
        declaredTarget: { type: 'object', additionalProperties: false, properties: { version: text, commit: text,
          scope: { type: 'array', maxItems: 32, items: text } } } } } },
    probes: { type: 'array', maxItems: 24, items: {
      type: 'object', additionalProperties: false, required: ['id', 'address', 'signature', 'args'],
      properties: { id: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,64}$' }, address,
        signature: { ...text, maxLength: 512 }, args: { type: 'array', maxItems: 8,
          items: { anyOf: [{ type: 'string', maxLength: 512 }, { type: 'boolean' }] } } },
    } },
  },
};
const validate = new Ajv({ strict: true }).compile(configSchema);
export const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');

// Files are explicitly supplied by the operator; their content cannot request additional files.
export async function readBounded(path: string, limit: number): Promise<Buffer> {
  const handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    if (!(await handle.stat()).isFile()) throw new Error('INVALID_LOCAL_INPUT');
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = await handle.read(buffer, length, buffer.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length > limit) throw new Error('LOCAL_INPUT_LIMIT');
    return buffer.subarray(0, length);
  } finally { await handle.close(); }
}
export function parseConfig(bytes: Buffer): ReviewConfig {
  const config: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!validate(config)) throw new Error('INVALID_CONFIG');
  const result = config as unknown as ReviewConfig;
  result.token.address = getAddress(result.token.address);
  result.dependencies = (result.dependencies ?? []).map(a => getAddress(a));
  if (new Set(result.dependencies).size !== result.dependencies.length) throw new Error('DUPLICATE_DEPENDENCY');
  for (const s of result.sources ?? []) s.address = getAddress(s.address);
  for (const p of result.probes ?? []) p.address = getAddress(p.address);
  if (new Set((result.sources ?? []).map(s => s.address)).size !== (result.sources ?? []).length
    || new Set((result.probes ?? []).map(p => p.id)).size !== (result.probes ?? []).length) throw new Error('DUPLICATE_CONFIG_ENTRY');
  for (const a of result.audits ?? []) if (a.reference) {
    const url = new URL(a.reference);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('INVALID_DOCUMENT_REFERENCE');
  }
  return result;
}
export const relativeInput = (configFile: string, input: string): string => resolve(dirname(configFile), input);
