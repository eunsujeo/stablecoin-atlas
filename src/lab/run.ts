import { getAddress, type Address } from 'viem';
import type { AssessmentReport, Profile } from '../domain/model.js';
import { assessFixture } from '../assessment.js';
import { send } from '../evm/executor.js';
import { LocalLab } from './anvil.js';
import { compileFixtures, fixtureNames } from './compiler.js';
export interface LabReport {
  schemaVersion: '1.0'; mode: 'SIMULATION'; profile: Profile;
  build: Awaited<ReturnType<typeof compileFixtures>>['build'];
  environment: { node: string; client: string; chainId: string; hardfork: string; amountBaseUnits: string };
  assessments: { fixture: string; report: AssessmentReport }[];
}
export async function runLab(profile: Profile = 'baseline'): Promise<LabReport> {
  const compiled = await compileFixtures();
  const lab = await LocalLab.start();
  try {
    const accounts = await lab.rpc.request<Address[]>('eth_accounts');
    if (accounts.length < 3) throw new Error('Need three isolated fixture accounts');
    const actors = { owner: getAddress(accounts[0]!), recipient: getAddress(accounts[1]!), spender: getAddress(accounts[2]!) };
    const client = await lab.rpc.request<string>('web3_clientVersion');
    const assessments: LabReport['assessments'] = [];
    for (const fixture of fixtureNames) {
      const bytecode = compiled.bytecodes[fixture];
      if (!bytecode) throw new Error(`Missing bytecode: ${fixture}`);
      const receipt = await send(lab.rpc, { from: actors.owner, data: bytecode, gas: '0x7a1200' });
      if (receipt.status !== '0x1' || !receipt.contractAddress) throw new Error(`Deployment failed: ${fixture}`);
      const report = await assessFixture(lab.rpc, receipt.contractAddress, actors, profile);
      // Deployment/build provenance supplements scenario execution evidence.
      report.evidence.push({ id: `e${report.evidence.length + 1}`, provenance: 'OBSERVED', kind: 'FIXTURE_DEPLOYMENT',
        observedAt: report.startedAt, observedBlockOrSlot: BigInt(receipt.blockNumber).toString(),
        data: { fixture, receipt, build: compiled.build, bytecode } });
      assessments.push({ fixture, report });
    }
    return { schemaVersion: '1.0', mode: 'SIMULATION', profile, build: compiled.build,
      environment: { node: process.version, client, chainId: '31337', hardfork: 'shanghai', amountBaseUnits: '10000' }, assessments };
  } finally { await lab.stop(); }
}
