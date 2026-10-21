import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeAbiParameters, encodeFunctionData, parseAbi } from 'viem';
import { tronAddress } from '../src/tron/address.js';
import { TronReadOnlyAdapter } from '../src/tron/adapter.js';
import { verifyReadOnlyAdapterContract } from './helpers/read-only-adapter-contract.js';
import { assertReportContract, assertSerializedReport } from './helpers/report-contract.js';
import { json } from '../src/domain/evaluator.js';
import { writeReportAtomically } from '../src/report-output.js';
const token = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const owner = 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL';
const other = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
const networkId = '728126428', max = 2n ** 256n - 1n;
const abi = parseAbi(['function name() view returns (string)', 'function symbol() view returns (string)',
  'function decimals() view returns (uint8)', 'function totalSupply() view returns (uint256)', 'function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)']);
const selector = (fn: 'name' | 'symbol' | 'decimals' | 'totalSupply') => encodeFunctionData({ abi, functionName: fn });
const deferred = [['TRC20-002', 'TRANSFER'], ['TRC20-003', 'ALLOWANCE'], ['TRC20-004', 'UPGRADEABILITY'],
  ['TRC20-005', 'RESOURCE_CONSUMPTION'], ['TRC20-006', 'TRANSFER_FEE']].map(([scenarioId, capability]) => ({ scenarioId: scenarioId!, capability: capability! }));
