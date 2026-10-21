// Research-only comparison of compiler deployed runtime and saved RPC bytes.
// Neither a metadata-excluded match nor an exact match establishes authority.
function bytes(hex: string): Buffer {
  if (!/^0x(?:[a-fA-F0-9]{2})+$/.test(hex)) throw new Error('Invalid runtime hex');
  return Buffer.from(hex.slice(2), 'hex');
}

// Deliberately limited to documented Solidity release metadata fields. Unknown
// CBOR forms are retained as UNKNOWN; they are never stripped speculatively.
function metadataBody(code: Buffer): Buffer | undefined {
  if (code.length < 3) return undefined;
  const size = code.readUInt16BE(code.length - 2), start = code.length - 2 - size;
  if (size === 0 || start < 0) return undefined;
  const cbor = code.subarray(start, code.length - 2);
  let cursor = 0;
  const next = () => {
    if (cursor >= cbor.length) throw new Error('Truncated CBOR');
    return cbor[cursor++]!;
  };
  const length = (type: number) => {
    const first = next();
    if (first >> 5 !== type) throw new Error('Unexpected CBOR type');
    const short = first & 31;
    if (short < 24) return short;
    if (short === 24) return next();
    if (short === 25) return next() * 256 + next();
    throw new Error('Unsupported CBOR length');
  };
  const take = (size: number) => {
    if (cursor + size > cbor.length) throw new Error('Truncated CBOR value');
    const value = cbor.subarray(cursor, cursor + size); cursor += size; return value;
  };
  try {
    const count = length(5), seen = new Set<string>();
    for (let i = 0; i < count; i++) {
      const key = take(length(3)).toString('utf8');
      if (seen.has(key)) return undefined;
      seen.add(key);
      if (key === 'experimental') {
        if (![0xf4, 0xf5].includes(next())) return undefined;
      } else {
        const value = take(length(2));
        if (key === 'solc') { if (value.length !== 3) return undefined; }
        else if (key === 'ipfs') { if (value.length !== 34 || value[0] !== 0x12 || value[1] !== 0x20) return undefined; }
        else if (key === 'bzzr0' || key === 'bzzr1') { if (value.length !== 32) return undefined; }
        else return undefined;
      }
    }
    if (!seen.has('solc') || cursor !== cbor.length) return undefined;
    return code.subarray(0, start);
  } catch { return undefined; }
}

export function compareRuntime(observed: string, candidate: string) {
  const a = bytes(observed), b = bytes(candidate);
  const bodyA = metadataBody(a), bodyB = metadataBody(b);
  return {
    exactRuntime: a.equals(b) ? 'EXACT_MATCH' : 'MISMATCH',
    metadataExcluded: bodyA && bodyB ? (bodyA.equals(bodyB) ? 'MATCH' : 'MISMATCH') : 'UNKNOWN',
    observedBytes: a.length, candidateBytes: b.length,
    observedBodyBytes: bodyA?.length ?? 'UNKNOWN', candidateBodyBytes: bodyB?.length ?? 'UNKNOWN',
  };
}

export function compiledRuntime(output: any, sourceUnit: string, contract: string): string {
  if ((output.errors ?? []).some((e: any) => e.severity === 'error')) throw new Error('Compiler errors');
  const runtime = output.contracts?.[sourceUnit]?.[contract]?.evm?.deployedBytecode;
  if (!runtime) throw new Error('Missing exact compilation target');
  const linked = Object.values(runtime.linkReferences ?? {}).some((libs: any) => Object.values(libs).some((refs: any) => refs.length > 0));
  if (linked || Object.values(runtime.immutableReferences ?? {}).some((refs: any) => refs.length > 0)) throw new Error('Unresolved runtime references');
  const hex = '0x' + runtime.object; bytes(hex); return hex;
}

export function compareVerificationRuntime(record: any, expected: { networkId: string; address: string }, observed: string) {
  if (record.chainId !== expected.networkId || typeof record.address !== 'string'
    || record.address.toLowerCase() !== expected.address.toLowerCase()) throw new Error('Verification identity mismatch');
  const runtime = record.runtimeBytecode;
  if (!runtime) throw new Error('Missing verification runtime');
  const serviceOnchain = compareRuntime(observed, runtime.onchainBytecode);
  if (serviceOnchain.exactRuntime !== 'EXACT_MATCH') throw new Error('Verification onchain bytes differ from saved observation');
  return {
    serviceClaim: typeof record.runtimeMatch === 'string' ? record.runtimeMatch : 'UNKNOWN',
    serviceOnchain,
    serviceRecompiled: compareRuntime(observed, runtime.recompiledBytecode),
    serviceReportsMetadataReplacement: Array.isArray(runtime.transformations)
      && runtime.transformations.some((t: any) => t.type === 'replace' && t.reason === 'cborAuxdata'),
    scope: 'THIRD_PARTY_CLAIM_AND_UNTRANSFORMED_BYTE_COMPARISONS',
  };
}
