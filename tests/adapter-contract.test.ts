import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getAddress, type Address } from 'viem';
import { EvmReadOnlyAdapter } from '../src/evm/adapter.js';
import { LocalLab } from '../src/lab/anvil.js';
import { compileFixtures } from '../src/lab/compiler.js';
import { send, FixtureExecutor } from '../src/evm/executor.js';
import { scenarios } from '../src/evm/scenarios.js';
import { verifyReadOnlyAdapterContract } from './helpers/read-only-adapter-contract.js';
import { assessReadOnly } from '../src/assessment.js';
import { json } from '../src/domain/evaluator.js';
import type { AssessmentReport } from '../src/domain/model.js';
import type { ReadOnlyAssessmentRequest } from '../src/domain/adapter.js';
import { assertSerializedReport } from './helpers/report-contract.js';
import { RpcError } from '../src/evm/rpc.js';

function normalized(report: AssessmentReport): unknown {
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      key === 'assessmentId' ? 'ASSESSMENT_UUID' : ['observedAt', 'startedAt', 'completedAt'].includes(key) ? 'TIME' : visit(item)]));
    return value;
  }
  return visit(JSON.parse(json(report)));
}

test('EVM adapter contract: isolated concurrent requests, recovery and no state-changing RPC', { timeout: 60_000 }, async () => {
  const lab = await LocalLab.start();
  try {
    const { bytecodes } = await compileFixtures();
    const [owner, recipient] = await lab.rpc.request<Address[]>('eth_accounts'); assert(owner && recipient);
    const receipt = await send(lab.rpc, { from: owner, data: bytecodes.StandardToken!, gas: '0x7a1200' });
    assert(receipt.contractAddress); const token = getAddress(receipt.contractAddress);
    const executor = new FixtureExecutor(lab.rpc, token);
    const initial = { block: await lab.rpc.request('eth_blockNumber'), balance: await executor.read('balanceOf', [owner]),
      allowance: await executor.read('allowance', [owner, recipient]) };
    const allowed = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call']);
    const requests: string[] = [], prohibited: string[] = [];
    let fault: 'none' | 'metadata' | 'chain' = 'none';
    const server = createServer(async (req, res) => {
      let raw = ''; for await (const chunk of req) raw += String(chunk);
      const body = JSON.parse(raw) as { id: number; method: string; params: unknown[] };
      requests.push(body.method);
      if (!allowed.has(body.method)) {
        prohibited.push(body.method);
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Read-only gateway' } })); return;
      }
      if ((fault === 'metadata' && body.method === 'eth_call') || (fault === 'chain' && body.method === 'eth_chainId')) {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'Injected local RPC failure' } })); return;
      }
      try { res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: await lab.rpc.request(body.method, body.params) })); }
      catch { res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'Local gateway error' } })); }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert(address && typeof address !== 'string');
    try {
      const rpcUrl = `http://127.0.0.1:${address.port}`;
      const adapter = new EvmReadOnlyAdapter(rpcUrl);
      const base = { networkId: '31337', assetAddress: token };
      const wrapper = (input: ReadOnlyAssessmentRequest) => assessReadOnly({ rpcUrl, networkId: input.networkId,
        token: input.assetAddress, ...(input.accountAddress ? { holder: input.accountAddress } : {}) });
      await verifyReadOnlyAdapterContract({ adapter,
        requests: [{ ...base, accountAddress: owner }, { ...base, accountAddress: recipient }, base],
        invalidRequests: [{ ...base, networkId: '1' }, { ...base, assetAddress: 'invalid' },
          { ...base, assetAddress: recipient }, { ...base, accountAddress: 'invalid' }],
        unexecuted: scenarios.filter(s => s.id !== 'ERC20-000').map(s => ({ scenarioId: s.id, capability: s.capability })),
        verifyObservation(report, index) {
          const balance = report.results.find(r => r.scenarioId === 'ERC20-000'); assert(balance);
          if (index === 2) assert.equal(balance.verdict, 'NOT_TESTED');
          else {
            assert.equal(balance.verdict, 'PASS');
            assert.equal(balance.observations.balance, index === 0 ? initial.balance : 0n);
            assert.equal(balance.observations.holder, getAddress(index === 0 ? owner : recipient));
          }
          assert.deepEqual(report.assetIdentity.contractAddress, { status: 'KNOWN', value: token });
          const balanceCalls = report.evidence.filter(e => e.kind === 'RPC').map(e => e.data as {
            method: string; params: { data?: string }[];
          }).filter(e => e.method === 'eth_call' && e.params[0]?.data?.startsWith(executor.data('balanceOf', [owner]).slice(0, 10)));
          assert.equal(balanceCalls.length, index === 2 ? 0 : 1, 'No other request balance calls in evidence');
          if (index !== 2) assert.equal(balanceCalls[0]!.params[0]!.data, executor.data('balanceOf', [index === 0 ? owner : recipient]));
        },
      });
      // Compare the complete wire result; only generated UUIDs and wall-clock timestamps differ.
      for (const input of [base, { ...base, accountAddress: owner }]) {
        assert.deepEqual(normalized(await adapter.assessReadOnly(input)), normalized(await wrapper(input)));
      }
      for (const input of [{ ...base, networkId: '1' }, { ...base, assetAddress: 'invalid' },
        { ...base, assetAddress: recipient }, { ...base, accountAddress: 'invalid' }]) {
        const messages: string[] = [];
        for (const operation of [() => adapter.assessReadOnly(input), () => wrapper(input)]) {
          await assert.rejects(operation, error => { assert(error instanceof Error); messages.push(error.message); return true; });
        }
        assert.equal(messages[0], messages[1]);
      }
      fault = 'metadata';
      const failed = await adapter.assessReadOnly(base);
      assertSerializedReport(failed);
      assert.equal(failed.results.find(r => r.scenarioId === 'ERC20-001')!.verdict, 'INCONCLUSIVE');
      assert.deepEqual(normalized(failed), normalized(await wrapper(base)));
      fault = 'chain';
      for (const operation of [() => adapter.assessReadOnly(base), () => wrapper(base)]) {
        await assert.rejects(operation, error => {
          assert(error instanceof RpcError); assert.equal(error.code, -32000);
          assert.equal(error.category, 'RPC_ERROR'); return true;
        });
      }
      fault = 'none';
      assertSerializedReport(await adapter.assessReadOnly(base));
      assert(requests.includes('eth_getStorageAt') && requests.includes('eth_call'));
      assert.deepEqual(prohibited, []);
      assert.equal(await lab.rpc.request('eth_blockNumber'), initial.block);
      assert.equal(await executor.read('balanceOf', [owner]), initial.balance);
      assert.equal(await executor.read('allowance', [owner, recipient]), initial.allowance);
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  } finally { await lab.stop(); }
});
