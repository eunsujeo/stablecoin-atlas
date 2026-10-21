import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import solc from 'solc';
export const compilerPin: { version:string;file:string;sha256:string;manifestCommit:string } =
  JSON.parse(readFileSync(new URL('../../../data/tron-compiler-pin.json',import.meta.url),'utf8'));
export const sha256 = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
export const tronFixtures = {
  standard: { sourceFile: 'TronStandardToken.sol', contractName: 'TronStandardToken' },
  'false-return': { sourceFile: 'TronNegativeTokens.sol', contractName: 'TronFalseReturnToken' },
  'malformed-return': { sourceFile: 'TronNegativeTokens.sol', contractName: 'TronMalformedReturnToken' },
  'missing-event': { sourceFile: 'TronNegativeTokens.sol', contractName: 'TronMissingEventToken' },
} as const;
export type TronFixture = keyof typeof tronFixtures;
export async function compileTronFixture(variant: TronFixture = 'standard') {
  if (!Object.hasOwn(tronFixtures, variant)) throw new Error('FIXTURE_VARIANT_REJECTED');
  return compileSelection(tronFixtures[variant], variant);
}
export const tronAllowanceProbes = {
  standard: { contractName: 'TronAllowanceControl', operation: 'both', defect: 'none' },
  'approve-false': { contractName: 'TronApproveFalse', operation: 'approve', defect: 'false' },
  'approve-malformed': { contractName: 'TronApproveMalformed', operation: 'approve', defect: 'malformed' },
  'approve-missing-event': { contractName: 'TronApproveMissingEvent', operation: 'approve', defect: 'missing-event' },
  'approve-wrong-allowance': { contractName: 'TronApproveWrongAllowance', operation: 'approve', defect: 'wrong-allowance' },
  'delegated-false': { contractName: 'TronDelegatedFalse', operation: 'transferFrom', defect: 'false' },
  'delegated-malformed': { contractName: 'TronDelegatedMalformed', operation: 'transferFrom', defect: 'malformed' },
  'delegated-missing-event': { contractName: 'TronDelegatedMissingEvent', operation: 'transferFrom', defect: 'missing-event' },
  'delegated-wrong-allowance': { contractName: 'TronDelegatedWrongAllowance', operation: 'transferFrom', defect: 'wrong-allowance' },
} as const;
for (const spec of Object.values(tronAllowanceProbes)) Object.freeze(spec);
Object.freeze(tronAllowanceProbes);
export type TronAllowanceProbe = keyof typeof tronAllowanceProbes;
export async function compileTronAllowanceProbe(variant: TronAllowanceProbe) {
  if (!Object.hasOwn(tronAllowanceProbes, variant)) throw new Error('FIXTURE_VARIANT_REJECTED');
  return compileSelection({ sourceFile: 'TronAllowanceProbes.sol', contractName: tronAllowanceProbes[variant].contractName }, variant);
}
async function compileSelection(selection: { sourceFile: string; contractName: string }, variant: string) {
  const directory = resolve('.state/tron-compiler'); await mkdir(directory, { recursive: true });
  const path = resolve(directory, 'tron-0.8.26.cjs'); let bytes: Buffer;
  try { bytes = await readFile(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('COMPILER_READ_FAILED');
    const response = await fetch('https://tronprotocol.github.io/solc-bin/wasm/' + compilerPin.file,
      { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('COMPILER_DOWNLOAD_FAILED');
    const reader = response.body!.getReader(), parts: Uint8Array[] = []; let size = 0;
    try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
      if (size > 32 * 1024 * 1024) throw new Error('COMPILER_TOO_LARGE'); parts.push(part.value); }
    } finally { await reader.cancel(); }
    bytes = Buffer.concat(parts);
    if (sha256(bytes) !== compilerPin.sha256) throw new Error('COMPILER_HASH_MISMATCH');
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
  }
  if (sha256(bytes) !== compilerPin.sha256) throw new Error('COMPILER_HASH_MISMATCH');
  const compiler = solc.setupMethods(createRequire(import.meta.url)(path));
  if (!String(compiler.version()).startsWith(compilerPin.version)) throw new Error('COMPILER_VERSION_MISMATCH');
  const source = await readFile(new URL('../../../fixtures/' + selection.sourceFile, import.meta.url), 'utf8');
  const settings = { optimizer: { enabled: false, runs: 200 }, evmVersion: 'istanbul',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } };
  const output = JSON.parse(compiler.compile(JSON.stringify({ language: 'Solidity', sources: { [selection.sourceFile]: { content: source } }, settings })));
  if (output.errors?.some((e: { severity: string }) => e.severity === 'error')) throw new Error('FIXTURE_COMPILE_FAILED');
  const contract = output.contracts[selection.sourceFile][selection.contractName];
  return { abi: contract.abi as any[], bytecode: contract.evm.bytecode.object as string,
    runtimeBytecode: contract.evm.deployedBytecode.object as string,
    build: { ...compilerPin, ...selection, variant, abiSha256: sha256(JSON.stringify(contract.abi)), reportedVersion: String(compiler.version()), sourceSha256: sha256(source), settings,
      bytecodeSha256: sha256(Buffer.from(contract.evm.bytecode.object, 'hex')), runtimeBytecodeSha256: sha256(Buffer.from(contract.evm.deployedBytecode.object, 'hex')) } };
}
