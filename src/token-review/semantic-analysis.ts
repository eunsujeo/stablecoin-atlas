import type { AstNode, CompileResult, CompilerInput } from './compiler.js';
import { nodes, sourceContext } from './ast.js';
import type { Finding } from './model.js';
import type { BehaviorSite, CallEdge, EntryAnalysis, StateReference, StaticAnalysis, StorageWrite } from './semantic-model.js';

const ast = (value: unknown): AstNode | undefined => value && typeof value === 'object' && 'nodeType' in value ? value as AstNode : undefined;
const type = (node: AstNode): string => String((node.typeDescriptions as { typeString?: string } | undefined)?.typeString ?? 'UNKNOWN');
const transferSelectors = new Set(['0xa9059cbb', '0x23b872dd']);
export function analyzeSource(input: CompilerInput, compiled: CompileResult, file: string, contractName: string,
  evidence: (kind: string, data: unknown) => string): StaticAnalysis {
  const context = sourceContext(input, compiled, file, contractName);
  const { byId, location, text, contracts } = context;
  const state = (node: AstNode): StateReference => ({ id: node.id, name: String(node.name), type: type(node), location: location(node) });
  const variables = contracts.flatMap(c => (c.nodes as AstNode[]).filter(n => n.nodeType === 'VariableDeclaration' && n.stateVariable === true));
  const entries = new Map<string, AstNode>();
  // Compiler linearization is derived-first. Overridden base entries are not entrypoints.
  for (const contract of contracts) for (const fn of contract.nodes as AstNode[]) {
    if (fn.nodeType !== 'FunctionDefinition' || !['external', 'public'].includes(String(fn.visibility)) || fn.kind === 'constructor') continue;
    const key = typeof fn.functionSelector === 'string' ? fn.functionSelector : String(fn.kind);
    if (!entries.has(key)) entries.set(key, fn);
  }
  function references(node: unknown): StateReference[] {
    const values = new Map<number, StateReference>();
    for (const ref of nodes(node)) {
      const variable = byId.get(ref.referencedDeclaration as number);
      if (variable?.nodeType === 'VariableDeclaration' && variable.stateVariable === true) values.set(variable.id, state(variable));
    }
    return [...values.values()];
  }
  function storageRoot(value: unknown): AstNode | undefined {
    const node = ast(value); if (!node) return undefined;
    if (node.nodeType === 'IndexAccess' || node.nodeType === 'IndexRangeAccess') return storageRoot(node.baseExpression);
    if (node.nodeType === 'MemberAccess') return storageRoot(node.expression);
    const decl = byId.get(node.referencedDeclaration as number);
    return decl?.nodeType === 'VariableDeclaration' && decl.stateVariable === true ? decl : undefined;
  }
  const result: StaticAnalysis = { schemaVersion: 'SourceStaticAnalysis1.0', entries: [], stateVariables: variables.slice(0, 256).map(state),
    coverage: { entryLimitReached: entries.size > 64, stateVariableLimitReached: variables.length > 256, semantics: 'NOT_PROVEN', scope: 'SELECTED_CONTRACT_EXPLICIT_FUNCTIONS' },
    limitations: [
      '컴파일러 선언 ID·상속 순서에 따른 정적 관계입니다. 분기 도달성·조건의 모든 경로 적용·권한 행사를 증명하지 않습니다.',
      '함수/Modifier 인자 치환·modifier의 _ 전후/중복 실행·virtual/super 실제 dispatch·외부 코드·storage alias·assembly 의미는 증명하지 않습니다.',
      '진입 함수64·선언32/진입·조건32/진입·쓰기64/진입·호출64/진입·패턴64/진입·저장 변수256·snippet400자를 제한합니다. 절단과 누락을 부재/안전으로 처리하지 않습니다.',
      '자동 생성 getter는 명시 함수 그래프에 포함하지 않습니다. 패턴은 소스 구문의 관측이며 수수료·rebase·제한·취약점 확정이 아닙니다.',
    ] };
  for (const entry of [...entries.values()].slice(0, 64)) {
    const path: EntryAnalysis = { id: entry.id, name: String(entry.name || entry.kind), selector: typeof entry.functionSelector === 'string' ? `0x${entry.functionSelector}` : null,
      location: location(entry), declarations: [], conditions: [], writes: [], calls: [], behaviors: [], uncertainties: [], authorityConclusion: 'UNKNOWN', evidenceRef: '' };
    const uncertain = new Set<string>();
    const visited = new Set<number>();
    const pending = [{ node: entry, ancestors: [] as number[] }];
    function add<T>(array: T[], value: T, limit: number, flag: string): void {
      if (array.length >= limit) uncertain.add(flag); else array.push(value);
    }
    function behavior(pattern: BehaviorSite['pattern'], node: AstNode, context: number) {
      // A shared node may contribute more than one pattern; each pattern/site is unique.
      if (path.behaviors.some(b => b.pattern === pattern && b.location.start === location(node).start && b.location.file === location(node).file)) return;
      add(path.behaviors, { pattern, expression: text(node), location: location(node), context }, 64, 'BEHAVIOR_LIMIT');
    }
    function edge(node: AstNode, from: AstNode, target: AstNode | undefined, kind: CallEdge['kind'], ancestors: number[]) {
      add(path.calls, { from: from.id, to: target?.id ?? null, expression: text(node), location: location(node), kind,
        targetLocation: target ? location(target) : null }, 64, 'CALL_LIMIT');
      if (kind === 'EXTERNAL' || kind === 'UNRESOLVED') { uncertain.add(kind === 'EXTERNAL' ? 'EXTERNAL_EFFECTS_NOT_PROVEN' : 'UNRESOLVED_CALL'); return; }
      if (!target) return;
      if (kind === 'VIRTUAL_DECLARATION') uncertain.add('VIRTUAL_DISPATCH_NOT_PROVEN');
      if (ancestors.includes(target.id) || from.id === target.id) { uncertain.add('CALL_CYCLE'); return; }
      if (pending.length >= 128) { uncertain.add('WORK_QUEUE_LIMIT'); return; }
      pending.push({ node: target, ancestors: [...ancestors, from.id] });
    }
    while (pending.length) {
      const current = pending.pop()!;
      const fn = current.node;
      if (visited.has(fn.id)) continue;
      if (visited.size >= 32) { uncertain.add('DECLARATION_LIMIT'); break; }
      visited.add(fn.id); path.declarations.push({ id: fn.id, name: String(fn.name || fn.kind), location: location(fn) });
      if (!fn.body) { uncertain.add('BODY_UNAVAILABLE'); continue; }
      const children = nodes(fn.body);
      if (fn.nodeType === 'ModifierDefinition') {
        uncertain.add('MODIFIER_EXECUTION_ORDER_NOT_PROVEN');
        const placeholders = children.filter(n => n.nodeType === 'PlaceholderStatement').length;
        if (placeholders !== 1) uncertain.add(`MODIFIER_PLACEHOLDERS_${placeholders}`);
      }
      for (const modifier of fn.modifiers as AstNode[] ?? []) {
        const name = ast(modifier.modifierName), target = byId.get(name?.referencedDeclaration as number);
        const virtual = target?.virtual === true || (ast(name?.pathNode)?.name === 'super');
        edge(modifier, fn, target, target ? virtual ? 'VIRTUAL_DECLARATION' : 'MODIFIER' : 'UNRESOLVED', current.ancestors);
        if ((modifier.arguments as unknown[] | undefined)?.length) uncertain.add('MODIFIER_ARGUMENTS_NOT_SUBSTITUTED');
      }
      for (const node of children) {
        if (node.nodeType === 'VariableDeclaration' && node.storageLocation === 'storage') uncertain.add('STORAGE_ALIAS_NOT_MODELED');
        if (node.nodeType === 'InlineAssembly') { behavior('ASSEMBLY', node, fn.id); uncertain.add('ASSEMBLY_NOT_MODELED'); }
        if (node.nodeType === 'Return' && ast(node.expression)?.nodeType === 'Literal' && ast(node.expression)?.kind === 'bool' && ast(node.expression)?.value === 'false') behavior('FALSE_RETURN', node, fn.id);
        if (node.nodeType === 'BinaryOperation' && ['*', '/'].includes(String(node.operator))) behavior('MULTIPLY_DIVIDE_EXPRESSION', node, fn.id);
        let condition: AstNode | undefined;
        let kind: 'REQUIRE' | 'ASSERT' | 'BRANCH' = 'BRANCH';
        if (node.nodeType === 'IfStatement') condition = ast(node.condition);
        if (node.nodeType === 'FunctionCall') {
          const original = ast(node.expression);
          const expression = original?.nodeType === 'FunctionCallOptions' ? ast(original.expression) : original;
          if (expression?.nodeType === 'Identifier' && ['require', 'assert'].includes(String(expression.name)) && Number(expression.referencedDeclaration) < 0) {
            condition = ast((node.arguments as unknown[])[0]); kind = expression.name === 'require' ? 'REQUIRE' : 'ASSERT';
          } else if (node.kind !== 'typeConversion' && node.kind !== 'structConstructorCall') {
            const target = byId.get(expression?.referencedDeclaration as number);
            const libraryPublic = target?.nodeType === 'FunctionDefinition' && ['public', 'external'].includes(String(target.visibility))
              && byId.get(target.scope as number)?.contractKind === 'library';
            const external = expression?.nodeType === 'MemberAccess' && (libraryPublic || /\bexternal\b/.test(type(expression)) || /^address(?: payable)?$/.test(type(ast(expression.expression) ?? expression)) && ['call', 'delegatecall', 'staticcall', 'send', 'transfer'].includes(String(expression.memberName)));
            if (external) { behavior('EXTERNAL_CALL', node, fn.id); edge(node, fn, target, 'EXTERNAL', current.ancestors); }
            else if (target?.nodeType === 'FunctionDefinition') {
              const virtual = target.virtual === true || (target.baseFunctions as unknown[] | undefined)?.length || text(expression).startsWith('super.');
              edge(node, fn, target, virtual ? 'VIRTUAL_DECLARATION' : 'INTERNAL_DECLARATION', current.ancestors);
              if ((node.arguments as unknown[] | undefined)?.length) uncertain.add('CALL_ARGUMENTS_NOT_SUBSTITUTED');
            } else if (!expression || Number(expression.referencedDeclaration) >= 0 || expression.nodeType !== 'Identifier' || !Number.isInteger(expression.referencedDeclaration)) edge(node, fn, target, 'UNRESOLVED', current.ancestors);
          }
        }
        if (condition) {
          const refs = references(condition);
          let callerEqualityState: StateReference | null = null;
          if (kind === 'REQUIRE' && condition.nodeType === 'BinaryOperation' && condition.operator === '==') {
            const left = ast(condition.leftExpression), right = ast(condition.rightExpression);
            for (const [sender, other] of [[left, right], [right, left]]) {
              const base = ast(sender?.expression);
              const declaration = byId.get(other?.referencedDeclaration as number);
              if (sender?.nodeType === 'MemberAccess' && sender.memberName === 'sender' && base?.nodeType === 'Identifier'
                && base.name === 'msg' && Number(base.referencedDeclaration) < 0 && declaration?.stateVariable === true
                && /^address(?: payable)?$/.test(type(declaration))) callerEqualityState = state(declaration);
            }
          }
          add(path.conditions, { context: fn.id, kind, expression: text(condition), location: location(condition), stateReferences: refs, callerEqualityState }, 32, 'CONDITION_LIMIT');
          const parts = nodes(condition);
          if (parts.some(n => n.nodeType === 'BinaryOperation' && ['==', '!='].includes(String(n.operator))
            && [n.leftExpression, n.rightExpression].some(x => ast(x)?.nodeType === 'Literal' && ast(x)?.value === '0'))
            && refs.some(r => r.type.includes('mapping(address => mapping(address =>'))) behavior('NESTED_MAPPING_ZERO_CONDITION', condition, fn.id);
          if (parts.some(n => n.nodeType === 'Identifier' && type(n) === 'address' || n.nodeType === 'MemberAccess' && n.memberName === 'sender' && ast(n.expression)?.name === 'msg')) behavior('ADDRESS_CONDITION', condition, fn.id);
        }
        if (node.nodeType === 'Assignment' || node.nodeType === 'UnaryOperation' && ['++', '--', 'delete'].includes(String(node.operator))) {
          const left = node.nodeType === 'Assignment' ? node.leftHandSide : node.subExpression;
          const variable = storageRoot(left);
          if (variable) {
            const write: StorageWrite = { context: fn.id, operation: String(node.operator), expression: text(node), location: location(node), variable: state(variable) };
            add(path.writes, write, 64, 'WRITE_LIMIT');
            if (!transferSelectors.has(path.selector ?? '') && /^mapping\(address => uint/.test(type(variable))) behavior('NON_TRANSFER_MAPPING_WRITE', node, fn.id);
          } else {
            const declaration = byId.get(ast(left)?.referencedDeclaration as number);
            if (declaration?.storageLocation === 'storage' || nodes(left).some(n => n.nodeType === 'IndexAccess' || n.nodeType === 'MemberAccess')) uncertain.add('UNRESOLVED_WRITE_TARGET');
          }
        }
      }
    }
    path.uncertainties = [...uncertain].sort();
    path.evidenceRef = evidence('SOURCE_ENTRY_GRAPH', { ...path, evidenceRef: undefined });
    result.entries.push(path);
  }
  return result;
}

export function semanticFindings(analysis: StaticAnalysis, prefix: string): Finding[] {
  const result: Finding[] = [];
  for (const entry of analysis.entries) {
    result.push({ id: `${prefix}-graph-${entry.id}`, scope: 'SOURCE', rule: 'static-declaration-graph-v1', categories: [], confirmation: 'CONFIRMED',
      summary: `${entry.name}: 선언 ${entry.declarations.length}개, 조건 ${entry.conditions.length}개, 저장값 대입 ${entry.writes.length}개의 정적 관계를 관측했습니다. 모든 경로의 권한 보장은 확인 불가입니다.`, evidenceRefs: [entry.evidenceRef] });
    for (const [i, condition] of entry.conditions.entries()) if (condition.callerEqualityState) result.push({ id: `${prefix}-caller-guard-${entry.id}-${i}`,
      scope: 'SOURCE', rule: 'caller-storage-equality-require-v1', categories: ['INTENDED_ADMIN_FUNCTION'], confirmation: 'CONFIRMED',
      summary: `${condition.location.file}:${condition.location.line}: 내장 require가 msg.sender와 주소형 저장값 ${condition.callerEqualityState.name}의 직접 동등 비교를 요구하는 소스 구문을 확인했습니다. 해당 선언 위치의 조건이며 ${entry.name}의 모든 경로에 적용된다는 증명은 아닙니다.`, evidenceRefs: [entry.evidenceRef] });
    const permissionWrites = entry.writes.filter(w => /owner|admin|role|minter|pauser|blacklister/i.test(w.variable.name));
    if (permissionWrites.length) result.push({ id: `${prefix}-permission-writes-${entry.id}`, scope: 'SOURCE', rule: 'permission-write-review-v1',
      categories: ['INTENDED_ADMIN_FUNCTION'], confirmation: 'UNKNOWN',
      summary: `${entry.name}: 권한 관련 이름의 저장값 ${[...new Set(permissionWrites.map(w => w.variable.name))].join(', ')} 변경 위치를 관측했습니다. 변경 권한·우회 경로의 의미는 확인 불가입니다.`, evidenceRefs: [entry.evidenceRef] });
    for (const pattern of new Set(entry.behaviors.map(b => b.pattern))) result.push({ id: `${prefix}-behavior-${entry.id}-${pattern}`, scope: 'SOURCE', rule: 'typed-ast-behavior-review-v1',
      categories: pattern === 'EXTERNAL_CALL' || pattern === 'ASSEMBLY' ? ['VULNERABILITY_CANDIDATE'] : ['NONSTANDARD_BEHAVIOR'], confirmation: 'UNKNOWN',
      summary: `${entry.name}: ${pattern} 구문과 위치를 관측했습니다. 실제 실행 도달성·수수료·잔액 의미·주소 제한·취약점을 확정하지 않습니다.`, evidenceRefs: [entry.evidenceRef] });
  }
  return result;
}
