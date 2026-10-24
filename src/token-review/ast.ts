import type { AstNode, CompileResult, CompilerInput } from './compiler.js';
import type { SourceLocation } from './model.js';
import { usdtCompiler } from './compiler-cache.mjs';

export function functionKind(node: AstNode, compiler: string): string {
  if (['constructor', 'function', 'fallback', 'receive'].includes(String(node.kind))) return String(node.kind);
  if (compiler === usdtCompiler.version && typeof node.isConstructor === 'boolean' && typeof node.name === 'string') {
    return node.isConstructor ? 'constructor' : node.name === '' ? 'fallback' : 'function';
  }
  return 'unknown';
}

export function nodes(root: unknown): AstNode[] {
  const result: AstNode[] = [], pending = [root];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) { for (const child of value) pending.push(child); continue; }
    const object = value as Record<string, unknown>;
    if (typeof object.nodeType === 'string' && typeof object.src === 'string' && typeof object.id === 'number') result.push(object as AstNode);
    pending.push(...Object.values(object));
    if (result.length > 100_000) throw new Error('AST_NODE_LIMIT');
  }
  return result;
}
export function sourceContext(input: CompilerInput, compiled: CompileResult, file: string, contractName: string) {
  const all = Object.values(compiled.sources).flatMap(s => nodes(s.ast));
  const byId = new Map(all.map(n => [n.id, n]));
  const files = new Map(Object.entries(compiled.sources).map(([name, s]) => [s.id, name]));
  const buffers = new Map(Object.entries(input.sources).map(([name, s]) => [name, Buffer.from(s.content)]));
  function location(node: AstNode): SourceLocation {
    const [start = 0, length = 0, id = -1] = node.src.split(':').map(Number);
    const name = files.get(id) ?? 'UNKNOWN', content = buffers.get(name) ?? Buffer.alloc(0);
    return { file: name, start, length, line: content.subarray(0, start).toString('utf8').split('\n').length,
      endLine: content.subarray(0, start + length).toString('utf8').split('\n').length };
  }
  function text(node: unknown): string {
    if (!node || typeof node !== 'object' || !('src' in node)) return '';
    const loc = location(node as AstNode);
    return (buffers.get(loc.file) ?? Buffer.alloc(0)).subarray(loc.start, loc.start + loc.length).toString('utf8').slice(0, 400);
  }
  const root = nodes(compiled.sources[file]?.ast).find(n => n.nodeType === 'ContractDefinition' && n.name === contractName);
  if (!root || !Array.isArray(root.linearizedBaseContracts)) throw new Error('AST_SELECTED_CONTRACT_MISSING');
  const contracts = (root.linearizedBaseContracts as number[]).map(id => byId.get(id)).filter((n): n is AstNode => n?.nodeType === 'ContractDefinition');
  return { all, byId, location, text, root, contracts };
}
