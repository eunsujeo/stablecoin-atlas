import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getAddress, type Address } from 'viem';
import { LocalLab } from '../src/lab/anvil.js';
import { compileFixtures } from '../src/lab/compiler.js';
import { assessFixture } from '../src/assessment.js';
import { FixtureExecutor, send, type Execution } from '../src/evm/executor.js';
import { Rpc, RpcError } from '../src/evm/rpc.js';
import { json } from '../src/domain/evaluator.js';
import { writeReportAtomically } from '../src/report-output.js';
import { assertSerializedReport } from './helpers/report-contract.js';
import { assertEvmBlockReferences } from './helpers/evm-block-reference.js';

test('zero transferFrom verifies approval, spender, events, allowance and snapshot cleanup on real fixtures', { timeout: 120_000 }, async () => {
  const lab = await LocalLab.start();
  try {
    const { bytecodes, build } = await compileFixtures();
    const accounts = await lab.rpc.request<Address[]>('eth_accounts');
    const actors = { owner: getAddress(accounts[0]!), recipient: getAddress(accounts[1]!), spender: getAddress(accounts[2]!) };
    const samples = [];
    for (const [fixture, verdict, returnKind, eventValid, balancesUnchanged, allowanceUnchanged] of [
      ['StandardToken', 'PASS', 'TRUE', true, true, true],
      ['NoReturnToken', 'PASS', 'EMPTY', true, true, true],
      ['FeeToken', 'PASS', 'TRUE', true, true, true],
      ['FalseReturnToken', 'INCONCLUSIVE', null, false, true, true],
      ['MalformedReturnToken', 'INCONCLUSIVE', null, false, true, true],
      ['ApprovalNoEventToken', 'INCONCLUSIVE', null, false, true, true],
      ['ApprovalWrongAllowanceToken', 'INCONCLUSIVE', null, false, true, true],
      ['MissingEventToken', 'FAIL', 'TRUE', false, true, true],
      ['ZeroTransferRevertToken', 'FAIL', 'REVERT', false, true, true],
      ['ZeroTransferNoEventToken', 'FAIL', 'TRUE', false, true, true],
      ['ZeroTransferMutatingToken', 'FAIL', 'TRUE', true, false, true],
      ['ZeroDelegationRevertToken', 'FAIL', 'REVERT', false, true, true],
      ['ZeroDelegationConsumesAllowanceToken', 'FAIL', 'TRUE', true, true, false],
      ['ZeroDelegationFalseToken', 'FAIL', 'FALSE', false, true, true],
      ['ZeroDelegationMalformedToken', 'FAIL', 'MALFORMED', false, true, true],
    ] as const) {
      const deployment = await send(lab.rpc, { from: actors.owner, data: bytecodes[fixture]!, gas: '0x7a1200' });
      assert.equal(deployment.status, '0x1'); assert(deployment.contractAddress);
      const report = await assessFixture(lab.rpc, deployment.contractAddress, actors);
      assertSerializedReport(report); assertEvmBlockReferences(report);
      const zero = report.results.find(r => r.scenarioId === 'ERC20-009')!;
      assert.equal(zero.verdict, verdict, fixture);
      assert.equal(zero.capability, 'ALLOWANCE'); assert.equal(zero.scenarioVersion, '1.0.0');
      assert.equal(zero.executionStatus, 'COMPLETED');
      assert.equal(zero.support, verdict === 'PASS' ? 'SUPPORTED' : 'UNKNOWN');
      const observed = zero.observations;
      const refs = report.evidence.filter(e => zero.evidenceReferences.includes(e.id));
      const decoded = refs.filter(e => e.kind === 'EXECUTION_DECODE').map(e => e.data as { from: Address; function: string; args: unknown[]; transactionHash: string });
      const approval = observed.approval as Execution;
      assert(refs.some(e => e.kind === 'MINED_RECEIPT' && (e.data as { transactionHash: string }).transactionHash === approval.receipt.transactionHash));
      assert.equal(observed.requested, 0n);
      assert.equal(JSON.parse(json(zero)).observations.requested, '0');
      assert.equal(observed.zeroTransferAttempted, returnKind !== null);
      if (returnKind === null) {
        assert.equal(observed.approvalVerified, false);
        assert.equal(Object.hasOwn(observed, 'tx'), false);
        assert.equal(decoded.length, 1); assert.equal(decoded[0]!.function, 'approve');
        assert.equal(decoded.some(e => e.function === 'transferFrom'), false);
        assert.equal(observed.initialAllowance, fixture === 'FalseReturnToken' ? 0n : fixture === 'ApprovalWrongAllowanceToken' ? 10_001n : 10_000n);
        assert.equal(observed.approvalEventValid, fixture !== 'ApprovalNoEventToken' && fixture !== 'FalseReturnToken');
      } else {
        assert.equal(observed.approvalVerified, true);
        assert.equal(observed.initialAllowance, 10_000n);
        assert.equal(approval.returnKind, fixture === 'NoReturnToken' ? 'EMPTY' : 'TRUE');
        assert.equal(approval.receipt.status, '0x1');
        const tx = observed.tx as Execution;
        assert.equal(tx.returnKind, returnKind);
        assert.equal(tx.receipt.status, returnKind === 'REVERT' ? '0x0' : '0x1');
        assert.notEqual(tx.receipt.transactionHash, approval.receipt.transactionHash);
        assert.equal(observed.eventValid, eventValid);
        assert.equal(observed.balancesUnchanged, balancesUnchanged);
        assert.equal(observed.supplyUnchanged, true);
        assert.equal(observed.allowanceUnchanged, allowanceUnchanged);
        assert.equal(observed.allowanceBefore, 10_000n);
        assert.equal(observed.allowanceAfter, allowanceUnchanged ? 10_000n : 9_999n);
        assert.deepEqual(observed.before, { sender: 1_000_000_000_000n, receiver: 0n });
        assert.deepEqual(observed.after, balancesUnchanged ? observed.before : { sender: 999_999_999_999n, receiver: 1n });
        assert.equal(observed.supplyBefore, 1_000_000_000_000n); assert.equal(observed.supplyAfter, 1_000_000_000_000n);
        assert.equal(tx.events.filter(e => e.name === 'Transfer' && e.args.from === actors.owner && e.args.to === actors.recipient && e.args.value === 0n).length, eventValid ? 1 : 0);
        const delegation = decoded.find(e => e.function === 'transferFrom'); assert(delegation);
        assert.equal(delegation.from, actors.spender);
        assert.deepEqual(delegation.args, [actors.owner, actors.recipient, 0n]);
        assert.equal(delegation.transactionHash, tx.receipt.transactionHash);
        assert(refs.some(e => e.kind === 'MINED_RECEIPT' && (e.data as { transactionHash: string }).transactionHash === tx.receipt.transactionHash));
      }
      if (fixture.startsWith('ZeroDelegation')) {
        assert.equal(report.results.find(r => r.scenarioId === 'ERC20-008')!.verdict, 'PASS', 'Direct zero success cannot establish delegated zero behavior');
        assert.equal(report.results.find(r => r.scenarioId === 'ERC20-004')!.verdict, 'PASS');
      }
      assert.deepEqual(report.results.find(r => r.scenarioId === 'ERC20-002')!.observations.before,
        { sender: 1_000_000_000_000n, receiver: 0n });
      const executor = new FixtureExecutor(lab.rpc, deployment.contractAddress);
      assert.equal(await executor.read('balanceOf', [actors.owner]), 1_000_000_000_000n);
      assert.equal(await executor.read('balanceOf', [actors.recipient]), 0n);
      assert.equal(await executor.read('totalSupply'), 1_000_000_000_000n);
      assert.equal(await executor.read('allowance', [actors.owner, actors.spender]), 0n);
      samples.push({ fixture, deployment, bytecode: bytecodes[fixture], report });
    }
    await writeReportAtomically('reports/zero-transfer-from-local.json', json({ schemaVersion: '1.0',
      kind: 'ZERO_TRANSFER_FROM_LOCAL_EVIDENCE', mode: 'SIMULATION', focusScenarioId: 'ERC20-009', build, samples }));
  } finally { await lab.stop(); }
});

