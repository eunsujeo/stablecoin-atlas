import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import solc from 'solc';
import { encodeAbiParameters, encodeFunctionData, getAddress, keccak256, toHex, type Address, type Hex } from 'viem';
import { LocalLab } from '../src/lab/anvil.js';
import { FixtureExecutor, send } from '../src/evm/executor.js';
import { RpcError } from '../src/evm/rpc.js';
import { abi } from '../src/evm/abi.js';
import type { MetadataField } from '../src/evm/identity.js';
import { assessReadOnly } from '../src/assessment.js';
import { json } from '../src/domain/evaluator.js';
import { writeReportAtomically } from '../src/report-output.js';
import { assertReportContract, assertSerializedReport } from './helpers/report-contract.js';
import { assertEvmBlockReferences } from './helpers/evm-block-reference.js';

async function compileMetadataFixtures() {
  const source = await readFile(new URL('./fixtures/MetadataBoundaries.sol', import.meta.url), 'utf8');
  const settings = { optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai', outputSelection: { '*': { '*': ['evm.bytecode.object'] } } };
  const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'MetadataBoundaries.sol': { content: source } }, settings }))) as {
    errors?: { severity: string; formattedMessage: string }[];
    contracts: Record<string, Record<string, { evm: { bytecode: { object: string } } }>>;
  };
  const errors = output.errors?.filter(error => error.severity === 'error');
  assert(!errors?.length, errors?.map(error => error.formattedMessage).join('\n'));
  return { bytecodes: Object.fromEntries(Object.entries(output.contracts['MetadataBoundaries.sol']!).map(([name, contract]) =>
    [name, `0x${contract.evm.bytecode.object}` as Hex])),
  build: { compiler: String(solc.version()), sourceFile: 'tests/fixtures/MetadataBoundaries.sol', sourceHash: keccak256(toHex(source)), settings } };
}

