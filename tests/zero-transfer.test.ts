import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAddress, type Address } from 'viem';
import { createServer } from 'node:http';
import { LocalLab } from '../src/lab/anvil.js';
import { compileFixtures } from '../src/lab/compiler.js';
import { assessFixture } from '../src/assessment.js';
import { FixtureExecutor, send, type Execution } from '../src/evm/executor.js';
import { json } from '../src/domain/evaluator.js';
import { assertSerializedReport } from './helpers/report-contract.js';
import { assertEvmBlockReferences } from './helpers/evm-block-reference.js';
import { Rpc, RpcError } from '../src/evm/rpc.js';
import { writeReportAtomically } from '../src/report-output.js';

test('zero transfer: actual receipts/events, unchanged sampled state, negative fixtures and snapshot recovery', { timeout: 60_000 }, async () => {
  const lab = await LocalLab.start();
  try {
    const { bytecodes, build } = await compileFixtures();
    const samples = [];
    const accounts = await lab.rpc.request<Address[]>('eth_accounts');
    const actors = { owner: getAddress(accounts[0]!), recipient: getAddress(accounts[1]!), spender: getAddress(accounts[2]!) };
    for (const [fixture, verdict, returnKind, receiptStatus, eventValid, balancesUnchanged, ordinaryVerdict] of [
      ['StandardToken', 'PASS', 'TRUE', '0x1', true, true, 'PASS'],
      ['NoReturnToken', 'PASS', 'EMPTY', '0x1', true, true, 'PASS'],
      ['FeeToken', 'PASS', 'TRUE', '0x1', true, true, 'PASS'],
      ['FalseReturnToken', 'FAIL', 'FALSE', '0x1', false, true, 'FAIL'],
      ['MalformedReturnToken', 'FAIL', 'MALFORMED', '0x1', true, true, 'FAIL'],
      ['MissingEventToken', 'FAIL', 'TRUE', '0x1', false, true, 'FAIL'],
      ['ZeroTransferRevertToken', 'FAIL', 'REVERT', '0x0', false, true, 'PASS'],
      ['ZeroTransferNoEventToken', 'FAIL', 'TRUE', '0x1', false, true, 'PASS'],
      ['ZeroTransferMutatingToken', 'FAIL', 'TRUE', '0x1', true, false, 'PASS'],
    ] as const) {
      const deployment = await send(lab.rpc, { from: actors.owner, data: bytecodes[fixture]!, gas: '0x7a1200' });
      assert(deployment.contractAddress); assert.equal(deployment.status, '0x1');
      const report = await assessFixture(lab.rpc, deployment.contractAddress, actors);
      assertSerializedReport(report); assertEvmBlockReferences(report);
      const zero = report.results.find(r => r.scenarioId === 'ERC20-008'); assert(zero, fixture);
      assert.equal(zero.capability, 'TRANSFER'); assert.equal(zero.scenarioVersion, '1.0.0');
      assert.equal(zero.verdict, verdict, fixture);
      assert.equal(zero.support, verdict === 'PASS' ? 'SUPPORTED' : 'UNKNOWN');
      assert.equal(zero.executionStatus, 'COMPLETED');
      assert.equal(report.results.find(r => r.scenarioId === 'ERC20-002')!.verdict, ordinaryVerdict);
      assert.deepEqual(report.results.find(r => r.scenarioId === 'ERC20-002')!.observations.before,
        { sender: 1_000_000_000_000n, receiver: 0n }, 'Zero scenario must restore state before the next transfer');
      assert.equal(zero.observations.requested, 0n);
      assert.equal(zero.observations.eventValid, eventValid, fixture);
      assert.equal(zero.observations.balancesUnchanged, balancesUnchanged, fixture);
      assert.equal(zero.observations.supplyUnchanged, true);
      assert.equal(zero.observations.supplyBefore, 1_000_000_000_000n);
      assert.equal(zero.observations.supplyAfter, 1_000_000_000_000n);
      const tx = zero.observations.tx as Execution;
      assert.equal(tx.returnKind, returnKind); assert.equal(tx.receipt.status, receiptStatus);
      const matching = tx.events.filter(e => e.name === 'Transfer' && e.args.from === actors.owner && e.args.to === actors.recipient && e.args.value === 0n);
      assert.equal(matching.length, eventValid ? 1 : 0);
      const references = report.evidence.filter(e => zero.evidenceReferences.includes(e.id));
      assert(references.some(e => e.kind === 'MINED_RECEIPT' && (e.data as { transactionHash: string }).transactionHash === tx.receipt.transactionHash));
      assert(references.some(e => e.kind === 'EXECUTION_DECODE' && (e.data as { args: unknown[] }).args[1] === 0n));
      const wire = JSON.parse(json(report)) as { results: { scenarioId: string; observations: { requested: unknown } }[] };
      assert.equal(wire.results.find(r => r.scenarioId === 'ERC20-008')!.observations.requested, '0');
      const executor = new FixtureExecutor(lab.rpc, deployment.contractAddress);
      // The deliberately mutating transaction is visible inside its scenario, then reverted.
      assert.equal(await executor.read('balanceOf', [actors.owner]), 1_000_000_000_000n);
      assert.equal(await executor.read('balanceOf', [actors.recipient]), 0n);
      assert.equal(await executor.read('totalSupply'), 1_000_000_000_000n);
      samples.push({ fixture, deployment, bytecode: bytecodes[fixture], report });
    }
    await writeReportAtomically('reports/zero-transfer-local.json', json({
      schemaVersion: '1.0', kind: 'ZERO_TRANSFER_LOCAL_EVIDENCE', mode: 'SIMULATION',
      description: 'New private Anvil fixtures; focused zero transfer checks with full baseline assessments',
      focusScenarioId: 'ERC20-008', build, samples,
    }));
  } finally { await lab.stop(); }
});

