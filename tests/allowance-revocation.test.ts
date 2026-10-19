import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getAddress, type Address } from 'viem';
import { LocalLab } from '../src/lab/anvil.js';
import { compileFixtures } from '../src/lab/compiler.js';
import { assessFixture } from '../src/assessment.js';
import { eventMatches, FixtureExecutor, send, type Execution } from '../src/evm/executor.js';
import { Rpc, RpcError } from '../src/evm/rpc.js';
import { json } from '../src/domain/evaluator.js';
import { writeReportAtomically } from '../src/report-output.js';
import { assertSerializedReport } from './helpers/report-contract.js';
import { assertEvmBlockReferences } from './helpers/evm-block-reference.js';

test('allowance revocation: actual approvals, rejection/state/event negatives and full snapshot recovery', { timeout: 120_000 }, async () => {
  const lab = await LocalLab.start();
  try {
    const { bytecodes, build } = await compileFixtures();
    const accounts = await lab.rpc.request<Address[]>('eth_accounts');
    const actors = { owner: getAddress(accounts[0]!), recipient: getAddress(accounts[1]!), spender: getAddress(accounts[2]!) };
    const samples = [];
    for (const [fixture, verdict, stage, returnKind] of [
      ['StandardToken', 'PASS', 'probe', 'REVERT'],
      ['NoReturnToken', 'PASS', 'probe', 'REVERT'],
      ['FeeToken', 'PASS', 'probe', 'REVERT'],
      ['ZeroResetToken', 'PASS', 'probe', 'REVERT'],
      ['FalseReturnToken', 'INCONCLUSIVE', 'setup', 'FALSE'],
      ['MalformedReturnToken', 'INCONCLUSIVE', 'setup', 'MALFORMED'],
      ['ApprovalNoEventToken', 'INCONCLUSIVE', 'setup', 'TRUE'],
      ['ApprovalWrongAllowanceToken', 'INCONCLUSIVE', 'setup', 'TRUE'],
      ['RevokeFalseToken', 'FAIL', 'revoke', 'FALSE'],
      ['RevokeNoEventToken', 'FAIL', 'revoke', 'TRUE'],
      ['RevokeResidualAllowanceToken', 'FAIL', 'revoke', 'TRUE'],
      ['RevokeRevertToken', 'FAIL', 'revoke', 'REVERT'],
      ['RevokeMalformedToken', 'FAIL', 'revoke', 'MALFORMED'],
      ['RevokeMutatingToken', 'FAIL', 'revoke', 'TRUE'],
      ['RevokedAllowanceBypassToken', 'FAIL', 'probe', 'TRUE'],
      ['RevokedFalseMutatingToken', 'FAIL', 'probe', 'FALSE'],
      ['RevokedFalseToken', 'PASS', 'probe', 'FALSE'],
      ['RevokedMalformedToken', 'FAIL', 'probe', 'MALFORMED'],
      ['RevokedFalseEventToken', 'FAIL', 'probe', 'FALSE'],
      ['RevokedTrueToken', 'FAIL', 'probe', 'TRUE'],
      ['RevokedMalformedEventToken', 'FAIL', 'probe', 'FALSE'],
    ] as const) {
      const deployment = await send(lab.rpc, { from: actors.owner, data: bytecodes[fixture]!, gas: '0x7a1200' });
      assert.equal(deployment.status, '0x1'); assert(deployment.contractAddress);
      const report = await assessFixture(lab.rpc, deployment.contractAddress, actors);
      assertSerializedReport(report); assertEvmBlockReferences(report);
      const result = report.results.find(r => r.scenarioId === 'ERC20-010')!;
      assert.equal(result.capability, 'ALLOWANCE'); assert.equal(result.scenarioVersion, '1.0.0');
      assert.equal(result.verdict, verdict, fixture); assert.equal(result.executionStatus, 'COMPLETED');
      assert.equal(result.support, verdict === 'PASS' ? 'SUPPORTED' : 'UNKNOWN');
      const o = result.observations;
      assert.equal(o.requested, 1n); assert.equal(JSON.parse(json(result)).observations.requested, '1');
      assert.equal(o.revokeAttempted, stage !== 'setup'); assert.equal(o.probeAttempted, stage === 'probe');
      const refs = report.evidence.filter(e => result.evidenceReferences.includes(e.id));
      const decoded = refs.filter(e => e.kind === 'EXECUTION_DECODE').map(e => e.data as { from: Address; function: string; args: unknown[]; transactionHash: string });
      assert.equal(decoded.length, stage === 'setup' ? 1 : stage === 'revoke' ? 2 : 3);
      assert.deepEqual(decoded[0]!.args, [actors.spender, 10_000n]); assert.equal(decoded[0]!.from, actors.owner);
      const executions = [o.approval, o.revoke, o.negative].filter(Boolean) as Execution[];
      assert.equal(new Set(executions.map(tx => tx.receipt.transactionHash)).size, executions.length);
      for (const tx of executions) assert(refs.some(e => e.kind === 'MINED_RECEIPT' && (e.data as { transactionHash: string }).transactionHash === tx.receipt.transactionHash));
      if (stage === 'setup') {
        assert.equal(o.approvalVerified, false);
        assert.equal((o.approval as Execution).returnKind, returnKind);
        assert.equal(Object.hasOwn(o, 'revoke'), false); assert.equal(Object.hasOwn(o, 'negative'), false);
      } else {
        const revoke = o.revoke as Execution;
        assert.equal(o.approvalVerified, true); assert.equal(o.initialAllowance, 10_000n);
        assert.equal(eventMatches(o.approval as Execution, 'Approval', { owner: actors.owner, spender: actors.spender, value: 10_000n }), true);
        assert.deepEqual(decoded[1]!.args, [actors.spender, 0n]); assert.equal(decoded[1]!.from, actors.owner);
        assert.equal(o.allowanceAfter, ['RevokeFalseToken', 'RevokeResidualAllowanceToken', 'RevokeRevertToken'].includes(fixture) ? 10_000n : 0n);
        assert.equal(o.supplyBefore, 1_000_000_000_000n); assert.equal(o.supplyAfter, 1_000_000_000_000n);
        assert.deepEqual(o.before, { sender: 1_000_000_000_000n, receiver: 0n });
        assert.deepEqual(o.after, { sender: fixture === 'RevokeMutatingToken' ? 999_999_999_999n : 1_000_000_000_000n, receiver: 0n });
        if (stage === 'revoke') {
          assert.equal(o.revokeVerified, false); assert.equal(revoke.returnKind, returnKind);
          assert.equal(revoke.receipt.status, returnKind === 'REVERT' ? '0x0' : '0x1');
          assert.equal(Object.hasOwn(o, 'negative'), false);
          assert.equal(o.revokeEventValid, !['RevokeFalseToken', 'RevokeNoEventToken', 'RevokeRevertToken'].includes(fixture));
        } else {
          const negative = o.negative as Execution;
          const moved = ['RevokedAllowanceBypassToken', 'RevokedFalseMutatingToken'].includes(fixture);
          assert.equal(o.revokeVerified, true); assert.equal(o.probePrerequisiteVerified, true);
          assert.equal(revoke.returnKind, fixture === 'NoReturnToken' ? 'EMPTY' : 'TRUE');
          assert.equal(revoke.receipt.status, '0x1'); assert.equal(o.revokeEventValid, true);
          assert.deepEqual(decoded[2]!.args, [actors.owner, actors.recipient, 1n]); assert.equal(decoded[2]!.from, actors.spender);
          assert.equal(negative.returnKind, returnKind); assert.equal(negative.receipt.status, returnKind === 'REVERT' ? '0x0' : '0x1');
          assert.equal(o.allowanceBefore, 0n); assert.equal(o.allowanceAfterNegative, 0n);
          assert.equal(o.supplyBeforeNegative, 1_000_000_000_000n); assert.equal(o.supplyAfterNegative, 1_000_000_000_000n);
          assert.deepEqual(o.beforeNegative, o.before);
          assert.deepEqual(o.afterNegative, moved ? { sender: 999_999_999_999n, receiver: 1n } : o.beforeNegative);
          assert.equal(o.probeStateUnchanged, !moved);
          assert.equal(o.probeRejected, returnKind === 'REVERT' || returnKind === 'FALSE');
          assert.equal(o.noTransferEvent, !moved && !['RevokedFalseEventToken', 'RevokedMalformedEventToken'].includes(fixture));
          if (fixture === 'RevokedMalformedEventToken') {
            assert.equal(negative.events.length, 0, 'Malformed Transfer must not become a decoded event');
            assert.equal(negative.receipt.logs.length, 1, 'Raw contradictory Transfer log must still prevent PASS');
          }
          const wire = JSON.parse(json(result)).observations;
          assert.equal(wire.allowanceAfterNegative, '0'); assert.equal(wire.supplyAfterNegative, '1000000000000');
        }
      }
      assert.deepEqual(report.results.find(r => r.scenarioId === 'ERC20-002')!.observations.before,
        { sender: 1_000_000_000_000n, receiver: 0n }, 'Next scenario must start from restored state');
      const e = new FixtureExecutor(lab.rpc, deployment.contractAddress);
      assert.equal(await e.read('allowance', [actors.owner, actors.spender]), 0n);
      assert.equal(await e.read('balanceOf', [actors.owner]), 1_000_000_000_000n);
      assert.equal(await e.read('balanceOf', [actors.recipient]), 0n); assert.equal(await e.read('balanceOf', [actors.spender]), 0n);
      assert.equal(await e.read('totalSupply'), 1_000_000_000_000n);
      samples.push({ fixture, deployment, bytecode: bytecodes[fixture], report });
    }
    await writeReportAtomically('reports/allowance-revocation-local.json', json({ schemaVersion: '1.0',
      kind: 'ALLOWANCE_REVOCATION_LOCAL_EVIDENCE', mode: 'SIMULATION', focusScenarioId: 'ERC20-010', build, samples }));
  } finally { await lab.stop(); }
});

