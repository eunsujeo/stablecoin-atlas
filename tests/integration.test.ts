import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAddress, type Address } from 'viem';
import { runLab } from '../src/lab/run.js';
import { LocalLab } from '../src/lab/anvil.js';
import { compileFixtures } from '../src/lab/compiler.js';
import { assessFixture, assessReadOnly } from '../src/assessment.js';
import { send } from '../src/evm/executor.js';
import { Rpc } from '../src/evm/rpc.js';
import type { AssessmentReport, Capability } from '../src/domain/model.js';
import { json } from '../src/domain/evaluator.js';
import { assertLabContract, assertSerializedReport } from './helpers/report-contract.js';
import { assertEvmBlockReferences } from './helpers/evm-block-reference.js';
const find = (report: AssessmentReport, id: string, capability?: Capability) => {
  const result = report.results.find(r => r.scenarioId === id && (!capability || r.capability === capability));
  assert(result, `Missing ${id} ${capability ?? ''}`); return result;
};
test('seven fixtures: deterministic baseline, exact-receipt policy and evidence integrity', { timeout: 120_000 }, async () => {
  const baseline = await runLab();
  const repeated = await runLab();
  const exact = await runLab('exact-receipt');
  for (const lab of [baseline, repeated, exact]) assertLabContract(JSON.parse(json(lab)));
  assert.equal(baseline.assessments.length, 7);
  for (let index = 0; index < baseline.assessments.length; index++) {
    const { fixture, report } = baseline.assessments[index]!;
    assertEvmBlockReferences(report);
    const again = repeated.assessments[index]!.report;
    assert.deepEqual(report.results.map(r => [r.scenarioId, r.capability, r.verdict, r.support]), again.results.map(r => [r.scenarioId, r.capability, r.verdict, r.support]));
    assert.deepEqual(report.assetIdentity.contractAddress, again.assetIdentity.contractAddress);
    for (const key of ['debit', 'received', 'initialAllowance', 'afterUpdate', 'finalAllowance', 'zeroResetRequired', 'receiptDifference', 'returnKind']) {
      assert.deepEqual(report.results.map(r => r.observations[key]), again.results.map(r => r.observations[key]));
    }
    assert.equal(report.assetIdentity.issuerVerificationStatus, 'UNKNOWN');
    assert.equal(report.assetIdentity.mintAddress.status, 'NOT_APPLICABLE');
    assert(report.results.every(r => r.executionStatus === 'COMPLETED'), `${fixture}: unexpected infrastructure error`);
    assert.equal(find(report, 'ERC20-001').verdict, 'PASS');
    assert.equal(find(report, 'ERC20-000').verdict, 'PASS');
    const evidence = new Map(report.evidence.map(e => [e.id, e]));
    assert.equal(evidence.size, report.evidence.length);
    for (const result of report.results) {
      assert(result.evidenceReferences.length > 0);
      for (const ref of result.evidenceReferences) { assert(evidence.has(ref)); assert(evidence.get(ref)!.observedAt); }
      assert.equal(result.assetIdentity.contractAddress.status, 'KNOWN');
      assert(result.observedBlockOrSlot !== 'UNKNOWN');
    }
    const falseToken = fixture === 'FalseReturnToken';
    for (const id of ['ERC20-002', 'ERC20-003', 'ERC20-004', 'ERC20-005', 'ERC20-008']) {
      assert.equal(find(report, id).verdict, falseToken ? 'FAIL' : 'PASS', `${fixture} ${id}`);
    }
    assert.equal(find(report, 'ERC20-006').verdict, falseToken ? 'INCONCLUSIVE' : 'PASS');
    assert.equal(find(report, 'ERC20-009').verdict, falseToken ? 'INCONCLUSIVE' : 'PASS');
    assert.equal(find(report, 'ERC20-010').verdict, falseToken ? 'INCONCLUSIVE' : 'PASS');
    assert.equal(find(report, 'ERC20-005').observations.returnKind, falseToken ? 'FALSE' : fixture === 'NoReturnToken' ? 'EMPTY' : 'TRUE');
    assert.equal(find(report, 'ERC20-003').observations.zeroResetRequired, falseToken ? 'UNKNOWN' : fixture === 'ZeroResetToken');
    assert.equal(find(report, 'ERC20-007', 'PAUSE').verdict, fixture === 'PausableToken' ? 'PASS' : 'INCONCLUSIVE');
    assert.equal(find(report, 'ERC20-007', 'BLACKLIST').verdict, fixture === 'BlacklistToken' ? 'PASS' : 'INCONCLUSIVE');
    const exactReport = exact.assessments[index]!.report;
    if (fixture === 'FeeToken') {
      const fee = find(report, 'ERC20-006');
      assert.equal(fee.observations.received, 9900n);
      assert.equal(fee.observations.receiptDifference, 100n);
      for (const id of ['ERC20-002', 'ERC20-004', 'ERC20-006']) assert.equal(find(exactReport, id).verdict, 'FAIL');
    } else {
      assert.deepEqual(exactReport.results.map(r => r.verdict), report.results.map(r => r.verdict));
    }
    assert(report.capabilitySummary.filter(r => ['MINT', 'BURN', 'SWEEP_COMPATIBILITY', 'FINALITY'].includes(r.capability))
      .every(r => r.verdicts.includes('NOT_TESTED')));
  }
});
test('invalid metadata, missing events, malformed returns, read-only and network validation', { timeout: 60_000 }, async () => {
  const { bytecodes } = await compileFixtures();
  const lab = await LocalLab.start();
  try {
    const accounts = await lab.rpc.request<Address[]>('eth_accounts');
    const actors = { owner: getAddress(accounts[0]!), recipient: getAddress(accounts[1]!), spender: getAddress(accounts[2]!) };
    for (const fixture of ['InvalidMetadata', 'MissingEventToken', 'MalformedReturnToken', 'StandardToken']) {
      const receipt = await send(lab.rpc, { from: actors.owner, data: bytecodes[fixture]!, gas: '0x7a1200' });
      assert(receipt.contractAddress);
      const report = await assessFixture(lab.rpc, receipt.contractAddress, actors);
      assertSerializedReport(report);
      assertEvmBlockReferences(report);
      if (fixture === 'InvalidMetadata') {
        const meta = find(report, 'ERC20-001');
        assert.equal(meta.verdict, 'FAIL');
        assert.equal((meta.observations.metadata as Record<string, { status: string }>).name!.status, 'READ_FAILED');
        assert.equal((meta.observations.metadata as Record<string, { status: string }>).decimals!.status, 'INVALID_RESPONSE');
        assert.equal(report.assetIdentity.decimals.status, 'UNKNOWN');
      } else if (fixture !== 'StandardToken') {
        assert.equal(find(report, 'ERC20-002').verdict, 'FAIL');
        if (fixture === 'MissingEventToken') assert.equal(find(report, 'ERC20-002').observations.eventValid, false);
        if (fixture === 'MalformedReturnToken') assert.equal(find(report, 'ERC20-005').observations.returnKind, 'MALFORMED');
      } else {
        // Read-only behavior is tested over a recording forwarding interface.
        const requests: string[] = [];
        let failMetadata = false;
        const { createServer } = await import('node:http');
        const server = createServer(async (req, res) => {
          let raw = ''; for await (const chunk of req) raw += String(chunk);
          const body = JSON.parse(raw) as { id: number; method: string; params: unknown[] };
          requests.push(body.method);
          if (failMetadata && body.method === 'eth_call') {
            res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'Upstream unavailable' } })); return;
          }
          try { const result = await lab.rpc.request(body.method, body.params); res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result })); }
          catch { res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'forwarded failure' } })); }
        });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        const addr = server.address(); assert(addr && typeof addr !== 'string');
        const rpcUrl = `http://127.0.0.1:${addr.port}`;
        try {
          const ro = await assessReadOnly({ rpcUrl, networkId: '31337', token: receipt.contractAddress, holder: actors.owner });
          assertSerializedReport(ro);
          assertEvmBlockReferences(ro);
          assert.equal(ro.mode, 'READ_ONLY');
          assert.equal(find(ro, 'ERC20-000').verdict, 'PASS');
          for (const id of ['ERC20-002', 'ERC20-003', 'ERC20-004', 'ERC20-005', 'ERC20-006', 'ERC20-007', 'ERC20-008', 'ERC20-009', 'ERC20-010']) assert.equal(find(ro, id).verdict, 'NOT_TESTED');
          assert(requests.every(m => ['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call'].includes(m)));
          await assert.rejects(assessReadOnly({ rpcUrl, networkId: '1', token: receipt.contractAddress }), /Network mismatch/);
          await assert.rejects(assessReadOnly({ rpcUrl, networkId: '31337', token: 'invalid' }));
          await assert.rejects(assessReadOnly({ rpcUrl, networkId: '31337', token: actors.recipient }), /no contract code/);
          failMetadata = true;
          const incomplete = await assessReadOnly({ rpcUrl, networkId: '31337', token: receipt.contractAddress });
          assertSerializedReport(incomplete);
          const incompleteMeta = find(incomplete, 'ERC20-001');
          assert.equal(incompleteMeta.verdict, 'INCONCLUSIVE');
          assert.equal((incompleteMeta.observations.metadata as Record<string, { errorKind: string }>).name!.errorKind, 'RPC_ERROR');
          const broken = new Rpc(rpcUrl);
          await assert.rejects(broken.request('nonexistent_method'));
        } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
      }
    }
  } finally { await lab.stop(); }
});