async function mockNode() {
  let fault = '', heads = 0;
  const methods: string[] = [], calls: { to: string; data: string }[] = [];
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += String(chunk);
    const body = JSON.parse(raw) as { id: number; method: string; params: unknown[] };
    methods.push(body.method);
    const tx = body.params[0] as { to?: string; data?: string } | undefined;
    let result: unknown;
    switch (body.method) {
      case 'eth_chainId': result = fault === 'chain-mismatch' ? '0x1' : fault === 'chain-invalid' ? '0x00' : '0x2b6653dc'; break;
      case 'eth_getBlockByNumber': {
        assert.deepEqual(body.params, ['latest', false]); heads++;
        const n = BigInt(['head-stable', 'head-reorg'].includes(fault) ? 255 : 255 + heads);
        result = (fault === 'head-invalid' || fault === 'closing-head-invalid' && heads === 2) ? null
          : { number: fault === 'head-number-invalid' ? '0x00' : '0x' + n.toString(16),
            hash: fault === 'head-hash-invalid' ? '0x00' : '0x' + (fault === 'head-prefix-invalid' ? n + 1n : n).toString(16).padStart(16, '0')
              + (fault === 'head-reorg' && heads === 2 ? 'cd' : 'ab').repeat(24) }; break;
      }
      case 'eth_getCode':
        assert.deepEqual(body.params, [tronAddress(token).rpc, 'latest']);
        result = fault === 'empty-code' ? '0x' : fault === 'odd-code' ? '0x1' : '0x6000'; break;
      case 'eth_call': {
        assert.equal(body.params[1], 'latest'); assert.equal(tx?.to, tronAddress(token).rpc); assert(tx?.data);
        calls.push({ to: tx.to, data: tx.data });
        if (tx.data === selector('decimals')) {
          if (fault === 'transport') { response.destroy(); return; }
          if (fault === 'rpc' || fault === 'rpc-revert') {
            response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: fault === 'rpc' ? -32000 : 3,
              message: 'UPSTREAM_DIAGNOSTIC_CANARY', data: { credential: 'UPSTREAM_DIAGNOSTIC_CANARY' } } })); return;
          }
          if (fault === 'envelope') { response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id + 1, result: '0x00' })); return; }
          result = fault === 'short' ? '0x01' : encodeAbiParameters([{ type: 'uint256' }], [fault === 'uint8-overflow' ? 256n : fault === 'uint8-zero' ? 0n : fault === 'uint8-max' ? 255n : 6n]);
        } else if (tx.data === selector('name') || tx.data === selector('symbol')) {
          result = encodeAbiParameters([{ type: 'string' }], [fault === 'empty-labels' ? '' : tx.data === selector('name') ? 'Synthetic TRON label' : 'MOCK']);
        } else if (tx.data === selector('totalSupply')) result = encodeAbiParameters([{ type: 'uint256' }], [max]);
        else if (tx.data.startsWith('0xdd62ed3e')) {
          if (fault === 'allowance-transport') { response.destroy(); return; }
          if (fault === 'allowance-rpc') { response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: 3, message: 'UPSTREAM_DIAGNOSTIC_CANARY' } })); return; }
          const a = '0x' + tx.data.slice(34, 74), b = '0x' + tx.data.slice(98, 138);
          assert.equal(tx.data.length, 138);
          assert([owner, other, token].some(v => tronAddress(v).rpc === a));
          assert([owner, other, token].some(v => tronAddress(v).rpc === b));
          result = fault === 'allowance-short' ? '0x01' : encodeAbiParameters([{ type: 'uint256' }], [a === tronAddress(owner).rpc && b === tronAddress(other).rpc ? max : 0n]);
        } else {
          const ownerData = encodeFunctionData({ abi, functionName: 'balanceOf', args: [tronAddress(owner).rpc] });
          const otherData = encodeFunctionData({ abi, functionName: 'balanceOf', args: [tronAddress(other).rpc] });
          assert(tx.data === ownerData || tx.data === otherData, 'Only the read-only selector set is allowed');
          if (fault === 'balance-rpc') { response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'UPSTREAM_DIAGNOSTIC_CANARY' } })); return; }
          result = encodeAbiParameters([{ type: 'uint256' }], [tx.data === ownerData ? max : 0n]);
        }
        break;
      }
      default: assert.fail('Unexpected RPC method');
    }
    response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  return { url: `http://127.0.0.1:${address.port}`, methods, calls, fault(value: string) { fault = value; heads = 0; },
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

test('TRON address canonical Base58Check and exact 41-prefixed hex official vectors', () => {
  for (const [base58, hex] of [[token, '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'],
    [owner, '418840e6c55b9ada326d211d818c34a994aeced808'], [other, '41' + '0'.repeat(40)]]) {
    assert.equal(tronAddress(base58!).hex, hex);
    assert.equal(tronAddress(hex!).base58, base58);
    assert.equal(tronAddress('0x' + hex!.toUpperCase()).base58, base58);
    assert.equal(tronAddress(base58!).rpc, '0x' + hex!.slice(2));
  }
  for (const bad of ['', token.slice(0, -1) + '1', '1' + token.slice(1), token + '1', ' ' + token,
    '0x' + 'a'.repeat(40), '51' + '0'.repeat(40), '41' + '0'.repeat(39), '41' + '0'.repeat(42), 'T0' + token.slice(2)]) {
    assert.throws(() => tronAddress(bad), /^Error: Invalid TRON address\.$/);
  }
});

test('TRON adapter contract: concurrent evidence isolation, exact balances, latest-only and no writes', async () => {
  const node = await mockNode();
  try {
    const adapter = new TronReadOnlyAdapter(node.url), base = { networkId, assetAddress: token };
    const reports = await verifyReadOnlyAdapterContract({ adapter,
      requests: [{ ...base, accountAddress: owner }, { ...base, accountAddress: other }, base],
      invalidRequests: [{ ...base, networkId: '1' }, { ...base, networkId: 'invalid' }, { ...base, assetAddress: 'invalid' }, { ...base, accountAddress: 'invalid' }],
      unexecuted: [...deferred, { scenarioId: 'TRC20-007', capability: 'ALLOWANCE' }],
      verifyObservation(report, index) {
        assert.equal(report.assetIdentity.observedBlockOrSlot, 'UNKNOWN');
        assert.deepEqual(report.assetIdentity.contractAddress, { status: 'KNOWN', value: token });
        assert.deepEqual(report.assetIdentity.decimals, { status: 'KNOWN', value: 6 });
        assert.equal(report.assetIdentity.implementationAddress.status, 'UNKNOWN');
        const metadata = report.results.find(r => r.scenarioId === 'TRC20-001')!;
        assert.equal(metadata.verdict, 'INCONCLUSIVE'); assert.equal(metadata.support, 'UNKNOWN'); assert.equal(metadata.observations.decodeComplete, true);
        const balance = report.results.find(r => r.scenarioId === 'TRC20-000')!;
        assert.equal(balance.verdict, index === 2 ? 'NOT_TESTED' : 'INCONCLUSIVE');
        if (index !== 2) assert.equal(balance.observations.balance, index === 0 ? max : 0n);
        const balanceCalls = report.evidence.filter(e => e.kind === 'RPC').map(e => e.data as { method: string; params: { data?: string }[] })
          .filter(e => e.method === 'eth_call' && e.params[0]?.data?.startsWith('0x70a08231'));
        assert.equal(balanceCalls.length, index === 2 ? 0 : 1);
        if (index !== 2) assert.equal(balanceCalls[0]!.params[0]!.data, encodeFunctionData({ abi, functionName: 'balanceOf', args: [tronAddress(index === 0 ? owner : other).rpc] }));
        assert(report.results.every(r => r.observedBlockOrSlot === 'UNKNOWN'));
        const context = report.evidence.find(e => e.kind === 'TRON_STATE_CONTEXT')!.data as { responseBlockKnown: boolean; headChanged: boolean };
        assert.equal(context.responseBlockKnown, false); assert.equal(context.headChanged, true);
        assert.equal(report.evidence.some(e => e.kind === 'BLOCK_REFERENCE'), false);
      },
    });
    assert(node.methods.every(method => ['eth_chainId', 'eth_getBlockByNumber', 'eth_getCode', 'eth_call'].includes(method)));
    const wire = JSON.parse(json(reports[0]));
    assert.equal(wire.results.find((r: { scenarioId: string }) => r.scenarioId === 'TRC20-000').observations.balance, max.toString());
    await writeReportAtomically('reports/tron-readonly-mock.json', json({ kind: 'TRON_SYNTHETIC_HTTP_EVIDENCE',
      description: 'Synthetic JSON-RPC responses, not a TVM execution or live asset test', samples: reports }));
  } finally { await node.close(); }
});

test('TRON metadata/read faults preserve unknown blocks, safe errors, invalid values and recovery', async () => {
  const node = await mockNode();
  try {
    const adapter = new TronReadOnlyAdapter(node.url), input = { networkId, assetAddress: token, accountAddress: owner };
    for (const fault of ['uint8-zero', 'uint8-max', 'empty-labels', 'uint8-overflow', 'short', 'rpc', 'rpc-revert', 'transport', 'envelope', 'balance-rpc', 'closing-head-invalid', 'head-stable', 'head-reorg']) {
      node.fault(fault); const report = await adapter.assessReadOnly(input); assertSerializedReport(report);
      const metadata = report.results.find(r => r.scenarioId === 'TRC20-001')!;
      const fields = metadata.observations.metadata as Record<string, { status: string; value?: unknown; errorKind?: string }>;
      assert.equal(metadata.verdict, 'INCONCLUSIVE'); assert.equal(metadata.observedBlockOrSlot, 'UNKNOWN');
      assert(!json(report).includes('UPSTREAM_DIAGNOSTIC_CANARY'));
      if (['uint8-overflow', 'short'].includes(fault)) {
        assert.equal(fields.decimals!.status, 'INVALID_RESPONSE'); assert.equal(Object.hasOwn(fields.decimals!, 'value'), false);
        assert.equal(report.assetIdentity.decimals.status, 'UNKNOWN');
      } else if (['rpc', 'rpc-revert', 'transport', 'envelope'].includes(fault)) {
        assert.equal(fields.decimals!.status, 'READ_FAILED');
        assert.equal(fields.decimals!.errorKind, fault.startsWith('rpc') ? 'RPC_ERROR' : 'TRANSPORT_ERROR');
      } else if (fault.startsWith('uint8')) assert.deepEqual(report.assetIdentity.decimals, { status: 'KNOWN', value: fault === 'uint8-zero' ? 0 : 255 });
      if (fault === 'empty-labels') assert.deepEqual(report.assetIdentity.symbol, { status: 'KNOWN', value: '' });
      if (fault === 'balance-rpc') assert.equal(report.results.find(r => r.scenarioId === 'TRC20-000')!.executionStatus, 'ERROR');
      if (fault === 'closing-head-invalid') assert.equal((report.evidence.find(e => e.kind === 'TRON_STATE_CONTEXT')!.data as { closingHeadAvailable: boolean }).closingHeadAvailable, false);
      if (fault === 'head-stable' || fault === 'head-reorg') {
        const context = report.evidence.find(e => e.kind === 'TRON_STATE_CONTEXT')!.data as { headChanged: boolean };
        assert.equal(context.headChanged, fault === 'head-reorg');
        assert.equal(report.assetIdentity.observedBlockOrSlot, 'UNKNOWN', 'Matching heads must not manufacture state binding');
      }
    }
    for (const fault of ['chain-mismatch', 'chain-invalid', 'empty-code', 'odd-code', 'head-invalid', 'head-prefix-invalid', 'head-hash-invalid', 'head-number-invalid']) {
      node.fault(fault); await assert.rejects(adapter.assessReadOnly(input));
    }
    node.fault(''); const recovered = await adapter.assessReadOnly(input); assertSerializedReport(recovered);
    assert.equal(recovered.results.find(r => r.scenarioId === 'TRC20-001')!.observations.decodeComplete, true);
  } finally { await node.close(); }
});

test('TRON CLI selects its endpoint, saves valid reports and preserves output on invalid input', async () => {
  const node = await mockNode(), directory = await mkdtemp(join(tmpdir(), 'tron-cli-'));
  const cli = (args: string[], endpoint: string | null = node.url) => new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const env = { ...process.env, RPC_URL: 'invalid-synthetic-evm-endpoint', TRON_RPC_URL: endpoint ?? undefined };
    const child = spawn(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'src/cli.ts', ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; child.stdout.on('data', data => { stdout += String(data); }); child.stderr.on('data', data => { stderr += String(data); });
    child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
  });
  try {
    const path = join(directory, 'report.json'), args = ['assess', '--chain', 'tron', '--network', networkId, '--token', token];
    const result = await cli([...args, '--out', path]); assert.equal(result.code, 0); assert.equal(result.stdout, '');
    const saved = await readFile(path, 'utf8'); assertReportContract(JSON.parse(saved)); assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert(result.stderr.includes('"INCONCLUSIVE":1')); assert(result.stderr.includes('"NOT_TESTED":7'));
    const streamed = await cli([...args, '--holder', owner]); assert.equal(streamed.code, 0); assertReportContract(JSON.parse(streamed.stdout));
    const bad = await cli(['assess', '--chain', 'tron', '--network', networkId, '--token', 'invalid-sensitive-input', '--out', path]);
    assert.equal(bad.code, 1); assert.equal(await readFile(path, 'utf8'), saved); assert(!bad.stderr.includes('invalid-sensitive-input'));
    assert(bad.stderr.includes('Invalid TRON address.')); assert(!bad.stderr.includes(node.url));
    const unknown = await cli(['assess', '--chain', 'solana', '--network', networkId, '--token', token]); assert.equal(unknown.code, 1);
    const missing = await cli(args, null); assert.equal(missing.code, 1); assert(missing.stderr.includes('Set TRON_RPC_URL in the environment'));
    const paired = await cli([...args, '--holder', owner, '--spender', other]);
    assert.equal(paired.code, 0); const pairReport = JSON.parse(paired.stdout); assertReportContract(pairReport);
    assert.equal(pairReport.results.find((r: { scenarioId: string }) => r.scenarioId === 'TRC20-007')!.observations.allowance, max.toString());
    for (const badArgs of [[...args, '--spender', other], [...args, '--holder', owner, '--spender', ''],
      [...args, '--holder', '', '--spender', other], [...args, '--holder', owner, '--spender', 'invalid'],
      ['assess', '--network', networkId, '--token', token, '--spender', other],
      ['assess', '--chain', 'evm', '--network', networkId, '--token', token, '--spender', other],
      ['lab', '--spender', other]]) {
      const before = node.methods.length; const rejected = await cli(badArgs);
      assert.equal(rejected.code, 1); assert.equal(node.methods.length, before); assert.equal(rejected.stdout, '');
    }
    node.fault('uint8-overflow'); const invalid = await cli(args); assert.equal(invalid.code, 0);
    const report = JSON.parse(invalid.stdout); assertReportContract(report); assert.equal(report.assetIdentity.decimals.status, 'UNKNOWN');
  } finally { await node.close(); await rm(directory, { recursive: true, force: true }); }
});


