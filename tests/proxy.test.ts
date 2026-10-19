import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { encodeAbiParameters, getAddress, keccak256, toHex, type Address, type Hex } from 'viem';
import { canonicalCloneTarget, decodeAddressWord, proxySlots, type ProxyObservation } from '../src/evm/proxy.js';
import { LocalLab } from '../src/lab/anvil.js';
import { compileFixtures } from '../src/lab/compiler.js';
import { send } from '../src/evm/executor.js';
import { Rpc } from '../src/evm/rpc.js';
import { resolveIdentity } from '../src/evm/identity.js';
import { assessReadOnly } from '../src/assessment.js';
import { json } from '../src/domain/evaluator.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { assertSerializedReport } from './helpers/report-contract.js';
import { assertEvmBlockReferences } from './helpers/evm-block-reference.js';
const zero = '0x0000000000000000000000000000000000000000' as Address;
const cloneRuntime = (target: Address) => `0x363d3d373d3d3d363d73${target.slice(2)}5af43d82803e903d91602b57fd5bf3` as Hex;

test('proxy words are full padded address words and clones require the exact canonical runtime', () => {
  assert.equal(proxySlots.legacyImplementation, keccak256(toHex('org.zeppelinos.proxy.implementation')));
  assert.equal(proxySlots.legacyAdmin, keccak256(toHex('org.zeppelinos.proxy.admin')));
  assert.deepEqual(decodeAddressWord('0x' + '0'.repeat(64)), { status: 'ZERO' });
  assert.deepEqual(decodeAddressWord('0x' + '0'.repeat(63) + '1'), { status: 'VALUE', address: '0x0000000000000000000000000000000000000001' });
  for (const input of ['0x1', '0x', null, '0x' + 'f'.repeat(64), '0x' + '0'.repeat(64) + '00']) assert.equal(decodeAddressWord(input).status, 'INVALID_RESPONSE');
  const address = '0x0000000000000000000000000000000000000001';
  assert.equal(canonicalCloneTarget(cloneRuntime(address)), address);
  assert.equal(canonicalCloneTarget(cloneRuntime(address) + '00'), undefined);
  assert.equal(canonicalCloneTarget('0x' + cloneRuntime(address).slice(4)), undefined);
});

