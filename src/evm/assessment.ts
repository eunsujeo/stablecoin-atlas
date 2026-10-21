import { randomUUID } from 'node:crypto';
import { getAddress, type Address } from 'viem';
import { enforceEvidence, summarize } from '../domain/evaluator.js';
import type { AssessmentReport, Capability, Profile, ScenarioOutcome, ScenarioResult } from '../domain/model.js';
import { resolveIdentity } from './identity.js';
import { FixtureExecutor } from './executor.js';
import { Rpc } from './rpc.js';
import { scenarios, type Actors } from './scenarios.js';

const limitations = [
  'PASS applies only to the stated scenario, sampled accounts, amount, and observed blocks; it is not asset approval.',
  'Issuer, origin, upgrade authority, arbitrary controls, finality and sweep are not verified; proxy inspection covers recognized structural signals only.',
  'Read-only calls and preflight return values do not prove mined transaction return data; receipts carry no function return values.',
];
export async function assessEvm(rpc: Rpc, networkId: string, token: string, profile: Profile, actors?: Actors, holder?: Address, spender?: Address): Promise<AssessmentReport> {
  if (spender !== undefined) {
    if (actors || !holder || !spender) throw new Error('Allowance read requires owner/spender without fixture actors.');
    holder = getAddress(holder); spender = getAddress(spender);
  }
  // Each assessment has a self-contained evidence namespace.
  rpc.evidence.length = 0;
  const startedAt = new Date().toISOString();
  const assessmentId = randomUUID();
  const resolved = await resolveIdentity(rpc, token, networkId);
  const identity = resolved.identity;
  const results: ScenarioResult[] = [];
  const add = (id: string, capability: Capability, started: string, from: number, candidate: ScenarioOutcome, error = false, evidenceEnd = rpc.evidence.length) => {
    const evidence = rpc.evidence.slice(from, evidenceEnd);
    const evaluated = enforceEvidence(candidate, evidence);
    results.push({ assessmentId, assetIdentity: identity, scenarioId: id, scenarioVersion: id === 'EVM-PROXY-001' ? '1.1.0' : '1.0.0', capability,
      executionStatus: evaluated.verdict === 'NOT_TESTED' ? 'NOT_EXECUTED' : error ? 'ERROR' : 'COMPLETED',
      ...evaluated, evidenceReferences: evidence.map(e => e.id), observedBlockOrSlot: rpc.block,
      startedAt: started, completedAt: new Date().toISOString(), limitations: evaluated.limitations ?? [] });
  };
  const fields = Object.values(resolved.metadata);
  add('ERC20-001', 'IDENTITY', startedAt, 0, {
    verdict: fields.some(f => f.status === 'INVALID_RESPONSE') ? 'FAIL' : fields.every(f => f.status === 'OK') ? 'PASS' : 'INCONCLUSIVE',
    support: 'UNKNOWN', observations: { metadata: resolved.metadata },
    limitations: ['Metadata does not authenticate issuer or establish full ERC-20 conformance. Optional field reverts are inconclusive.'],
  }, false, resolved.proxyEvidenceStart);
  add('EVM-PROXY-001', 'UPGRADEABILITY', resolved.proxyStartedAt, resolved.proxyEvidenceStart, {
    verdict: resolved.proxy.resolution === 'RESOLVED' ? 'PASS' : 'INCONCLUSIVE',
    support: 'UNKNOWN', observations: { proxy: resolved.proxy }, limitations: resolved.proxy.limitations,
  });
  const executor = new FixtureExecutor(rpc, resolved.token);
  if (actors) {
    for (const scenario of scenarios) {
      const snapshot = await rpc.request<string>('evm_snapshot');
      const from = rpc.evidence.length, started = new Date().toISOString();
      try { add(scenario.id, scenario.capability, started, from, await scenario.run(executor, actors, profile)); }
      catch {
        add(scenario.id, scenario.capability, started, from, { verdict: 'INCONCLUSIVE', support: 'UNKNOWN', observations: {},
          limitations: ['Execution or evidence decoding failed; inspect the recorded RPC evidence.'] }, true);
      } finally {
        if (await rpc.request<boolean>('evm_revert', [snapshot]) !== true) throw new Error('Failed to restore scenario snapshot');
        await rpc.pin();
      }
    }
  } else {
    if (holder && spender !== undefined) {
      const from = rpc.evidence.length, started = new Date().toISOString();
      const pair = { owner: holder, spender };
      let raw: unknown, failed = false;
      try {
        const block = await rpc.pin();
        raw = await rpc.request('eth_call', [{ to: resolved.token, data: executor.data('allowance', [holder, spender]) }, block]);
      } catch { failed = true; }
      const valid = !failed && typeof raw === 'string' && /^0x[0-9a-fA-F]{64}$/.test(raw);
      add('ERC20-011', 'ALLOWANCE', started, from, { verdict: valid ? 'PASS' : 'INCONCLUSIVE', support: 'UNKNOWN',
        observations: { ...pair, readStatus: failed ? 'READ_FAILED' : valid ? 'OK' : 'INVALID_RESPONSE', ...(valid ? { allowance: BigInt(raw as string) } : {}) },
        limitations: ['Allowance getter response for this pair/block only; approve, transferFrom, revocation, authority and transfer permission are not tested. Same-account pairs are context only.'],
      }, failed);
    } else if (holder) {
      const from = rpc.evidence.length, started = new Date().toISOString();
      try {
        const balance = await executor.read<bigint>('balanceOf', [holder]);
        add('ERC20-000', 'BALANCE', started, from, { verdict: 'PASS', support: 'SUPPORTED', observations: { holder, balance } });
      } catch {
        add('ERC20-000', 'BALANCE', started, from, { verdict: 'INCONCLUSIVE', support: 'UNKNOWN', observations: {}, limitations: ['Balance lookup failed.'] }, true);
      }
    }
    for (const scenario of scenarios) {
      if (holder && spender === undefined && scenario.id === 'ERC20-000') continue;
      add(scenario.id, scenario.capability, startedAt, rpc.evidence.length, { verdict: 'NOT_TESTED', support: 'UNKNOWN', observations: {},
        limitations: ['Read-only mode: state-changing scenarios require the isolated local fixture lab.'] });
    }
  }
  const report: AssessmentReport = {
    schemaVersion: '1.0', assessmentId, mode: actors ? 'SIMULATION' : 'READ_ONLY', profile, assetIdentity: identity,
    results, evidence: [...rpc.evidence], capabilitySummary: [], startedAt, completedAt: new Date().toISOString(), limitations,
  };
  report.capabilitySummary = summarize(report);
  return report;
}