test('zero transfer transport/read failures are inconclusive and do not contaminate the next scenario', { timeout: 60_000 }, async () => {
  const lab = await LocalLab.start();
  try {
    const { bytecodes } = await compileFixtures();
    const accounts = await lab.rpc.request<Address[]>('eth_accounts');
    const actors = { owner: getAddress(accounts[0]!), recipient: getAddress(accounts[1]!), spender: getAddress(accounts[2]!) };
    for (const fault of ['preflight-rpc', 'preflight-transport', 'post-read-rpc', 'post-read-malformed'] as const) {
      const deployment = await send(lab.rpc, { from: actors.owner, data: bytecodes.StandardToken!, gas: '0x7a1200' });
      assert(deployment.contractAddress);
      const executor = new FixtureExecutor(lab.rpc, deployment.contractAddress);
      const zeroData = executor.data('transfer', [actors.recipient, 0n]);
      const balanceData = executor.data('balanceOf', [actors.owner]);
      let injected = false, zeroSubmitted = false;
      const server = createServer(async (request, response) => {
        let raw = ''; for await (const chunk of request) raw += String(chunk);
        const body = JSON.parse(raw) as { id: number; method: string; params: unknown[] };
        const transaction = body.params[0] as { data?: string } | undefined;
        if (body.method === 'eth_sendTransaction' && transaction?.data === zeroData) zeroSubmitted = true;
        if (body.method === 'evm_revert') zeroSubmitted = false;
        const trigger = !injected && body.method === 'eth_call' && (fault.startsWith('preflight')
          ? transaction?.data === zeroData : zeroSubmitted && transaction?.data === balanceData);
        if (trigger) {
          injected = true;
          if (fault === 'preflight-transport') { response.destroy(); return; }
          response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, ...(fault === 'post-read-malformed'
            ? { result: '0x01' } : { error: { code: -32000, message: 'Injected local observation failure' } }) })); return;
        }
        try { response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: await lab.rpc.request(body.method, body.params) })); }
        catch (error) {
          response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: {
            code: error instanceof RpcError ? error.code : -32000,
            message: error instanceof RpcError && error.reverted ? 'execution reverted' : 'Local forwarding failure',
          } }));
        }
      });
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      const address = server.address(); assert(address && typeof address !== 'string');
      try {
        const report = await assessFixture(new Rpc(`http://127.0.0.1:${address.port}`), deployment.contractAddress, actors);
        assert(injected, fault); assertSerializedReport(report);
        const zero = report.results.find(r => r.scenarioId === 'ERC20-008')!;
        assert.equal(zero.verdict, 'INCONCLUSIVE'); assert.equal(zero.executionStatus, 'ERROR');
        assert.equal(zero.support, 'UNKNOWN');
        assert.equal(Object.hasOwn(zero.observations, 'balancesUnchanged'), false);
        assert.equal(report.results.find(r => r.scenarioId === 'ERC20-002')!.verdict, 'PASS', fault);
        const mined = zero.evidenceReferences.some(id => report.evidence.find(e => e.id === id)?.kind === 'MINED_RECEIPT');
        assert.equal(mined, fault.startsWith('post-read'));
        assert.equal(await executor.read('balanceOf', [actors.owner]), 1_000_000_000_000n);
        assert.equal(await executor.read('balanceOf', [actors.recipient]), 0n);
      } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    }
  } finally { await lab.stop(); }
});