test('TRON allowance preserves pair order, exact amounts, normalization and concurrent evidence isolation', async () => {
  const node = await mockNode();
  try {
    const adapter = new TronReadOnlyAdapter(node.url), base = { networkId, assetAddress: token };
    const pairs = [[owner, other], [owner, owner], [other, owner]] as const;
    const reports = await Promise.all(pairs.map(([a, b]) => adapter.assessReadOnly({ ...base,
      accountAddress: tronAddress(a).hex, spenderAddress: b })));
    assert.equal(new Set(reports.map(r => r.assessmentId)).size, reports.length);
    reports.forEach((report, i) => {
      assertSerializedReport(report);
      const [a, b] = pairs[i]!, result = report.results.find(r => r.scenarioId === 'TRC20-007')!;
      assert.deepEqual(result.observations, { owner: a, spender: b, allowance: i === 0 ? max : 0n, readStatus: 'OK' });
      assert.equal(result.verdict, 'INCONCLUSIVE'); assert.equal(result.support, 'UNKNOWN');
      assert.equal(result.executionStatus, 'COMPLETED'); assert.equal(result.observedBlockOrSlot, 'UNKNOWN');
      assert.equal(report.results.find(r => r.scenarioId === 'TRC20-003')!.verdict, 'NOT_TESTED');
      const query = report.evidence.filter(e => e.kind === 'RPC').map(e => e.data as { method: string; params: { data?: string }[] })
        .filter(e => e.method === 'eth_call' && e.params[0]?.data?.startsWith('0xdd62ed3e'));
      assert.equal(query.length, 1);
      assert.equal(query[0]!.params[0]!.data, encodeFunctionData({ abi, functionName: 'allowance', args: [tronAddress(a).rpc, tronAddress(b).rpc] }));
      const decode = report.evidence.find(e => e.kind === 'TRON_ALLOWANCE_DECODE')!;
      assert(result.evidenceReferences.includes(decode.id));
      assert(!report.results.find(r => r.scenarioId === 'TRC20-000')!.evidenceReferences.includes(decode.id));
      assert.deepEqual(decode.data, { owner: a, spender: b, status: 'OK', value: i === 0 ? max : 0n });
      for (const otherReport of reports) if (otherReport !== report) {
        assert.notEqual(report.evidence, otherReport.evidence);
        assert(!otherReport.evidence.includes(decode));
      }
      assert.equal(JSON.parse(json(report)).results.find((r: { scenarioId: string }) => r.scenarioId === 'TRC20-007').observations.allowance,
        i === 0 ? max.toString() : '0');
    });
    for (const accountAddress of [undefined, owner]) {
      const start = node.calls.length, report = await adapter.assessReadOnly({ ...base, ...(accountAddress ? { accountAddress } : {}) });
      assert.equal(report.results.find(r => r.scenarioId === 'TRC20-007')!.verdict, 'NOT_TESTED');
      assert(!node.calls.slice(start).some(c => c.data.startsWith('0xdd62ed3e')));
      if (accountAddress) assert.equal(report.results.find(r => r.scenarioId === 'TRC20-000')!.observations.balance, max);
    }
  } finally { await node.close(); }
});

