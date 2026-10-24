import type { AstNode, CompileResult, CompilerInput } from './compiler.js';
import type { Finding, FunctionReview, SourceLocation } from './model.js';

export function nodes(root: unknown): AstNode[] {
  const result: AstNode[] = [], pending = [root];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) { pending.push(...value); continue; }
    const object = value as Record<string, unknown>;
    if (typeof object.nodeType === 'string' && typeof object.src === 'string' && typeof object.id === 'number') result.push(object as AstNode);
    pending.push(...Object.values(object));
    if (result.length > 100_000) throw new Error('AST_NODE_LIMIT');
  }
  return result;
}
// This is a declaration/call-site inventory, not a symbolic execution or safety proof.
export function inventory(input: CompilerInput, compiled: CompileResult, file: string, contractName: string,
  evidence: (kind: string, data: unknown) => string): FunctionReview[] {
  const all = Object.values(compiled.sources).flatMap(s => nodes(s.ast));
  const byId = new Map(all.map(n => [n.id, n]));
  const files = new Map(Object.entries(compiled.sources).map(([name, s]) => [s.id, name]));
  function location(node: AstNode): SourceLocation {
    const [start = 0, length = 0, id = -1] = node.src.split(':').map(Number);
    const name = files.get(id) ?? 'UNKNOWN';
    const content = Buffer.from(input.sources[name]?.content ?? '');
    return { file: name, start, length,
      line: content.subarray(0, start).toString('utf8').split('\n').length,
      endLine: content.subarray(0, start + length).toString('utf8').split('\n').length };
  }
  function text(node: unknown): string {
    if (!node || typeof node !== 'object' || !('src' in node)) return '';
    const loc = location(node as AstNode);
    return Buffer.from(input.sources[loc.file]?.content ?? '').subarray(loc.start, loc.start + loc.length).toString('utf8').slice(0, 400);
  }
  const root = nodes(compiled.sources[file]?.ast).find(n => n.nodeType === 'ContractDefinition' && n.name === contractName);
  if (!root || !Array.isArray(root.linearizedBaseContracts)) throw new Error('AST_SELECTED_CONTRACT_MISSING');
  const hierarchy = new Set(root.linearizedBaseContracts as number[]);
  const contracts = all.filter(n => n.nodeType === 'ContractDefinition' && hierarchy.has(n.id));
  evidence('SOURCE_SCOPE', { file, contractName, linearizedInheritance: (root.linearizedBaseContracts as number[]).map(id => {
    const node = byId.get(id); return { name: node?.name ?? 'UNKNOWN', location: node ? location(node) : null };
  }), imports: all.filter(n => n.nodeType === 'ImportDirective').map(n => ({ location: location(n), source: n.file, absolutePath: n.absolutePath })) });
  const result: FunctionReview[] = [];
  for (const contract of contracts) for (const fn of (contract.nodes as AstNode[] ?? []).filter(n => n.nodeType === 'FunctionDefinition')) {
    if (result.length >= 256) throw new Error('FUNCTION_COUNT_LIMIT');
    const children = nodes(fn.body);
    const modifiers = (fn.modifiers as AstNode[] ?? []).slice(0, 16).map(m => {
      const name = m.modifierName as AstNode;
      const decl = byId.get(name.referencedDeclaration as number);
      return { name: text(m), declaration: decl ? location(decl) : null, text: decl ? text(decl) : '',
        evidenceRef: decl ? evidence('SOURCE_MODIFIER', { location: location(decl), text: text(decl) }) : null };
    });
    const record = {
      name: String(fn.name || fn.kind), contract: String(contract.name), visibility: String(fn.visibility), mutability: String(fn.stateMutability),
      selector: typeof fn.functionSelector === 'string' ? `0x${fn.functionSelector}` : null,
      parameters: text(fn.parameters), returnParameters: text(fn.returnParameters), inherited: contract.id !== root.id,
      location: location(fn), implemented: fn.implemented === true, modifiers,
      calls: children.filter(n => n.nodeType === 'FunctionCall').slice(0, 32).map(n => {
        const expr = n.expression as AstNode;
        const declaration = byId.get(expr?.referencedDeclaration as number);
        return { expression: text(expr), declaration: declaration ? location(declaration) : null };
      }),
      conditions: children.filter(n => n.nodeType === 'IfStatement'
        || (n.nodeType === 'FunctionCall' && ['require', 'assert'].includes(String((n.expression as AstNode)?.name))))
        .slice(0, 32).map(n => text(n.nodeType === 'IfStatement' ? n.condition : n)),
      writes: children.filter(n => n.nodeType === 'Assignment' || n.nodeType === 'UnaryOperation' && ['++', '--', 'delete'].includes(String(n.operator)))
        .slice(0, 32).map(n => text(n)),
      returns: children.filter(n => n.nodeType === 'Return').slice(0, 32).map(n => text(n)),
      assembly: children.some(n => n.nodeType === 'InlineAssembly'),
    };
    result.push({ ...record, evidenceRef: evidence('SOURCE_FUNCTION', record) });
  }
  return result;
}

