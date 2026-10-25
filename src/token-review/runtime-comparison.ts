import { keccak256, type Hex } from 'viem';
import type { CompileResult } from './compiler.js';
import { usdtCompiler } from './compiler-cache.mjs';

export interface RuntimeComparison {
  kind: 'RAW_RUNTIME' | 'SUBMITTED_IMMUTABLE_VALUES'; matched: boolean | null; reason: string;
  originalRuntime: string; reconstructedRuntime: string | null;
  immutableValues: Record<string, string>; ranges: { id: string; start: number; length: number }[];
  runtimeHash: string | null; evidenceRef: string;
}
// Never mask deployed bytes or infer values from them. Submitted immutable values remain
// unproven constructor claims, even when the reconstructed bytes match in their entirety.
export function compareRuntime(runtime: NonNullable<CompileResult['selected']>['evm']['deployedBytecode'], observedHash: string | undefined,
  values: Record<string, string> = {}, compiler?: string): Omit<RuntimeComparison, 'evidenceRef'> {
  const result: Omit<RuntimeComparison, 'evidenceRef'> = { kind: 'RAW_RUNTIME', matched: null, reason: 'RUNTIME_UNAVAILABLE',
    originalRuntime: `0x${runtime.object}`, reconstructedRuntime: null, immutableValues: values, ranges: [], runtimeHash: null };
  const invalid = () => ({ ...result, reason: 'INVALID_RELOCATION_DATA' });
  if (runtime.object.length % 2 || !runtime.object.length) return result;
  const size = runtime.object.length / 2;
  const ranges: { id: string; start: number; length: number; immutable: boolean }[] = [];
  function offsets(value: unknown, id: string, immutable: boolean): boolean {
    if (!Array.isArray(value) || !value.length || value.length > 256) return false;
    for (const v of value) {
      if (!v || typeof v !== 'object' || Object.keys(v).some(k => !['start', 'length'].includes(k))) return false;
      const r = v as { start: number; length: number };
      if (!Number.isSafeInteger(r.start) || !Number.isSafeInteger(r.length) || r.start < 0 || r.length !== (immutable ? 32 : 20) || r.start + r.length > size) return false;
      ranges.push({ ...r, id, immutable });
      if (ranges.length > 512) return false;
    }
    return true;
  }
  // This pinned pre-immutable compiler omits the field. Interpret only genuine
  // absence; preserve the original output and reject explicitly malformed data.
  const immutableReferences = compiler === usdtCompiler.version && !Object.hasOwn(runtime, 'immutableReferences')
    ? {} : runtime.immutableReferences;
  if (!immutableReferences || typeof immutableReferences !== 'object' || Array.isArray(immutableReferences)
    || !runtime.linkReferences || typeof runtime.linkReferences !== 'object' || Array.isArray(runtime.linkReferences)) return invalid();
  for (const [id, value] of Object.entries(immutableReferences)) if (!/^[1-9][0-9]*$/.test(id) || !offsets(value, id, true)) return invalid();
  for (const [file, libraries] of Object.entries(runtime.linkReferences)) {
    if (!libraries || typeof libraries !== 'object' || Array.isArray(libraries)) return invalid();
    for (const [name, value] of Object.entries(libraries)) if (!offsets(value, `${file}:${name}`, false)) return invalid();
  }
  ranges.sort((a, b) => a.start - b.start);
  if (ranges.some((r, i) => i > 0 && ranges[i - 1]!.start + ranges[i - 1]!.length > r.start)) return invalid();
  result.ranges = ranges.filter(r => r.immutable).map(({ id, start, length }) => ({ id, start, length }));
  if (ranges.some(r => !r.immutable)) return { ...result, reason: 'UNRESOLVED_LIBRARY_LINKS' };
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(runtime.object)) return invalid();
  const ids = Object.keys(immutableReferences).sort(), supplied = Object.keys(values).sort();
  if (ids.length) result.kind = 'SUBMITTED_IMMUTABLE_VALUES';
  if (JSON.stringify(ids) !== JSON.stringify(supplied)) return { ...result, reason: 'IMMUTABLE_VALUES_MISSING_OR_EXTRA' };
  let completed = runtime.object;
  for (const r of result.ranges) {
    const value = values[r.id];
    if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value) || !/^0+$/.test(runtime.object.slice(r.start * 2, (r.start + r.length) * 2))) return invalid();
    completed = completed.slice(0, r.start * 2) + value.slice(2) + completed.slice((r.start + r.length) * 2);
  }
  result.reconstructedRuntime = `0x${completed}`;
  result.runtimeHash = keccak256(result.reconstructedRuntime as Hex);
  result.matched = observedHash === undefined ? null : observedHash.toLowerCase() === result.runtimeHash.toLowerCase();
  result.reason = result.matched === null ? 'ADDRESS_NOT_OBSERVED' : !result.matched ? 'RUNTIME_MISMATCH'
    : result.kind === 'RAW_RUNTIME' ? 'EXACT_RUNTIME_PENDING_CHAIN_RECHECK' : 'SUBMITTED_IMMUTABLE_RUNTIME_MATCH_CONSTRUCTOR_UNPROVEN';
  return result;
}
