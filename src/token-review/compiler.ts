import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import { cachedCompiler, inspectCachedCompiler, stageCachedCompiler } from './compiler-cache.mjs';

export const compilerVersion = String(solc.version());
export async function compilerProfile(version: string): Promise<{ id: string; version: string; sha256: string | null } | null> {
  if (version === compilerVersion) return { id: 'installed-solc', version, sha256: null };
  if (version !== cachedCompiler.version) return null;
  return await inspectCachedCompiler();
}
export type AstNode = { nodeType: string; id: number; src: string; [key: string]: unknown };
export interface CompileResult {
  compiler: string;
  errors: { severity: string; code: string | null }[];
  sources: Record<string, { id: number; ast: AstNode }>;
  selected: { abi: { type: string; name?: string; inputs?: { type: string }[]; outputs?: { type: string }[] }[];
    evm: { deployedBytecode: { object: string; immutableReferences: Record<string, unknown>; linkReferences: Record<string, unknown> } } } | null;
}
export interface CompilerInput { language: 'Solidity'; sources: Record<string, { content: string }>; settings: Record<string, unknown> }
export function prepareSourceBundle(bytes: Buffer): CompilerInput {
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('INVALID_COMPILER_INPUT');
  const value = parsed as Record<string, unknown>;
  if (Object.keys(value).some(k => !['language', 'sources', 'settings'].includes(k)) || value.language !== 'Solidity'
    || !value.sources || typeof value.sources !== 'object' || Array.isArray(value.sources)) throw new Error('INVALID_COMPILER_INPUT');
  const sources = value.sources as Record<string, { content: string }>;
  if (!Object.keys(sources).length || Object.keys(sources).length > 32) throw new Error('SOURCE_COUNT_LIMIT');
  for (const [path, source] of Object.entries(sources)) {
    if (!/^[a-zA-Z0-9_@./-]{1,240}$/.test(path) || path.startsWith('/') || path.split('/').includes('..')
      || !source || typeof source !== 'object' || Array.isArray(source)
      || Object.keys(source).some(k => k !== 'content') || typeof source.content !== 'string') throw new Error('INLINE_SOURCES_REQUIRED');
  }
  if (value.settings !== undefined && (!value.settings || typeof value.settings !== 'object' || Array.isArray(value.settings))) throw new Error('INVALID_COMPILER_SETTINGS');
  const settings = { ...(value.settings as Record<string, unknown> | undefined), outputSelection: {
    '*': { '': ['ast'], '*': ['abi', 'evm.deployedBytecode.object', 'evm.deployedBytecode.immutableReferences', 'evm.deployedBytecode.linkReferences'] },
  } };
  return { language: 'Solidity', sources, settings };
}
export function prepareInput(bytes: Buffer, contract: string): { input: CompilerInput; file: string; contractName: string } {
  const input = prepareSourceBundle(bytes);
  const colon = contract.lastIndexOf(':'), file = contract.slice(0, colon), contractName = contract.slice(colon + 1);
  if (colon < 1 || !Object.hasOwn(input.sources, file) || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(contractName)) throw new Error('INVALID_CONTRACT_SELECTION');
  return { input, file, contractName };
}
export async function compile(input: CompilerInput, file: string, contract: string, version = compilerVersion,
  limits: { timeoutMs?: number } = {}): Promise<CompileResult> {
  const timeout = limits.timeoutMs ?? 20_000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 20_000) throw new Error('INVALID_COMPILER_BUDGET');
  const profile = await compilerProfile(version);
  if (!profile) throw new Error('COMPILER_VERSION_UNAVAILABLE');
  const stage = profile.id === cachedCompiler.id ? await stageCachedCompiler() : null;
  try { return await new Promise<CompileResult>((resolve, reject) => {
    const environment = { ...process.env };
    delete environment.NODE_OPTIONS; delete environment.NODE_PATH;
    const child = spawn(process.execPath, ['--use-env-proxy', '--max-old-space-size=256', fileURLToPath(new URL('./compiler-worker.mjs', import.meta.url))], {
      stdio: ['pipe', 'pipe', 'pipe'], env: environment,
    });
    const output: Buffer[] = [];
    let size = 0, failure = false;
    const fail = () => { failure = true; child.kill('SIGKILL'); };
    const timer = setTimeout(fail, timeout);
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) fail();
      else output.push(chunk);
    });
    child.stderr.resume(); // Compiler/Node diagnostics may contain input; never forward them.
    child.stdin.on('error', fail);
    child.once('error', () => { clearTimeout(timer); reject(new Error('COMPILER_PROCESS_FAILED')); });
    child.once('close', code => {
      clearTimeout(timer);
      if (failure || code !== 0) { reject(new Error('COMPILER_PROCESS_FAILED')); return; }
      try { resolve(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(output))) as CompileResult); }
      catch { reject(new Error('COMPILER_OUTPUT_INVALID')); }
    });
    child.stdin.end(JSON.stringify({ input, file, contract, profile: profile.id, stagedCompiler: stage?.path }));
  }); } finally { await stage?.cleanup(); }
}