const adminNames = /mint|burn|freez|blacklist|blocklist|allowlist|whitelist|pause|upgrade|fee|limit|role|owner|admin/i;
export const checklist = [
  ['deployment-dependencies', '외부 의존성과 실제 프록시 호출 경로의 완전성'],
  ['admin-mint-burn', '발행·소각의 실행 권한과 변경 경로'],
  ['admin-restrictions', '동결·주소 제한·일시정지 권한과 예외 경로'],
  ['admin-upgrade-settings', '업그레이드·수수료·한도·역할 변경 권한'],
  ['behavior-fees-balances', '전송 수수료와 전송 외 잔액 변경'],
  ['behavior-approval', '반환값·승인·주소 제한의 실행 의미'],
  ['behavior-external', '외부 호출·콜백과 재진입 영향'],
  ['audit-mapping', '감사 대상과 현재 배포본의 대응 관계'],
] as const;
export function sourceFindings(functions: FunctionReview[], abi: NonNullable<CompileResult['selected']>['abi'], prefix: string, compilationEvidence: string): Finding[] {
  const findings: Finding[] = [];
  for (const fn of functions) {
    findings.push({ id: `${prefix}-decl-${findings.length}`, rule: 'source-declaration-v1', scope: 'SOURCE', categories: [], confirmation: 'CONFIRMED',
      summary: `소스 선언 ${fn.contract}.${fn.name}: ${fn.visibility}, ${fn.mutability}. 선언·조건·호출 위치를 기록했으며 실행 의미는 별도 검토 대상입니다.`,
      evidenceRefs: [fn.evidenceRef, ...fn.modifiers.flatMap(m => m.evidenceRef ? [m.evidenceRef] : [])] });
    if (adminNames.test(fn.name)) findings.push({ id: `${prefix}-admin-${findings.length}`, rule: 'admin-review-candidate-v1', scope: 'SOURCE',
      categories: ['INTENDED_ADMIN_FUNCTION'], confirmation: 'UNKNOWN',
      summary: `${fn.contract}.${fn.name}: 이름 기반 관리 기능 검토 후보. modifier·조건·내부 호출을 제공하며 권한 의미와 변경 경로를 자동 확정하지 않습니다.`, evidenceRefs: [fn.evidenceRef] });
    if (fn.assembly || fn.calls.some(c => /\.(call|delegatecall|staticcall|send|transfer)\b/.test(c.expression))) findings.push({
      id: `${prefix}-external-${findings.length}`, rule: 'external-assembly-review-v1', scope: 'SOURCE', categories: ['VULNERABILITY_CANDIDATE'],
      confirmation: 'UNKNOWN', summary: `${fn.contract}.${fn.name}: 저수준 호출 또는 assembly 검토 지점. 취약점·재진입 가능성은 확인되지 않았습니다.`, evidenceRefs: [fn.evidenceRef] });
  }
  for (const name of ['transfer', 'approve', 'transferFrom']) {
    const inputTypes = name === 'transferFrom' ? ['address', 'address', 'uint256'] : ['address', 'uint256'];
    const entry = abi.find(e => e.type === 'function' && e.name === name && JSON.stringify(e.inputs?.map(i => i.type)) === JSON.stringify(inputTypes));
    if (entry && JSON.stringify(entry.outputs?.map(o => o.type)) !== '["bool"]') {
      findings.push({ id: `${prefix}-returns-${name}`, rule: 'erc20-declared-return-v1', scope: 'SOURCE', categories: ['NONSTANDARD_BEHAVIOR'],
        confirmation: 'CONFIRMED', summary: `${name}의 ABI 선언 반환형이 단일 bool과 다릅니다. 실제 반환 바이트·호환성·안전성은 별도 확인 대상입니다.`,
        evidenceRefs: [compilationEvidence, ...functions.filter(f => f.name === name).map(f => f.evidenceRef)] });
    }
  }
  return findings;
}
