import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { runPrivateTvmSmoke, tvmImage, type TvmIO } from '../src/tron/lab/runtime.js';
const genesis = '0'.repeat(64), nid = 'a'.repeat(64), cid = 'b'.repeat(64), imageId = 'sha256:' + 'c'.repeat(64);
function fixture(fault = '') {
  let accounts = '0', bootstrap = '', env: string[] = [];
  const modes: number[] = [];
  let time = 0, name = '', network = '', owner = '', container = false, net = false, running = false, head = 0, stopped = false;
  const commands: string[][] = [], reads: string[] = [];
  const controller = new AbortController();
  const value = () => ({ Id: cid, Image: imageId, Name: '/' + name, Config: { Labels: { 'org.mca.tvm-run': fault === 'owner' ? 'foreign' : owner }, Env: ['accounts=' + (fault === 'account-option' ? '99' : accounts), ...env] },
    State: { Running: running, Status: running ? 'running' : stopped ? 'exited' : 'created', ExitCode: 143 },
    HostConfig: { NetworkMode: network, Privileged: false, PidMode: '', IpcMode: 'private', CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'],
      MemorySwap: 2147483648, Memory: fault === 'memory' ? 0 : 2147483648, NanoCpus: 2000000000, PidsLimit: 256, LogConfig: { Type: 'none' },
      PublishAllPorts: false, PortBindings: fault === 'publish' ? { '9090/tcp': [{ HostIp: '0.0.0.0', HostPort: '9090' }] } : {} },
    Mounts: fault === 'mount' ? [{ Type: 'bind' }] : [], NetworkSettings: {
      Networks: { [network]: { NetworkID: fault === 'network-id' && running ? 'd'.repeat(64) : running ? nid : '' } },
      Ports: { '9090/tcp': [] } } });
  const io: TvmIO = {
    now: () => time, async pause() { time += 10000; if (fault === 'abort') controller.abort(); },
    async prepare() { return { directory: '/synthetic/owned-classes', compiler: 'javac 21.0.9', sourceSha256: '1'.repeat(64), classSha256: '2'.repeat(64), async cleanup() {} }; },
    async docker(args) {
      commands.push(args); const [a, b] = args;
      if (a === 'context') return JSON.stringify([{ Name: fault === 'remote' ? 'remote' : 'desktop-linux', Endpoints: { docker: { Host: 'unix:///synthetic/socket' } } }]);
      if (a === 'info') return JSON.stringify('Docker Desktop');
      if (a === 'image') return JSON.stringify([{ Id: imageId, Architecture: 'arm64', Os: 'linux', RepoDigests: [tvmImage], Config: {} }]);
      if (a === 'network' && b === 'create') { network = args.at(-1)!; owner = args[args.indexOf('--label') + 1]!.split('=')[1]!; net = true; if (fault === 'lost-network') throw Error('UPSTREAM_SECRET_CANARY'); return nid; }
      if (a === 'create') {
        if (args.includes('--env-file')) { bootstrap = args[args.indexOf('--env-file') + 1]!;
          modes.push((await stat(bootstrap)).mode & 0o777, (await stat(dirname(bootstrap))).mode & 0o777);
          env = (await readFile(bootstrap, 'utf8')).trim().split('\n');
        }
        name = args[args.indexOf('--name') + 1]!; accounts = args[args.indexOf('--env') + 1]!.split('=')[1]!; container = true;
        if (fault === 'lost-create') throw Error('UPSTREAM_SECRET_CANARY'); return cid;
      }
      if (a === 'network' && b === 'inspect') return JSON.stringify([{ Id: nid, Name: network, Internal: fault !== 'external-network', Driver: 'bridge',
        Labels: { 'org.mca.tvm-run': owner }, Containers: container && running ? { [cid]: {} } : fault === 'foreign-network-user' ? { foreign: {} } : {} }]);
      if (a === 'container' && b === 'inspect') return JSON.stringify([value()]);
      if (a === 'cp') { if (fault === 'copy') throw Error('UPSTREAM_SECRET_CANARY'); assert(args[2]!.startsWith(cid + ':/tmp/mca-probe-')); return ''; }
      if (a === 'exec') { assert.equal(b, cid); if (args[2] === '/opt/java/bin/java') return 'openjdk 17.0.17'; assert.equal(args[2], '/usr/bin/test'); return ''; }
      if (a === 'stats') return JSON.stringify({ CPUPerc: '1.00%', MemUsage: '300MiB / 2GiB', MemPerc: '15.00%' });
      if (a === 'start') { assert.equal(b, cid); running = true; return cid; }
      if (a === 'container' && b === 'ls') return container ? cid : '';
      if (a === 'network' && b === 'ls') return net ? nid : '';
      if (a === 'stop') { assert.equal(args.at(-1), cid); running = false; stopped = true; return cid; }
      if (a === 'container' && b === 'rm') { assert.equal(args.at(-1), cid); if (fault === 'cleanup') throw Error('UPSTREAM_SECRET_CANARY'); container = false; running = false; return cid; }
      if (a === 'network' && b === 'rm') { assert.equal(args.at(-1), nid); net = false; return nid; }
      assert.fail('Unexpected Docker operation');
    },
    async request(target, classpath, operation) {
      assert.equal(target, cid); assert(classpath.startsWith('/tmp/mca-probe-')); reads.push(operation);
      if (operation === 'health') { if (fault === 'start-timeout' || fault === 'abort') throw Error('UPSTREAM_SECRET_CANARY'); return { ok: true }; }
      if (operation === 'node') return { configNodeInfo: { codeVersion: fault === 'version' ? 'wrong' : '4.8.2' },
        peerList: fault === 'peers' ? [{}] : [], currentConnectCount: fault === 'peers' ? 1 : 0 };
      if (operation === 'genesis') return { blockID: fault === 'genesis' ? '1'.repeat(64) : genesis, block_header: { raw_data: {} } };
      if (fault !== 'head-timeout') head++;
      return { blockID: head.toString(16).padStart(16, '0') + '0'.repeat(48), block_header: { raw_data: fault === 'missing-height' ? {} : { number: head } } };
    },
  };
  return { io, commands, reads, controller, bootstrap: () => bootstrap, modes, resources: () => ({ container, net }) };
}
test('private TVM lifecycle verifies ownership before start/exec, no publication and complete graceful cleanup', async () => {
  const f = fixture(), r = await runPrivateTvmSmoke(f.io, { expectedGenesis: genesis });
  assert.equal(r.outcome, 'READY'); assert.deepEqual(r.cleanup, { container: 'REMOVED', network: 'REMOVED' });
  assert.deepEqual(f.resources(), { container: false, net: false });
  assert(!f.commands.flat().includes('--publish'));
  const create = f.commands.find(a => a[0] === 'create')!;
  assert(create.includes('--log-driver') && create.includes('none') && create.includes('accounts=3'));
  assert(f.commands.findIndex(a => a[0] === 'container' && a[1] === 'inspect') < f.commands.findIndex(a => a[0] === 'start'));
  assert.equal(r.observations.shutdownExitCode, '143');
});
test('private TVM isolation mismatches and copy failure stop early and recover only owned resources', async () => {
  for (const fault of ['remote', 'external-network', 'account-option', 'memory', 'mount', 'publish', 'network-id', 'copy']) {
    const f = fixture(fault), r = await runPrivateTvmSmoke(f.io, { expectedGenesis: genesis });
    assert.equal(r.outcome, 'ERROR', fault); assert.equal(f.reads.length, 0, fault);
    assert.deepEqual(f.resources(), { container: false, net: false }, fault);
    assert(!JSON.stringify(r).includes('UPSTREAM_SECRET_CANARY'));
    if (!['network-id', 'copy'].includes(fault)) assert(!f.commands.some(a => a[0] === 'start'), fault);
  }
  const f = fixture('owner'), r = await runPrivateTvmSmoke(f.io, { expectedGenesis: genesis });
  assert.equal(r.cleanup.container, 'UNVERIFIED'); assert.equal(f.resources().container, true);
  assert(!f.commands.some(a => a[0] === 'start' || a[0] === 'container' && a[1] === 'rm'));
});
test('private TVM read errors, head timeout, interruption and unpinned genesis never become ready', async () => {
  for (const fault of ['version', 'peers', 'genesis', 'missing-height', 'head-timeout', 'start-timeout', 'abort']) {
    const f = fixture(fault), r = await runPrivateTvmSmoke(f.io, { expectedGenesis: genesis, signal: f.controller.signal });
    assert.equal(r.outcome, 'ERROR', fault); assert.deepEqual(f.resources(), { container: false, net: false });
  }
  const f = fixture(), r = await runPrivateTvmSmoke(f.io, { expectedGenesis: '' });
  assert.equal(r.failure, 'GENESIS_UNPINNED'); assert(!f.reads.includes('head'));
});
test('private TVM lost create response is reclaimed; cleanup failure/foreign network user is retained explicitly', async () => {
  for (const fault of ['lost-create', 'lost-network']) {
    const lost = fixture(fault), recovered = await runPrivateTvmSmoke(lost.io, { expectedGenesis: genesis });
    assert.equal(recovered.outcome, 'ERROR'); assert.deepEqual(lost.resources(), { container: false, net: false });
  }
  for (const fault of ['cleanup', 'foreign-network-user']) {
    const f = fixture(fault), r = await runPrivateTvmSmoke(f.io, { expectedGenesis: genesis });
    assert.equal(r.outcome, 'ERROR'); assert.notEqual(r.cleanup.network, 'REMOVED'); assert(f.resources().net);
    assert(!JSON.stringify(r).includes('UPSTREAM_SECRET_CANARY'));
  }
});

