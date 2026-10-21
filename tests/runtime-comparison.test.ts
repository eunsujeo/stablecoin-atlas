import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareRuntime, compiledRuntime, compareVerificationRuntime } from '../tools/research/runtime-comparison.js';

const metadata = (digest = '11', experimental = false) => {
  const data = (experimental ? 'a3' : 'a2') + '646970667358221220' + digest.repeat(32) + '64736f6c634300060c'
    + (experimental ? '6c6578706572696d656e74616cf5' : '');
  return data + (data.length / 2).toString(16).padStart(4, '0');
};
const runtime = (body = '6001600055', suffix = metadata()) => '0x' + body + suffix;

test('runtime comparison distinguishes exact bytes from body mutations and hex casing', () => {
  assert.equal(compareRuntime(runtime(), runtime().toUpperCase().replace('0X', '0x')).exactRuntime, 'EXACT_MATCH');
  const changed = compareRuntime(runtime(), runtime('6002600055'));
  assert.equal(changed.exactRuntime, 'MISMATCH'); assert.equal(changed.metadataExcluded, 'MISMATCH');
});

test('metadata-only and different-length valid CBOR changes never become exact matches', () => {
  for (const suffix of [metadata('22'), metadata('11', true)]) {
    const r = compareRuntime(runtime(), runtime('6001600055', suffix));
    assert.equal(r.exactRuntime, 'MISMATCH'); assert.equal(r.metadataExcluded, 'MATCH');
    assert.equal(r.observedBodyBytes, 5); assert.equal(r.candidateBodyBytes, 5);
  }
});

test('truncated, out-of-range, duplicate-key and trailing-data CBOR is never stripped', () => {
  for (const suffix of ['ffff', 'a164736f6c634300060c0008', 'a264736f6c634300060c64736f6c634300060c0011', metadata().slice(0, -4) + '000034']) {
    assert.equal(compareRuntime(runtime(), runtime('6001600055', suffix)).metadataExcluded, 'UNKNOWN');
  }
  for (const hex of ['0x', '0x1', '0xzz', '0x__Library__']) assert.throws(() => compareRuntime(runtime(), hex));
});

test('compiler extraction requires exact target, no errors and fully resolved runtime', () => {
  const result = (deployed: any) => ({ contracts: { 'A.sol': { Token: { evm: { bytecode: { object: '6000' }, deployedBytecode: deployed } } } } });
  const valid = result({ object: runtime().slice(2), linkReferences: {}, immutableReferences: {} });
  assert.equal(compiledRuntime(valid, 'A.sol', 'Token'), runtime());
  const logicalPath = '/logical-build/contracts/A.sol';
  const namespaced = { contracts: { [logicalPath]: valid.contracts['A.sol'] } };
  assert.equal(compiledRuntime(namespaced, logicalPath, 'Token'), runtime());
  assert.throws(() => compiledRuntime(namespaced, 'contracts/A.sol', 'Token'));
  assert.throws(() => compiledRuntime(valid, 'B.sol', 'Token'));
  assert.throws(() => compiledRuntime({ ...valid, errors: [{ severity: 'error' }] }, 'A.sol', 'Token'));
  for (const deployed of [{ object: '__Library__' }, { object: '6000', linkReferences: { 'A.sol': { Library: [{ start: 1, length: 20 }] } } }, { object: '6000', immutableReferences: { '1': [{ start: 0, length: 1 }] } }]) {
    assert.throws(() => compiledRuntime(result(deployed), 'A.sol', 'Token'));
  }
  assert.throws(() => compiledRuntime(result(undefined), 'A.sol', 'Token'));
});

test('third-party match with metadata replacement cannot become untransformed exact reproduction', () => {
  const record = { chainId: '1', address: '0xABC', runtimeMatch: 'match', runtimeBytecode: {
    onchainBytecode: runtime(), recompiledBytecode: runtime('6001600055', metadata('22')),
    transformations: [{ type: 'replace', reason: 'cborAuxdata', offset: 5 }],
  } };
  const r = compareVerificationRuntime(record, { networkId: '1', address: '0xabc' }, runtime());
  assert.equal(r.serviceClaim, 'match'); assert.equal(r.serviceReportsMetadataReplacement, true);
  assert.equal(r.serviceOnchain.exactRuntime, 'EXACT_MATCH');
  assert.equal(r.serviceRecompiled.exactRuntime, 'MISMATCH'); assert.equal(r.serviceRecompiled.metadataExcluded, 'MATCH');
  assert.notEqual(record.runtimeBytecode.onchainBytecode, record.runtimeBytecode.recompiledBytecode);
});

test('verification comparison rejects wrong chain, address, missing runtime or altered observation bytes', () => {
  const record = { chainId: '1', address: '0xabc', runtimeBytecode: { onchainBytecode: runtime(), recompiledBytecode: runtime() } };
  const expected = { networkId: '1', address: '0xabc' };
  for (const bad of [{ ...record, chainId: '2' }, { ...record, address: '0xdef' }, { ...record, runtimeBytecode: undefined }]) {
    assert.throws(() => compareVerificationRuntime(bad, expected, runtime()));
  }
  assert.throws(() => compareVerificationRuntime(record, expected, runtime('6002600055')));
  assert.throws(() => compareVerificationRuntime(record, expected, runtime('6001600055', metadata('22'))));
});