test('revocation distinguishes missing observations and inconsistent preflight/receipt from coherent rejection', { timeout: 60_000 }, async () => {
  const lab = await LocalLab.start();
  try {
    const { bytecodes } = await compileFixtures();
    const accounts = await lab.rpc.request<Address[]>('eth_accounts');
    const actors = { owner: getAddress(accounts[0]!), recipient: getAddress(accounts[1]!), spender: getAddress(accounts[2]!) };
    for (const fault of ['revoke-rpc', 'probe-transport', 'post-read-rpc', 'post-read-malformed', 'probe-true', 'probe-empty', 'probe-false', 'probe-malformed'] as const) {
      const deployment = await send(lab.rpc, { from: actors.owner, data: bytecodes.StandardToken!, gas: '0x7a1200' }); assert(deployment.contractAddress);
      const e = new FixtureExecutor(lab.rpc, deployment.contractAddress);
      const revokeData = e.data('approve', [actors.spender, 0n]), probeData = e.data('transferFrom', [actors.owner, actors.recipient, 1n]);
      const allowanceData = e.data('allowance', [actors.owner, actors.spender]);
      let injected = false, probeSubmitted = false;
      const server = createServer(async (request, response) => {
        let raw = ''; for await (const chunk of request) raw += String(chunk);
        const body = JSON.parse(raw) as { id: number; method: string; params: unknown[] };
        const tx = body.params[0] as { data?: string } | undefined;
        if (body.method === 'eth_sendTransaction' && tx?.data === probeData) probeSubmitted = true;
        if (body.method === 'evm_revert') probeSubmitted = false;
        const trigger = body.method === 'eth_call' && (fault === 'revoke-rpc' ? tx?.data === revokeData
          : fault.startsWith('post-') ? probeSubmitted && tx?.data === allowanceData : tx?.data === probeData);
        if (!injected && trigger) {
          injected = true;
          if (fault === 'probe-transport') { response.destroy(); return; }
          const returned = { 'probe-true': '0x' + '0'.repeat(63) + '1', 'probe-false': '0x' + '0'.repeat(64),
            'probe-empty': '0x', 'probe-malformed': '0xff', 'post-read-malformed': '0x01' };
          response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, ...(fault in returned
            ? { result: returned[fault as keyof typeof returned] } : { error: { code: -32000, message: 'Injected local observation failure' } }) })); return;
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
        const result = report.results.find(r => r.scenarioId === 'ERC20-010')!;
        const observedProbe = ['probe-true', 'probe-empty', 'probe-false', 'probe-malformed'].includes(fault);
        assert.equal(result.verdict, fault === 'probe-malformed' ? 'FAIL' : 'INCONCLUSIVE', fault);
        assert.equal(result.executionStatus, observedProbe ? 'COMPLETED' : 'ERROR'); assert.equal(result.support, 'UNKNOWN');
        const receipts = result.evidenceReferences.filter(id => report.evidence.find(e => e.id === id)?.kind === 'MINED_RECEIPT');
        assert.equal(receipts.length, fault === 'revoke-rpc' ? 1 : fault === 'probe-transport' ? 2 : 3);
        if (observedProbe) {
          const negative = result.observations.negative as Execution;
          assert.equal(negative.receipt.status, '0x0');
          assert.equal(result.observations.probeRejected, false); assert.equal(result.observations.probeStateUnchanged, true);
        } else assert.equal(Object.hasOwn(result.observations, 'probeRejected'), false);
        assert.equal(report.results.find(r => r.scenarioId === 'ERC20-004')!.verdict, 'PASS');
        assert.equal(await e.read('allowance', [actors.owner, actors.spender]), 0n);
        assert.equal(await e.read('balanceOf', [actors.owner]), 1_000_000_000_000n);
        assert.equal(await e.read('balanceOf', [actors.recipient]), 0n);
      } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    }
  } finally { await lab.stop(); }
});