test('private TVM accepts only bounded account options and preserves failed head observations', async () => {
  const f = fixture('head-timeout'), r = await runPrivateTvmSmoke(f.io, { expectedGenesis: genesis, accountCount: 3 });
  assert.equal(r.failure, 'HEAD_TIMEOUT'); assert.equal(r.observations.requestedAccountCount, '3');
  assert.equal(r.observations.accountGenerationVerified, false); assert(r.observations.headBefore); assert(r.observations.headAfter);
  assert.equal(r.observations.codeVersion, '4.8.2');
  const bad = fixture(); const rejected = await runPrivateTvmSmoke(bad.io, { accountCount: 99 as 3 });
  assert.equal(rejected.outcome, 'ERROR'); assert.equal(bad.commands.length, 0);
});

const mnemonic = Array(24).fill('abandon').join(' '); // Lifecycle mock only, not used by the real signer.
test('private fixture bootstrap stays in restricted temporary file, gets removed on success and lost create response', async () => {
  for (const fault of ['', 'lost-create']) {
    const f = fixture(fault); let calls = 0;
    f.io.exchange = async () => { calls++; return '{"balance":18446744073709551615}'; };
    let retained: import('../src/tron/lab/runtime.js').PrivateFixtureSession | undefined;
    const r = await runPrivateTvmSmoke(f.io, { expectedGenesis: genesis, fixture: { mnemonic, async work(session) {
      retained = session;
      assert.equal((await session.request('account', { address: 'synthetic' })).balance, '18446744073709551615');
      return { observed: true };
    } } });
    assert.deepEqual(f.modes, [0o600, 0o700]);
    await assert.rejects(access(f.bootstrap())); await assert.rejects(access(dirname(f.bootstrap())));
    assert(!f.commands.flat().some(a => a.includes(mnemonic)));
    assert(!JSON.stringify(r).includes(mnemonic));
    assert.deepEqual(f.resources(), { container: false, net: false });
    assert.equal(r.outcome, fault ? 'ERROR' : 'READY');
    if (retained) await assert.rejects(retained.request('account', {}), /FIXTURE_TIMEOUT/);
    assert.equal(calls, fault ? 0 : 1);
  }
});
test('private fixture rejects unknown operations and expired sessions, cleans after callback failure', async () => {
  for (const fault of ['operation', 'deadline', 'callback', 'abort']) {
    const f = fixture(); let calls = 0;
    f.io.exchange = async () => { calls++; return '{}'; };
    const r = await runPrivateTvmSmoke(f.io, { expectedGenesis: genesis, signal: f.controller.signal, fixture: { mnemonic, async work(session) {
      if (fault === 'abort') f.controller.abort();
      if (fault === 'deadline') { const before = f.io.now(); f.io.now = () => before + 120001; }
      if (fault === 'callback') throw Error('UPSTREAM_SECRET_CANARY');
      await session.request(fault === 'operation' ? 'transfer' as never : 'account', {});
      return {};
    } } });
    assert.equal(r.outcome, 'ERROR'); assert.equal(calls, 0);
    assert.deepEqual(f.resources(), { container: false, net: false });
    assert(!JSON.stringify(r).includes('UPSTREAM_SECRET_CANARY'));
  }
});