test('zero transferFrom missing preflight or post-call allowance evidence remains inconclusive and restores approval', { timeout: 60_000 }, async () => {
  const lab = await LocalLab.start();
  try {
    const { bytecodes } = await compileFixtures();
    const accounts = await lab.rpc.request<Address[]>('eth_accounts');
    const actors = { owner: getAddress(accounts[0]!), recipient: getAddress(accounts[1]!), spender: getAddress(accounts[2]!) };
    for (const fault of ['preflight-rpc', 'preflight-transport', 'post-allowance-rpc', 'post-allowance-malformed'] as const) {
      const deployment = await send(lab.rpc, { from: actors.owner, data: bytecodes.StandardToken!, gas: '0x7a1200' }); assert(deployment.contractAddress);
      const executor = new FixtureExecutor(lab.rpc, deployment.contractAddress);
      const zeroData = executor.data('transferFrom', [actors.owner, actors.recipient, 0n]);
      const allowanceData = executor.data('allowance', [actors.owner, actors.spender]);
      let injected = false, zeroSubmitted = false;
      const server = createServer(async (request, response) => {
        let raw = ''; for await (const chunk of request) raw += String(chunk);
        const body = JSON.parse(raw) as { id: number; method: string; params: unknown[] };
        const tx = body.params[0] as { data?: string } | undefined;
        if (body.method === 'eth_sendTransaction' && tx?.data === zeroData) zeroSubmitted = true;
        if (body.method === 'evm_revert') zeroSubmitted = false;
        if (!injected && body.method === 'eth_call' && (fault.startsWith('preflight') ? tx?.data === zeroData : zeroSubmitted && tx?.data === allowanceData)) {
          injected = true;
          if (fault === 'preflight-transport') { response.destroy(); return; }
          response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, ...(fault.endsWith('malformed')
            ? { result: '0x01' } : { error: { code: -32000, message: 'Injected local observation failure' } }) })); return;
        }
        try { response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: await lab.rpc.request(body.method, body.params) })); }
        catch (error) { response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: {
          code: error instanceof RpcError ? error.code : -32000,
          message: error instanceof RpcError && error.reverted ? 'execution reverted' : 'Local forwarding failure',
        } })); }
      });
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      const address = server.address(); assert(address && typeof address !== 'string');
      try {
        const report = await assessFixture(new Rpc(`http://127.0.0.1:${address.port}`), deployment.contractAddress, actors);
        assert(injected, fault); assertSerializedReport(report);
        const zero = report.results.find(r => r.scenarioId === 'ERC20-009')!;
        assert.equal(zero.verdict, 'INCONCLUSIVE'); assert.equal(zero.executionStatus, 'ERROR'); assert.equal(zero.support, 'UNKNOWN');
        assert.equal(Object.hasOwn(zero.observations, 'allowanceUnchanged'), false);
        const receipts = zero.evidenceReferences.filter(id => report.evidence.find(e => e.id === id)?.kind === 'MINED_RECEIPT');
        assert.equal(receipts.length, fault.startsWith('post-') ? 2 : 1);
        assert.equal(report.results.find(r => r.scenarioId === 'ERC20-004')!.verdict, 'PASS');
        assert.equal(await executor.read('allowance', [actors.owner, actors.spender]), 0n);
        assert.equal(await executor.read('balanceOf', [actors.owner]), 1_000_000_000_000n);
        assert.equal(await executor.read('balanceOf', [actors.recipient]), 0n);
      } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    }
  } finally { await lab.stop(); }
});
