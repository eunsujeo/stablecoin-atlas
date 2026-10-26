import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import solc from 'solc';
import { encodeFunctionData, decodeFunctionResult, decodeAbiParameters } from 'viem';
import { LocalLab } from '../lab/anvil.ts';
import { send } from '../evm/executor.ts';
import { sha256 } from './source.mjs';

export async function batchExperiments(source, contractName = 'BatchFixture') {
  const fixture = await readFile(new URL('../../tests/fixtures/ContractReview.sol', import.meta.url), 'utf8');
  const originalHash = sha256(source), originalFixture = contractName === 'BatchFixture';
  const sources = { 'Fixture.sol': { content: fixture } };
  let file = 'Fixture.sol';
  if (!originalFixture) {
    file = 'Subject.sol'; sources[file] = { content: source.replace(/pragma\s+solidity\s+[^;]+;/g, '') };
  } else assert.equal(source, fixture);
  const build = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } })));
  assert(!build.errors?.some(e => e.severity === 'error'), 'LOCAL_BUILD_FAILED');
  const lab = await LocalLab.start(), rpc = lab.rpc;
  const checks = [];
  try {
    const [owner, other] = await rpc.request('eth_accounts');
    const deploy = async (path, name) => {
      const receipt = await send(rpc, { from: owner, data: `0x${build.contracts[path][name].evm.bytecode.object}`, gas: '0x7a1200' });
      assert.equal(receipt.status, '0x1'); assert(receipt.contractAddress); return receipt.contractAddress;
    };
    const executor = await deploy(file, contractName), target = await deploy('Fixture.sol', 'ObserveFixture'), wallet = await deploy('Fixture.sol', 'WalletFixture'), context = await deploy('Fixture.sol', 'ContextFixture'), token = await deploy('Fixture.sol', 'TokenFixture');
    const subjectABI = build.contracts[file][contractName].abi, targetABI = build.contracts['Fixture.sol'].ObserveFixture.abi, tokenABI = build.contracts['Fixture.sol'].TokenFixture.abi, walletABI = build.contracts['Fixture.sol'].WalletFixture.abi, contextABI = build.contracts['Fixture.sol'].ContextFixture.abi;
    const data = (abi, functionName, args = []) => encodeFunctionData({ abi, functionName, args });
    const call = async (to, abi, name, args = []) => decodeFunctionResult({ abi, functionName: name, data: await rpc.request('eth_call', [{ to, data: data(abi, name, args) }, 'latest']) });
    const tx = (to, payload, value = 0n, from = owner) => send(rpc, { from, to, data: payload, value: `0x${value.toString(16)}`, gas: '0x7a1200' });
    const balance = async at => BigInt(await rpc.request('eth_getBalance', [at, 'latest']));
    const observe = data(targetABI, 'observe'), fail = data(targetABI, 'fail');
    const batch = calls => data(subjectABI, 'aggregate3', [calls]);
    const valueBatch = calls => data(subjectABI, 'aggregate3Value', [calls]);
    let receipt = await tx(executor, batch([{ target, allowFailure: false, callData: observe }]));
    assert.equal(receipt.status, '0x1'); assert.equal(receipt.logs.length, 1);
    assert.equal((await call(target, targetABI, 'lastSender')).toLowerCase(), executor.toLowerCase()); assert.equal(await call(target, targetABI, 'lastValue'), 0n);
    checks.push({ id: 'direct-call-context', status: 'PASS', evidence: 'Target sender equals executor, value=0, state counter increments and Observed event emitted.' });
    const before = await call(target, targetABI, 'counter');
    const simulation = decodeFunctionResult({ abi: subjectABI, functionName: 'aggregate3', data: await rpc.request('eth_call', [{ to: executor, data: batch([{ target, allowFailure: false, callData: observe }, { target, allowFailure: false, callData: data(targetABI, 'counter') }]) }, 'latest']) });
    assert.equal(simulation[0].success, true); assert.equal(decodeAbiParameters([{ type: 'uint256' }], simulation[1].returnData)[0], before + 1n); assert.equal(await call(target, targetABI, 'counter'), before);
    checks.push({ id: 'simulation-state', status: 'PASS', evidence: 'eth_call permits stateful inner CALL affecting the next result; persistent state is unchanged afterward.' });
    const failedBatch = batch([{ target, allowFailure: false, callData: observe }, { target, allowFailure: false, callData: fail }]);
    receipt = await tx(executor, failedBatch); assert.equal(receipt.status, '0x0'); assert.equal(receipt.logs.length, 0); assert.equal(await call(target, targetABI, 'counter'), before);
    checks.push({ id: 'atomic-revert', status: 'PASS', evidence: 'Required failed subcall reverts earlier state and all logs.' });
    const partial = batch([{ target, allowFailure: false, callData: observe }, { target, allowFailure: true, callData: fail }]);
    const partialResult = decodeFunctionResult({ abi: subjectABI, functionName: 'aggregate3', data: await rpc.request('eth_call', [{ to: executor, data: partial }, 'latest']) });
    assert.deepEqual(partialResult.map(r => r.success), [true, false]); receipt = await tx(executor, partial); assert.equal(receipt.status, '0x1'); assert.equal(receipt.logs.length, 1);
    checks.push({ id: 'partial-failure', status: 'PASS', evidence: 'Allowed failure returns false and preserves successful state/event.' });
    receipt = await tx(executor, batch([{ target, allowFailure: false, callData: observe }]), 7n); assert.equal(receipt.status, '0x1'); assert.equal(await balance(executor), 7n); assert.equal(await call(target, targetABI, 'lastValue'), 0n);
    checks.push({ id: 'aggregate3-residual', status: 'PASS', retainedWei: '7', evidence: 'Value sent to aggregate3 stays in executor; target receives zero.' });
    const values = [{ target, allowFailure: true, value: 5n, callData: fail }, { target, allowFailure: false, value: 2n, callData: observe }];
    receipt = await tx(executor, valueBatch(values), 7n); assert.equal(receipt.status, '0x1'); assert.equal(await balance(executor), 12n); assert.equal(await call(target, targetABI, 'lastValue'), 2n);
    checks.push({ id: 'failed-value-retained', status: 'PASS', retainedAdditionalWei: '5', evidence: 'Allowed failed value call retains five wei; successful value call delivers two wei.' });
    const oldCounter = await call(target, targetABI, 'counter'); receipt = await tx(executor, valueBatch(values), 8n); assert.equal(receipt.status, '0x0'); assert.equal(await balance(executor), 12n); assert.equal(await call(target, targetABI, 'counter'), oldCounter);
    checks.push({ id: 'value-mismatch-rollback', status: 'PASS', evidence: 'Mismatched supplied total reverts state, logs and value transfer.' });
    const delegatePayload = valueBatch([{ target, allowFailure: false, value: 11n, callData: observe }]);
    receipt = await tx(wallet, data(walletABI, 'execute', [executor, delegatePayload]), 11n); assert.equal(receipt.status, '0x1'); assert.equal((await call(target, targetABI, 'lastSender')).toLowerCase(), wallet.toLowerCase()); assert.equal(await call(target, targetABI, 'lastValue'), 11n); assert.equal(await call(wallet, walletABI, 'marker'), 777n); assert.equal(await balance(wallet), 0n);
    checks.push({ id: 'delegated-batch-context', status: 'PASS', evidence: 'Delegatecalled batch calls target from wallet with eleven wei; wallet marker remains unchanged and target event/state observed.' });
    receipt = await tx(wallet, data(walletABI, 'execute', [context, data(contextABI, 'setMarker', [99n])]), 3n);
    assert.equal(receipt.status, '0x1'); assert.equal(await call(wallet, walletABI, 'marker'), 99n); assert.equal(await call(context, contextABI, 'marker'), 0n); assert.equal(receipt.logs[0].address.toLowerCase(), wallet.toLowerCase());
    const fields = decodeAbiParameters([{ type: 'address' }, { type: 'uint256' }, { type: 'address' }], receipt.logs[0].data);
    assert.equal(fields[0].toLowerCase(), owner.toLowerCase()); assert.equal(fields[1], 3n); assert.equal(fields[2].toLowerCase(), wallet.toLowerCase());
    checks.push({ id: 'delegate-storage-control', status: 'PASS', evidence: 'Separate synthetic delegated code modifies wallet slot, preserves outer sender/value, and emits from wallet; code contract storage unchanged.' });
    receipt = await tx(token, data(tokenABI, 'approve', [executor, 60n])); assert.equal(receipt.status, '0x1');
    const unprivileged = batch([{ target: token, allowFailure: false, callData: data(tokenABI, 'transferFrom', [owner, other, 60n]) }]);
    receipt = await tx(executor, unprivileged, 0n, other); assert.equal(receipt.status, '0x1'); assert.equal(await call(token, tokenABI, 'balanceOf', [owner]), 40n); assert.equal(await call(token, tokenABI, 'balanceOf', [other]), 60n); assert.equal(await call(token, tokenABI, 'allowance', [owner, executor]), 0n); assert.equal(receipt.logs.length, 1); assert.equal(receipt.logs[0].address.toLowerCase(), token.toLowerCase());
    checks.push({ id: 'fixture-approval-misuse', status: 'PASS', tokenUnits: '60', evidence: 'A second disposable account can consume allowance granted to a permissionless fixture executor; balances, allowance and Transfer event checked.' });
    return { schemaVersion: 'ContractReviewExperiments1.0', status: 'PASS', compiler: solc.version(), sourceSHA256: originalHash, sourceMode: originalFixture ? 'SYNTHETIC_FIXTURE' : 'ACTUAL_CAPTURE_PRAGMA_RELAXED_LOCAL_BUILD',
      timestamp: new Date().toISOString(), environment: 'PROGRAM_OWNED_NEW_LOOPBACK_ANVIL', checks, limits: ['Not deployed runtime equivalence', 'No external transactions', 'No unchecked-total exploit execution', 'Not an exhaustive vulnerability test'] };
  } finally { await lab.stop(); }
}