test('fixture dispatch rechecks timeout/abort after awaited inspection and blocks late exchange', async () => {
  for (const fault of ['deadline','abort','response-deadline']) {
    const f=fixture();let armed=false,calls=0;const original=f.io.docker;
    f.io.docker=async args=>{const text=await original(args);if(armed&&args[0]==='network'&&args[1]==='inspect'){
      armed=false;await Promise.resolve();if(fault==='abort')f.controller.abort();else if(fault==='deadline'){const now=f.io.now();f.io.now=()=>now+120001;}
    }return text;};
    f.io.exchange=async()=>{calls++;if(fault==='response-deadline'){const now=f.io.now();f.io.now=()=>now+120001;}return '{}';};
    const report=await runPrivateTvmSmoke(f.io,{expectedGenesis:genesis,signal:f.controller.signal,fixture:{mnemonic,async work(session){armed=true;await session.request('broadcast',{transaction:'synthetic'});return {late:true};}}});
    assert.equal(report.outcome,'ERROR');assert.equal(calls,fault==='response-deadline'?1:0);assert(!report.observations.fixture);assert.deepEqual(f.resources(),{container:false,net:false});
  }
});
test('returned runtime report is isolated from retained mutable worker results',async()=>{
 const f=fixture(),shared={state:'original'};f.io.exchange=async()=> '{}';
 const report=await runPrivateTvmSmoke(f.io,{expectedGenesis:genesis,fixture:{mnemonic,allowance:true,async work(session){await session.request('account',{});return shared;}}});
 assert.equal(report.kind,'TRON_PRIVATE_TVM_ALLOWANCE_PROBE');assert.equal(report.outcome,'READY');shared.state='late mutation';assert.deepEqual(report.observations.fixture,{state:'original'});assert.equal(report.observations.fixtureRequestCount,'1');assert.deepEqual(report.observations.fixtureOperationCounts,{account:'1'});
});