test('metadata boundaries: uint8 validation, exact uint256, optional reads and invalid ABI on private fixtures', { timeout: 60_000 }, async () => {
  const lab = await LocalLab.start();
  try {
    const { bytecodes, build } = await compileMetadataFixtures();
    const [owner] = await lab.rpc.request<Address[]>('eth_accounts'); assert(owner);
    const holder = getAddress(owner);
    const max = 2n ** 256n - 1n;
    const samples = [];
    const allowed = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call']);
    const methods: string[] = [], prohibited: string[] = [];
    const decimalsData = encodeFunctionData({ abi, functionName: 'decimals' });
    let decimalsFault: 'none' | 'rpc' | 'transport' = 'none';
    const gateway = createServer(async (request, response) => {
      let raw = ''; for await (const chunk of request) raw += String(chunk);
      const body = JSON.parse(raw) as { id: number; method: string; params: unknown[] };
      methods.push(body.method);
      if (!allowed.has(body.method)) {
        prohibited.push(body.method);
        response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Read-only gateway' } })); return;
      }
      if (decimalsFault !== 'none' && body.method === 'eth_call' && (body.params[0] as { data?: string })?.data === decimalsData) {
        if (decimalsFault === 'transport') { response.destroy(); return; }
        response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'Injected metadata observation failure' } })); return;
      }
      try { response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: await lab.rpc.request(body.method, body.params) })); }
      catch (error) { response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: {
        code: error instanceof RpcError ? error.code : -32000,
        message: error instanceof RpcError && error.reverted ? 'execution reverted' : 'Local forwarding failure',
      } })); }
    });
    await new Promise<void>(resolve => gateway.listen(0, '127.0.0.1', resolve));
    const address = gateway.address(); assert(address && typeof address !== 'string');
    try {
      for (const sample of [
        { label: 'zero-empty', contract: 'MetadataBoundaryFixture', decimals: 0n, supply: 0n, name: '', symbol: '', verdict: 'PASS' },
        { label: 'uint8-max-uint256-max', contract: 'MetadataBoundaryFixture', decimals: 255n, supply: max, name: '경계 🧪', symbol: '경계', verdict: 'PASS' },
        { label: 'large-exact-supply', contract: 'MetadataBoundaryFixture', decimals: 18n, supply: 9_007_199_254_740_993_123_456n, name: 'Large units', symbol: 'BIG', verdict: 'PASS' },
        { label: 'uint8-overflow-256', contract: 'MetadataBoundaryFixture', decimals: 256n, supply: 42n, name: 'Invalid decimals', symbol: 'BAD', verdict: 'FAIL' },
        { label: 'uint8-overflow-65535', contract: 'MetadataBoundaryFixture', decimals: 65_535n, supply: 42n, name: 'Invalid decimals', symbol: 'BAD', verdict: 'FAIL' },
        { label: 'uint8-overflow-uint256-max', contract: 'MetadataBoundaryFixture', decimals: max, supply: 42n, name: 'Invalid decimals', symbol: 'BAD', verdict: 'FAIL' },
        { label: 'optional-methods-missing', contract: 'RequiredMetadataOnlyFixture', verdict: 'INCONCLUSIVE' },
        { label: 'decimals-revert', contract: 'RevertingDecimalsFixture', verdict: 'INCONCLUSIVE' },
        { label: 'short-numeric-abi', contract: 'MalformedNumericMetadataFixture', verdict: 'FAIL' },
        { label: 'bytes32-label-abi', contract: 'Bytes32MetadataFixture', verdict: 'FAIL' },
      ] as const) {
        const constructorData = sample.contract === 'MetadataBoundaryFixture' ? encodeAbiParameters(
          [{ type: 'uint256' }, { type: 'uint256' }, { type: 'string' }, { type: 'string' }],
          [sample.decimals, sample.supply, sample.name, sample.symbol]).slice(2) : '';
        const data = (bytecodes[sample.contract]! + constructorData) as Hex;
        const deployment = await send(lab.rpc, { from: holder, data, gas: '0x7a1200' });
        assert.equal(deployment.status, '0x1'); assert(deployment.contractAddress);
        const executor = new FixtureExecutor(lab.rpc, deployment.contractAddress);
        const balanceBefore = await executor.read('balanceOf', [holder]);
        const blockBefore = await lab.rpc.request('eth_blockNumber');
        const report = await assessReadOnly({ rpcUrl: `http://127.0.0.1:${address.port}`, networkId: '31337', token: deployment.contractAddress, holder });
        const result = report.results.find(r => r.scenarioId === 'ERC20-001')!;
        const metadata = result.observations.metadata as Record<string, MetadataField>;
        assert.equal(result.verdict, sample.verdict, sample.label);
        assert.equal(result.executionStatus, 'COMPLETED'); assert.equal(result.support, 'UNKNOWN');
        if (sample.contract === 'MetadataBoundaryFixture') {
          if (sample.decimals <= 255n) {
            assert.deepEqual(report.assetIdentity.decimals, { status: 'KNOWN', value: Number(sample.decimals) });
            assert.deepEqual(metadata.decimals, { status: 'OK', value: Number(sample.decimals) });
          } else {
            assert.equal(metadata.decimals!.status, 'INVALID_RESPONSE', sample.label);
            assert.equal(Object.hasOwn(metadata.decimals!, 'value'), false);
            assert.deepEqual(report.assetIdentity.decimals, { status: 'UNKNOWN', reason: 'INVALID_RESPONSE' });
          }
          assert.deepEqual(report.assetIdentity.name, { status: 'KNOWN', value: sample.name });
          assert.deepEqual(report.assetIdentity.symbol, { status: 'KNOWN', value: sample.symbol });
          assert.deepEqual(metadata.totalSupply, { status: 'OK', value: sample.supply });
          assert.equal(balanceBefore, sample.supply);
          assert(report.evidence.some(e => {
            if (e.kind !== 'RPC') return false;
            const observed = e.data as { method: string; params: { data?: string }[]; result?: string };
            return observed.method === 'eth_call' && observed.params[0]?.data === decimalsData
              && observed.result === '0x' + sample.decimals.toString(16).padStart(64, '0');
          }), 'Raw out-of-range word must remain available as evidence');
        } else if (sample.contract === 'RequiredMetadataOnlyFixture') {
          for (const key of ['name', 'symbol']) {
            assert.deepEqual(metadata[key], { status: 'READ_FAILED', errorKind: 'REVERT' });
            assert.equal(report.assetIdentity[key as 'name' | 'symbol'].status, 'UNKNOWN');
          }
          assert.deepEqual(report.assetIdentity.decimals, { status: 'KNOWN', value: 18 });
        } else if (sample.contract === 'RevertingDecimalsFixture') {
          assert.deepEqual(metadata.decimals, { status: 'READ_FAILED', errorKind: 'REVERT' });
          assert.equal(report.assetIdentity.decimals.status, 'UNKNOWN');
          assert.deepEqual(metadata.totalSupply, { status: 'OK', value: 42n });
        } else if (sample.contract === 'MalformedNumericMetadataFixture') {
          for (const key of ['decimals', 'totalSupply']) assert.deepEqual(metadata[key], { status: 'INVALID_RESPONSE' });
          assert.equal(report.assetIdentity.decimals.status, 'UNKNOWN');
        } else {
          for (const key of ['name', 'symbol']) assert.deepEqual(metadata[key], { status: 'INVALID_RESPONSE' });
          assert.deepEqual(report.assetIdentity.decimals, { status: 'KNOWN', value: 6 });
        }
        assertSerializedReport(report); assertEvmBlockReferences(report);
        assert.equal(report.mode, 'READ_ONLY');
        assert.equal(report.assetIdentity.issuerVerificationStatus, 'UNKNOWN');
        assert.equal(report.assetIdentity.assetStandard.status, 'UNKNOWN');
        const balance = report.results.find(r => r.scenarioId === 'ERC20-000')!;
        assert.equal(balance.verdict, 'PASS'); assert.equal(balance.observations.balance, balanceBefore);
        const wire = JSON.parse(json(report));
        const wireMetadata = wire.results.find((r: { scenarioId: string }) => r.scenarioId === 'ERC20-001').observations.metadata;
        if (metadata.totalSupply!.status === 'OK') assert.equal(wireMetadata.totalSupply.value, String(metadata.totalSupply!.value));
        assert.equal(wire.results.find((r: { scenarioId: string }) => r.scenarioId === 'ERC20-000').observations.balance, balanceBefore.toString());
        for (const unexecuted of report.results.filter(r => !['ERC20-000', 'ERC20-001', 'EVM-PROXY-001'].includes(r.scenarioId))) {
          assert.equal(unexecuted.verdict, 'NOT_TESTED'); assert.equal(unexecuted.executionStatus, 'NOT_EXECUTED'); assert.equal(unexecuted.support, 'UNKNOWN');
        }
        assert(report.evidence.some(e => e.kind === 'METADATA_DECODE' && e.data === metadata && result.evidenceReferences.includes(e.id)));
        assert.equal(await lab.rpc.request('eth_blockNumber'), blockBefore);
        assert.equal(await executor.read('balanceOf', [holder]), balanceBefore);
        samples.push({ label: sample.label, fixture: sample.contract, deployment, bytecode: bytecodes[sample.contract], report });
      }
      const healthy = samples.find(sample => sample.label === 'large-exact-supply')!;
      const token = healthy.deployment.contractAddress!;
      const executor = new FixtureExecutor(lab.rpc, token);
      const balanceBefore = await executor.read('balanceOf', [holder]);
      const blockBefore = await lab.rpc.request('eth_blockNumber');
      for (const fault of ['rpc', 'transport'] as const) {
        decimalsFault = fault;
        const report = await assessReadOnly({ rpcUrl: `http://127.0.0.1:${address.port}`, networkId: '31337', token, holder });
        assertSerializedReport(report); assertEvmBlockReferences(report);
        const result = report.results.find(r => r.scenarioId === 'ERC20-001')!;
        const metadata = result.observations.metadata as Record<string, MetadataField>;
        assert.equal(result.verdict, 'INCONCLUSIVE'); assert.equal(result.support, 'UNKNOWN');
        assert.equal(result.executionStatus, 'COMPLETED');
        assert.deepEqual(metadata.decimals, { status: 'READ_FAILED', errorKind: fault === 'rpc' ? 'RPC_ERROR' : 'TRANSPORT_ERROR' });
        assert.deepEqual(report.assetIdentity.decimals, { status: 'UNKNOWN', reason: 'READ_FAILED' });
        assert.deepEqual(metadata.totalSupply, { status: 'OK', value: 9_007_199_254_740_993_123_456n });
        const evidence = report.evidence.filter(e => result.evidenceReferences.includes(e.id));
        assert(evidence.some(e => fault === 'transport' ? e.kind === 'RPC_ERROR' : e.kind === 'RPC' && (e.data as { error?: unknown }).error));
        assert.equal(await lab.rpc.request('eth_blockNumber'), blockBefore);
        assert.equal(await executor.read('balanceOf', [holder]), balanceBefore);
        samples.push({ label: `decimals-${fault}-failure`, fixture: healthy.fixture, deployment: healthy.deployment,
          bytecode: healthy.bytecode, report });
      }
      decimalsFault = 'none';
      const recovered = await assessReadOnly({ rpcUrl: `http://127.0.0.1:${address.port}`, networkId: '31337', token, holder });
      assertSerializedReport(recovered);
      assert.equal(recovered.results.find(r => r.scenarioId === 'ERC20-001')!.verdict, 'PASS');
      assert.deepEqual(recovered.assetIdentity.decimals, { status: 'KNOWN', value: 18 });
      const overflow = samples.find(sample => sample.label === 'uint8-overflow-256')!;
      const cli = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(process.execPath, ['--use-env-proxy', '--import', 'tsx', 'src/cli.ts',
          'assess', '--network', '31337', '--token', overflow.deployment.contractAddress!],
        { cwd: new URL('..', import.meta.url), env: { ...process.env, RPC_URL: `http://127.0.0.1:${address.port}` }, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        child.stdout.on('data', chunk => { stdout += String(chunk); });
        child.stderr.on('data', chunk => { stderr += String(chunk); });
        child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
      });
      assert.equal(cli.code, 2); assert(cli.stderr.includes('"FAIL":1'));
      const cliReport = JSON.parse(cli.stdout); assertReportContract(cliReport);
      assert.deepEqual(cliReport.assetIdentity.decimals, { status: 'UNKNOWN', reason: 'INVALID_RESPONSE' });
      const cliMetadata = cliReport.results.find(r => r.scenarioId === 'ERC20-001')!.observations.metadata as Record<string, MetadataField>;
      assert.deepEqual(cliMetadata.decimals, { status: 'INVALID_RESPONSE' });
      assert(methods.length > 0); assert.deepEqual(prohibited, []);
      await writeReportAtomically('reports/metadata-boundaries-local.json', json({ schemaVersion: '1.0',
        kind: 'METADATA_BOUNDARIES_LOCAL_EVIDENCE', mode: 'READ_ONLY', focusScenarioId: 'ERC20-001', build, samples }));
    } finally { await new Promise<void>((resolve, reject) => gateway.close(error => error ? reject(error) : resolve())); }
  } finally { await lab.stop(); }
});