test('TRON allowance rejects invalid pairs before RPC and recovers from read/decode failures without invented zero', async () => {
  const node = await mockNode();
  try {
    const adapter = new TronReadOnlyAdapter(node.url), base = { networkId, assetAddress: token };
    for (const pair of [{ spenderAddress: other }, { accountAddress: '', spenderAddress: other },
      ...['', 'invalid', other.slice(0, -1) + '1', null, 42, {}].map(spenderAddress => ({ accountAddress: owner, spenderAddress }))]) {
      const before = node.methods.length;
      await assert.rejects(adapter.assessReadOnly({ ...base, ...pair } as Parameters<typeof adapter.assessReadOnly>[0]));
      assert.equal(node.methods.length, before);
    }
    for (const fault of ['allowance-short', 'allowance-rpc', 'allowance-transport', '']) {
      node.fault(fault);
      const report = await adapter.assessReadOnly({ ...base, accountAddress: owner, spenderAddress: other });
      assertSerializedReport(report); assert(!json(report).includes('UPSTREAM_DIAGNOSTIC_CANARY'));
      const result = report.results.find(r => r.scenarioId === 'TRC20-007')!;
      assert.equal(result.verdict, 'INCONCLUSIVE');
      assert.equal(result.observations.readStatus, !fault ? 'OK' : fault === 'allowance-short' ? 'INVALID_RESPONSE' : 'READ_FAILED');
      assert.equal(result.executionStatus, fault === 'allowance-rpc' || fault === 'allowance-transport' ? 'ERROR' : 'COMPLETED');
      if (fault) assert.equal(Object.hasOwn(result.observations, 'allowance'), false);
      else assert.equal(result.observations.allowance, max);
      if (fault === 'allowance-rpc') assert.equal(result.observations.errorKind, 'RPC_ERROR');
      if (fault === 'allowance-transport') assert.equal(result.observations.errorKind, 'TRANSPORT_ERROR');
      assert.equal(report.results.find(r => r.scenarioId === 'TRC20-000')!.observations.balance, max);
    }
    assert(node.methods.every(m => ['eth_chainId', 'eth_getBlockByNumber', 'eth_getCode', 'eth_call'].includes(m)));
  } finally { await node.close(); }
});