test('read-only proxy resolution on new local implementation, beacon, clone and negative fixtures', { timeout: 60_000 }, async () => {
  const lab = await LocalLab.start();
  try {
    const { bytecodes, build } = await compileFixtures();
    const [owner, other] = await lab.rpc.request<Address[]>('eth_accounts'); assert(owner && other);
    async function deploy(name: string, addresses: Address[] = []): Promise<Address> {
      const data = (bytecodes[name]! + (addresses.length ? encodeAbiParameters(addresses.map(() => ({ type: 'address' as const })), addresses).slice(2) : '')) as Hex;
      const receipt = await send(lab.rpc, { from: owner!, data, gas: '0x7a1200' });
      assert.equal(receipt.status, '0x1'); assert(receipt.contractAddress); return getAddress(receipt.contractAddress);
    }
    const implementation = await deploy('StandardToken');
    const beacon = await deploy('BeaconFixture', [implementation, zero]);
    const direct = await deploy('ProxySlotFixture', [implementation, zero, owner]);
    const beaconProxy = await deploy('ProxySlotFixture', [zero, beacon, owner]);
    const divergentBeacon = await deploy('BeaconFixture', [implementation, other]);
    const divergentProxy = await deploy('ProxySlotFixture', [zero, divergentBeacon, owner]);
    const emptyTarget = await deploy('ProxySlotFixture', [other, zero, owner]);
    const conflict = await deploy('ProxySlotFixture', [implementation, beacon, owner]);
    const spoof = await deploy('SlotSpoofFixture', [implementation]);
    const emptyBeacon = await deploy('ProxySlotFixture', [zero, other, owner]);
    const revertingBeacon = await deploy('ProxySlotFixture', [zero, spoof, owner]);
    const selfTarget = await deploy('SelfTargetFixture');
    const legacy = await deploy('LegacyProxyFixture', [implementation, owner, zero, zero]);
    const legacyEmpty = await deploy('LegacyProxyFixture', [other, owner, zero, zero]);
    const legacyModernConflict = await deploy('LegacyProxyFixture', [implementation, owner, implementation, zero]);
    const legacyBeaconConflict = await deploy('LegacyProxyFixture', [implementation, owner, zero, beacon]);
    const legacySelf = await deploy('LegacySelfTargetFixture');
    const legacySpoof = await deploy('LegacySlotSpoofFixture', [implementation]);
    const clone = await send(lab.rpc, { from: owner, data: `0x3d602d80600a3d3981f3${cloneRuntime(implementation).slice(2)}`, gas: '0x7a1200' });
    assert(clone.contractAddress);
    const samples: { label: string; proxy: ProxyObservation }[] = [];
    for (const [label, token, pattern, resolved] of [
      ['direct', direct, 'EIP1967_IMPLEMENTATION_SLOT', true],
      ['beacon', beaconProxy, 'EIP1967_BEACON_SLOT', true],
      ['canonical-clone', clone.contractAddress, 'ERC1167_CANONICAL', true],
      ['plain-token', implementation, 'UNKNOWN', false],
      ['target-without-code', emptyTarget, 'EIP1967_IMPLEMENTATION_SLOT', false],
      ['conflicting-slots', conflict, 'EIP1967_IMPLEMENTATION_SLOT', false],
      ['caller-dependent-beacon', divergentProxy, 'EIP1967_BEACON_SLOT', false],
      ['beacon-without-code', emptyBeacon, 'EIP1967_BEACON_SLOT', false],
      ['reverting-beacon', revertingBeacon, 'EIP1967_BEACON_SLOT', false],
      ['self-target', selfTarget, 'EIP1967_IMPLEMENTATION_SLOT', false],
      ['legacy', legacy, 'ZEPPELINOS_IMPLEMENTATION_SLOT', true],
      ['legacy-slot-spoof', legacySpoof, 'ZEPPELINOS_IMPLEMENTATION_SLOT', true],
      ['legacy-empty-target', legacyEmpty, 'ZEPPELINOS_IMPLEMENTATION_SLOT', false],
      ['legacy-modern-conflict', legacyModernConflict, 'EIP1967_IMPLEMENTATION_SLOT', false],
      ['legacy-beacon-conflict', legacyBeaconConflict, 'ZEPPELINOS_IMPLEMENTATION_SLOT', false],
      ['legacy-self-target', legacySelf, 'ZEPPELINOS_IMPLEMENTATION_SLOT', false],
    ] as const) {
      const start = lab.rpc.evidence.length;
      const { identity, proxy, block } = await resolveIdentity(lab.rpc, token, '31337');
      assert.equal(proxy.pattern, pattern, label);
      assert.equal(proxy.resolution, resolved ? 'RESOLVED' : 'UNRESOLVED', label);
      assert.deepEqual(identity.implementationAddress, resolved ? { status: 'KNOWN', value: implementation } : proxy.implementationAddress);
      assert.equal(proxy.implementationAddress.status, resolved ? 'KNOWN' : 'UNKNOWN');
      if (label === 'direct' || label === 'beacon' || label === 'legacy') assert.deepEqual(proxy.adminAddress, { status: 'KNOWN', value: getAddress(owner) });
      // All target/slot/beacon reads refer to the same identity observation block.
      const probes = lab.rpc.evidence.slice(start).filter(e => e.kind === 'RPC').map(e => e.data as { method: string; params: unknown[] });
      for (const p of probes) if (['eth_call', 'eth_getCode', 'eth_getStorageAt'].includes(p.method)) assert.equal(p.params.at(-1), block);
      samples.push({ label, proxy });
    }
    // Actual delegation differs from a slot-only spoof even when pointer resolution matches.
    const behaviorCall = { data: keccak256(toHex('behavior()')).slice(0, 10), to: legacy };
    assert.equal(await lab.rpc.request('eth_call', [behaviorCall, 'latest']), toHex(0n, { size: 32 }));
    await assert.rejects(lab.rpc.request('eth_call', [{ ...behaviorCall, to: legacySpoof }, 'latest']));
    // Observe storage/access failures through real HTTP without mutating any chain storage.
    let failSlot: string | undefined;
    let malformedSlot: string | undefined;
    let failCodeTarget: Address | undefined;
    const methods: string[] = [];
    const server = createServer(async (req, res) => {
      let raw = ''; for await (const chunk of req) raw += String(chunk);
      const body = JSON.parse(raw) as { id: number; method: string; params: unknown[] };
      methods.push(body.method);
      if (body.method === 'eth_getCode' && body.params[0] === failCodeTarget) {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'Code unavailable' } })); return;
      }
      if (body.method === 'eth_getStorageAt' && body.params[1] === failSlot) {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'Storage unavailable' } })); return;
      }
      if (body.method === 'eth_getStorageAt' && body.params[1] === malformedSlot) {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x1' })); return;
      }
      try { res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: await lab.rpc.request(body.method, body.params) })); }
      catch { res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: 'Forwarded RPC failure' } })); }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert(address && typeof address !== 'string');
    const rpcUrl = `http://127.0.0.1:${address.port}`;
    try {
      const reports = [];
      for (const token of [direct, spoof, beaconProxy, clone.contractAddress, legacy, legacySpoof]) {
        const report = await assessReadOnly({ rpcUrl, networkId: '31337', token });
        assertSerializedReport(report);
        assertEvmBlockReferences(report);
        const result = report.results.find(r => r.scenarioId === 'EVM-PROXY-001'); assert(result);
        assert.equal(result.verdict, 'PASS'); // Declared target resolution only, even for spoof.
        assert.equal(result.scenarioVersion, '1.1.0');
        assert.equal(result.support, 'UNKNOWN'); // No upgrade/dispatch proof is manufactured.
        assert(result.limitations.some(s => s.includes('does not prove actual delegation')));
        for (const id of result.evidenceReferences) assert(report.evidence.some(e => e.id === id));
        const metadataResult = report.results.find(r => r.scenarioId === 'ERC20-001'); assert(metadataResult);
        assert(!metadataResult.evidenceReferences.some(id => report.evidence.find(e => e.id === id)?.kind === 'PROXY_OBSERVATION'));
        reports.push(report);
      }
      failSlot = proxySlots.implementation;
      const failed = await resolveIdentity(new Rpc(rpcUrl), beaconProxy, '31337');
      assert.equal(failed.proxy.resolution, 'UNRESOLVED'); // Cannot assume unreadable impl slot is empty.
      assert.equal(failed.proxy.probes.implementationSlot!.status, 'READ_FAILED');
      failSlot = undefined; malformedSlot = proxySlots.implementation;
      const malformed = await resolveIdentity(new Rpc(rpcUrl), direct, '31337');
      assert.equal(malformed.proxy.resolution, 'UNRESOLVED');
      assert.equal(malformed.proxy.probes.implementationSlot!.status, 'INVALID_RESPONSE');
      malformedSlot = undefined; failSlot = proxySlots.beacon;
      assert.equal((await resolveIdentity(new Rpc(rpcUrl), direct, '31337')).proxy.resolution, 'UNRESOLVED');
      failSlot = proxySlots.admin;
      const adminUnknown = await resolveIdentity(new Rpc(rpcUrl), direct, '31337');
      assert.equal(adminUnknown.proxy.resolution, 'RESOLVED');
      assert.equal(adminUnknown.proxy.adminAddress.status, 'UNKNOWN');
      failSlot = undefined;
      for (const slot of [proxySlots.implementation, proxySlots.beacon, proxySlots.legacyImplementation]) {
        for (const failure of ['unavailable', 'malformed'] as const) {
          failSlot = failure === 'unavailable' ? slot : undefined;
          malformedSlot = failure === 'malformed' ? slot : undefined;
          const incomplete = await assessReadOnly({ rpcUrl, networkId: '31337', token: legacy });
          assert.equal(incomplete.assetIdentity.implementationAddress.status, 'UNKNOWN');
          assert.equal(incomplete.results.find(r => r.scenarioId === 'EVM-PROXY-001')!.verdict, 'INCONCLUSIVE');
        }
      }
      malformedSlot = undefined; failSlot = proxySlots.legacyImplementation;
      for (const token of [direct, beaconProxy]) {
        assert.equal((await resolveIdentity(new Rpc(rpcUrl), token, '31337')).proxy.resolution, 'UNRESOLVED');
      }
      failSlot = proxySlots.legacyAdmin;
      const legacyAdminUnknown = await resolveIdentity(new Rpc(rpcUrl), legacy, '31337');
      assert.equal(legacyAdminUnknown.proxy.resolution, 'RESOLVED');
      assert.equal(legacyAdminUnknown.proxy.adminAddress.status, 'UNKNOWN');
      failSlot = undefined; malformedSlot = proxySlots.legacyAdmin;
      assert.equal((await resolveIdentity(new Rpc(rpcUrl), legacy, '31337')).proxy.adminAddress.status, 'UNKNOWN');
      malformedSlot = undefined; failCodeTarget = implementation;
      assert.equal((await resolveIdentity(new Rpc(rpcUrl), legacy, '31337')).proxy.resolution, 'UNRESOLVED');
      assert(methods.every(m => ['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_getCode', 'eth_getStorageAt', 'eth_call'].includes(m)));
      await mkdir('reports', { recursive: true });
      await writeFile('reports/proxy-local.json', json({ schemaVersion: '1.0', mode: 'READ_ONLY', environment: 'Local fixtures only', build, samples, reports }), { mode: 0o600 });
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  } finally { await lab.stop(); }
});
