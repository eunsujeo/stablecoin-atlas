import { syntaxAnalysis } from './compiler.mjs';
import { sha256 } from './source.mjs';

export function walk(root) {
  const result = [], stack = [root];
  while (stack.length) {
    const node = stack.pop(); if (!node || typeof node !== 'object') continue;
    if (node.nodeType) result.push(node);
    for (const child of Object.values(node)) if (Array.isArray(child)) stack.push(...child); else if (child && typeof child === 'object') stack.push(child);
  }
  return result;
}
function location(node, file, content) {
  const [start, length] = String(node.src).split(':').map(Number), bytes = Buffer.from(content);
  return { file, line: bytes.subarray(0, start).toString('utf8').split('\n').length, byteOffset: start, byteLength: length };
}
function expression(node) {
  if (!node) return 'UNKNOWN';
  if (node.nodeType === 'Identifier') return node.name;
  if (node.nodeType === 'MemberAccess') return `${expression(node.expression)}.${node.memberName}`;
  if (node.nodeType === 'FunctionCallOptions') return expression(node.expression);
  if (node.nodeType === 'FunctionCall') return `${expression(node.expression)}(...)`;
  if (node.nodeType === 'IndexAccess') return `${expression(node.baseExpression)}[]`;
  if (node.nodeType === 'BinaryOperation') return `(${expression(node.leftExpression)} ${node.operator} ${expression(node.rightExpression)})`;
  if (node.nodeType === 'UnaryOperation') return `${node.operator} ${expression(node.subExpression)}`;
  if (node.nodeType === 'Literal') return node.kind === 'string' ? 'STRING_LITERAL' : String(node.value ?? node.kind);
  return node.nodeType;
}
const incomplete = ['Whole-program access-control proof', 'Exploitability of generic patterns', 'Reentrancy ordering and cross-contract invariants', 'Live owner/admin/role membership, multisig threshold and timelock configuration', 'Economic/bridge/oracle correctness', 'External target implementations', 'Custom proxy/diamond dispatch', 'Symbolic execution', 'Slither execution'];
export async function analyze(bundle) {
  if (!bundle) return { status: 'UNKNOWN', reason: 'SOURCE_UNAVAILABLE', functions: [], modifiers: [], findings: [], callFlow: [], stateVariables: [], coverage: incomplete };
  const hashes = Object.fromEntries(Object.entries(bundle.sources).map(([p, s]) => [p, sha256(s.content)]));
  let parsed;
  try { parsed = await syntaxAnalysis(bundle.sources); } catch { return { status: 'UNKNOWN', reason: 'COMPILER_PROCESS_FAILED', hashes, functions: [], modifiers: [], findings: [], callFlow: [], stateVariables: [], coverage: incomplete }; }
  const base = { tool: `solc ${parsed.version}`, mode: 'PRAGMA_RELAXED_ANALYSIS_COPY', deploymentRecompile: 'NOT_RUN', hashes };
  if (parsed.errors.some(e => e.severity === 'error')) return { ...base, status: 'UNKNOWN', reason: 'SOURCE_ANALYSIS_COMPILE_FAILED', diagnostics: parsed.errors, functions: [], modifiers: [], findings: [], callFlow: [], stateVariables: [], coverage: incomplete };
  const definitions = [], states = new Map(), index = new Map();
  for (const [file, source] of Object.entries(parsed.sources)) {
    for (const node of walk(source.ast)) { if (Number.isInteger(node.id)) index.set(node.id, { node, file }); if (node.nodeType === 'ContractDefinition') definitions.push({ node, file }); }
  }
  const selected = definitions.find(x => x.node.name === bundle.name && (!bundle.file || x.file === bundle.file));
  if (!selected || (!bundle.file && definitions.filter(x => x.node.name === bundle.name).length !== 1)) return { ...base, status: 'UNKNOWN', reason: 'CONTRACT_SELECTION_UNRESOLVED', functions: [], modifiers: [], findings: [], callFlow: [], stateVariables: [], coverage: incomplete };
  const selectedIds = new Set(selected.node.linearizedBaseContracts);
  const contracts = definitions.filter(x => selectedIds.has(x.node.id));
  const functions = [], modifiers = [], findings = [], callFlow = [];
  for (const { node: contract, file } of contracts) {
    const content = bundle.sources[file].content;
    for (const n of contract.nodes) if (n.nodeType === 'VariableDeclaration' && n.stateVariable) states.set(n.id, { name: n.name, contract: contract.name, type: n.typeDescriptions?.typeString ?? 'UNKNOWN', location: location(n, file, content) });
  }
  const finding = (rule, severity, fn, loc, evidence, kind = 'CODE_PATTERN') => findings.push({ id: `${rule}-${findings.length + 1}`, rule, severity, functions: [fn], location: loc, evidence, kind, status: 'REVIEW_REQUIRED', exploitability: 'NOT_PROVEN' });
  for (const { node: contract, file } of contracts) {
    const content = bundle.sources[file].content;
    for (const fn of contract.nodes.filter(n => ['FunctionDefinition', 'ModifierDefinition'].includes(n.nodeType))) {
      const loc = location(fn, file, content), fnName = `${contract.name}.${fn.name || fn.kind}`;
      const descendants = walk(fn.body), calls = [], writes = new Set(), contexts = new Set(), guards = [];
      for (const n of descendants) {
        if (n.nodeType === 'IfStatement') guards.push({ kind: 'IF_CONDITION', condition: expression(n.condition), location: location(n, file, content) });
        if (n.nodeType === 'MemberAccess' && ['msg.sender', 'msg.value', 'tx.origin'].includes(expression(n))) contexts.add(expression(n));
        if (n.nodeType === 'Assignment' || (n.nodeType === 'UnaryOperation' && ['++', '--', 'delete'].includes(n.operator))) {
          for (const ref of walk(n.leftHandSide ?? n.subExpression)) if (states.has(ref.referencedDeclaration)) writes.add(states.get(ref.referencedDeclaration).name);
        }
        if (n.nodeType === 'FunctionCall') {
          let e = n.expression; if (e.nodeType === 'FunctionCallOptions') e = e.expression;
          if (e.nodeType === 'Identifier' && ['require', 'assert'].includes(e.name)) guards.push({ kind: e.name.toUpperCase(), condition: expression(n.arguments[0]), location: location(n, file, content) });
          const member = e.memberName;
          const kind = ['call', 'delegatecall', 'staticcall', 'send', 'transfer'].includes(member) && /\baddress/.test(e.expression?.typeDescriptions?.typeString ?? '') ? member.toUpperCase()
            : /t_function_external/.test(e.typeDescriptions?.typeIdentifier ?? '') ? 'EXTERNAL_TYPED_CALL'
            : index.get(e.referencedDeclaration)?.node.nodeType === 'FunctionDefinition' ? 'INTERNAL_CALL' : null;
          if (kind) calls.push({ kind, target: expression(e.expression ?? e), callee: expression(e), referencedDeclaration: e.referencedDeclaration ?? null,
            forwardsValue: n.expression.nodeType === 'FunctionCallOptions' && n.expression.names.includes('value'), location: location(n, file, content) });
        }
        if (n.nodeType === 'YulFunctionCall' && ['call', 'delegatecall', 'staticcall', 'callcode', 'selfdestruct'].includes(n.functionName?.name)) {
          calls.push({ kind: n.functionName.name.toUpperCase(), target: 'ASSEMBLY_UNRESOLVED', callee: n.functionName.name, forwardsValue: 'UNKNOWN', location: location(n, file, content) });
        }
      }
      const entry = { id: fn.id, contract: contract.name, name: fn.name || fn.kind, kind: fn.kind ?? 'modifier', visibility: fn.visibility ?? null,
        mutability: fn.stateMutability ?? null, implemented: Boolean(fn.body), location: loc,
        parameters: (fn.parameters?.parameters ?? []).map(p => ({ name: p.name, type: p.typeDescriptions?.typeString ?? 'UNKNOWN' })),
        modifiers: (fn.modifiers ?? []).map(m => ({ name: m.modifierName.name ?? m.modifierName.namePath, referencedDeclaration: m.modifierName.referencedDeclaration })),
        contexts: [...contexts], guards, directStateWrites: [...writes], calls, role: calls.length ? 'Invokes other functions; inspect call flow and target policy' : ['view', 'pure'].includes(fn.stateMutability) ? 'Read/calculation' : 'Inspect implementation and inherited conditions' };
      if (fn.nodeType === 'ModifierDefinition') { modifiers.push(entry); continue; }
      functions.push(entry);
      for (const c of calls) {
        callFlow.push({ from: fnName, ...c });
        if (c.kind === 'DELEGATECALL' || c.kind === 'CALLCODE') finding('DELEGATED_CONTEXT', 'HIGH', fnName, c.location, 'Target code executes in caller storage/balance context. Target trust and dispatch authorization require review.');
        if (['CALL', 'EXTERNAL_TYPED_CALL'].includes(c.kind)) finding('EXTERNAL_CALL', 'MEDIUM', fnName, c.location, 'External execution may reenter and move assets. Presence of a call does not prove reentrancy or unrestricted target control.');
        if (c.forwardsValue === true || ['SEND', 'TRANSFER'].includes(c.kind)) finding('NATIVE_VALUE_FLOW', 'MEDIUM', fnName, c.location, 'Native value can leave this execution context. Verify accounting, failure handling and intended beneficiary.');
      }
      if (contexts.has('tx.origin')) finding('TX_ORIGIN_CONTEXT', 'MEDIUM', fnName, loc, 'tx.origin is referenced; inspect whether used for authorization.');
      if (/upgradeTo|setImplementation|upgradeAndCall/i.test(fn.name)) finding('UPGRADE_ENTRY_CANDIDATE', 'HIGH', fnName, loc, 'Upgrade-related name; function name alone does not establish upgrade capability or access-control weakness.');
      if (fn.stateMutability === 'payable') finding('PAYABLE_CUSTODY', 'MEDIUM', fnName, loc, 'Payable entry can receive native currency; refund/recovery and partial failure paths require review.', 'USAGE_RISK');
    }
  }
  return { ...base, status: 'REVIEW_REQUIRED', selectedContract: `${selected.file}:${selected.node.name}`, contracts: contracts.map(x => ({ file: x.file, name: x.node.name })), functions, modifiers, stateVariables: [...states.values()], callFlow, findings, coverage: incomplete };
}
