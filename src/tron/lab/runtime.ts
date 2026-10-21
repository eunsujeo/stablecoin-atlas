import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTronJson } from './lossless.js';
import { compileLocalProbe, exchangeProbe } from './probe.js';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';

export const tvmImage = 'tronbox/tre@sha256:f0d34ad03198943fc0606d97916bea772fed1bb4050d3b6e6d5143f350f38de4';
// Observed in the pinned distribution's discovery and matched in separately created containers.
export const tvmGenesis = '0000000000000000c93baa76a4a508f798a96f59156d9eb17ecede8ec845df2f';
const label = 'org.mca.tvm-run';
const memory = 2147483648, cpu = 2000000000, pids = 256;
type ObjectValue = Record<string, any>;
const object = (value: unknown): ObjectValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_RESPONSE');
  return value as ObjectValue;
};
const check = (condition: unknown, code: string): void => { if (!condition) throw new Error(code); };
const parse = (value: string): any => JSON.parse(value);
export type FixtureOperation = 'deploy' | 'trigger' | 'broadcast' | 'receipt' | 'contract' | 'constant' | 'account' | 'block';
export interface PrivateFixtureSession { request(operation: FixtureOperation, body: unknown): Promise<any> }
export interface TvmIO {
  docker(args: string[]): Promise<string>;
  prepare(): ReturnType<typeof compileLocalProbe>;
  request(containerId: string, classpath: string, operation: 'health' | 'node' | 'genesis' | 'head'): Promise<unknown>;
  exchange?(containerId: string, classpath: string, operation: FixtureOperation, body: unknown): Promise<string>;
  pause(ms: number): Promise<unknown>;
  now(): number;
}
const execute = promisify(execFile);
export const localTvmIO: TvmIO = {
  async docker(args) {
    try { return (await execute('docker', args, { timeout: 30000, maxBuffer: 2 * 1024 * 1024 })).stdout.trim(); }
    catch { throw new Error('DOCKER_COMMAND_FAILED'); }
  },
  prepare: compileLocalProbe, exchange: exchangeProbe,
  async request(containerId, classpath, operation) {
    const text = await localTvmIO.docker(['exec', containerId, '/opt/java/bin/java', '-cp', classpath, 'LocalReadProbe', operation]);
    check(Buffer.byteLength(text) <= 1024 * 1024, 'RESPONSE_TOO_LARGE');
    return JSON.parse(text);
  },
  pause, now: Date.now,
};
export interface RuntimeSmoke {
  schemaVersion: '1.0'; kind: 'TRON_PRIVATE_TVM_RUNTIME_SMOKE' | 'TRON_PRIVATE_TVM_FIXTURE_DEPLOYMENT' | 'TRON_PRIVATE_TVM_TOKEN_SCENARIOS' | 'TRON_PRIVATE_TVM_TOKEN_BOUNDARIES' | 'TRON_PRIVATE_TVM_TRANSFER_PROBE' | 'TRON_PRIVATE_TVM_ALLOWANCE_PROBE'; runId: string; image: string; startedAt: string; completedAt?: string;
  outcome: 'READY' | 'ERROR'; failure?: string; observations: Record<string, unknown>;
  resources: { container: string; network: string; containerId?: string; networkId?: string };
  cleanup: { container: string; network: string };
  limitations: string[];
}
const safeFailures = new Set(['LOCAL_DOCKER_REQUIRED', 'IMAGE_MISMATCH', 'NETWORK_MISMATCH', 'CONTAINER_MISMATCH',
  'DOCKER_COMMAND_FAILED', 'NODE_MISMATCH', 'PEERS_PRESENT', 'INVALID_BLOCK', 'GENESIS_MISMATCH', 'GENESIS_UNPINNED', 'PROBE_COMPILE_FAILED', 'HEAD_TIMEOUT', 'START_TIMEOUT', 'INTERRUPTED', 'FIXTURE_TIMEOUT', 'FIXTURE_OPERATION_REJECTED']);

export async function runPrivateTvmSmoke(io: TvmIO = localTvmIO, options: { expectedGenesis?: string; accountCount?: 0 | 3; signal?: AbortSignal; fixture?: { exercise?: boolean; boundary?: boolean; probe?: boolean; allowance?: boolean; mnemonic: string; work(session: PrivateFixtureSession): Promise<Record<string, unknown>> } } = {}): Promise<RuntimeSmoke> {
  const accountCount = options.accountCount ?? 3;
  const runId = randomUUID(), name = `mca-tvm-${runId}`, networkName = `${name}-net`, started = io.now();
  const result: RuntimeSmoke = { schemaVersion: '1.0', kind: options.fixture ? options.fixture.allowance ? 'TRON_PRIVATE_TVM_ALLOWANCE_PROBE' : options.fixture.probe ? 'TRON_PRIVATE_TVM_TRANSFER_PROBE' : options.fixture.boundary ? 'TRON_PRIVATE_TVM_TOKEN_BOUNDARIES' : options.fixture.exercise ? 'TRON_PRIVATE_TVM_TOKEN_SCENARIOS' : 'TRON_PRIVATE_TVM_FIXTURE_DEPLOYMENT' : 'TRON_PRIVATE_TVM_RUNTIME_SMOKE', runId, image: tvmImage,
    startedAt: new Date().toISOString(), outcome: 'ERROR', observations: {}, resources: { container: name, network: networkName },
    cleanup: { container: 'NOT_CREATED', network: 'NOT_CREATED' }, limitations: [
      options.fixture?.allowance ? 'One owned private allowance probe; no Mainnet compatibility, finality or asset safety verification.' : options.fixture?.probe ? 'One private transfer probe only; no Mainnet compatibility, finality or asset safety verification.' : options.fixture?.exercise ? 'Private normal-Fixture transfer/approval observations only; not a Mainnet compatibility or asset safety assessment.' : options.fixture ? 'One disposable private Fixture deployment/initial-state observation only; no transfer or approval execution tested.' : 'Runtime startup/isolation evidence only; no TRC-20 deployment, signing, transfer or approval was tested.',
      'TRE-specific distribution, not upstream byte-for-byte source verification or Mainnet compatibility evidence.',
      'Observed heads do not bind getter responses to exact blocks. Resource sample is a point observation, not sizing guidance.',
    ] };
  let networkAttempted = false, containerAttempted = false, imageId = '', networkId = '', containerId = '';
  let bootstrapDirectory: string | undefined;
  let bootstrapFile: string | undefined;
  let probe: Awaited<ReturnType<typeof compileLocalProbe>> | undefined;
  const classpath = `/tmp/mca-probe-${runId}`;
  const interrupt = () => check(!options.signal?.aborted, 'INTERRUPTED');
  const inspect = async (kind: 'container' | 'network', resource: string) => object(parse(await io.docker([kind, 'inspect', resource]))[0]);
  const owned = (value: ObjectValue, kind: 'container' | 'network') =>
    (kind === 'container' ? value.Config?.Labels : value.Labels)?.[label] === runId;
  const verifyNetwork = async () => {
    const value = await inspect('network', networkName);
    check(owned(value, 'network') && value.Internal === true && value.Driver === 'bridge'
      && value.Name === networkName && /^[a-f0-9]{64}$/.test(value.Id), 'NETWORK_MISMATCH');
    networkId = value.Id; result.resources.networkId = networkId; return value;
  };
  const verifyContainer = async (running: boolean) => {
    const value = await inspect('container', name), host = value.HostConfig, config = value.Config;
    const nets = Object.keys(value.NetworkSettings?.Networks ?? {});
    check(owned(value, 'container') && value.Image === imageId && value.Name === '/' + name
      && host?.NetworkMode === networkName && nets.length === 1 && nets[0] === networkName
      && (value.NetworkSettings.Networks[networkName].NetworkID === networkId
        || !running && value.NetworkSettings.Networks[networkName].NetworkID === '')
      && host.Privileged === false && !['host', 'container'].some(v => String(host.PidMode).startsWith(v))
      && host.IpcMode !== 'host' && host.CapDrop?.includes('ALL') && host.SecurityOpt?.includes('no-new-privileges')
      && host.Memory === memory && host.MemorySwap === memory && host.NanoCpus === cpu && host.PidsLimit === pids
      && host.LogConfig?.Type === 'none' && (value.Mounts ?? []).length === 0
      && !(host.Binds?.length) && !(host.VolumesFrom?.length) && !(host.Devices?.length)
      && Array.isArray(config.Env) && config.Env.filter((e: unknown) => typeof e === 'string' && e.startsWith('accounts=')).length === 1
      && config.Env.includes(`accounts=${accountCount}`)
      && (!options.fixture || config.Env.filter((e: string) => e.startsWith('mnemonic=')).length === 1
        && config.Env.includes('mnemonic=' + options.fixture.mnemonic)
        && config.Env.filter((e: string) => e.startsWith('hdPath=')).length === 1 && config.Env.includes("hdPath=m/44'/60'/0'/0/")) && host.PublishAllPorts === false
      && Object.keys(host.PortBindings ?? {}).length === 0
      && /^[a-f0-9]{64}$/.test(value.Id) && (!containerId || value.Id === containerId), 'CONTAINER_MISMATCH');
    if (running) {
      const bindings = value.NetworkSettings.Ports;
      check(value.State?.Running === true
        && Object.values(bindings ?? {}).every(v => v === null || Array.isArray(v) && v.length === 0), 'CONTAINER_MISMATCH');
    } else check(value.State?.Status === 'created', 'CONTAINER_MISMATCH');
    containerId = value.Id; result.resources.containerId = containerId;
    return value;
  };
  const request = async (operation: 'health' | 'node' | 'genesis' | 'head') => {
    interrupt(); await verifyContainer(true); return io.request(containerId, classpath, operation);
  };
  const block = (input: unknown, genesis = false) => {
    const value = object(input);
    const pinnedGenesis = typeof value.blockID === 'string' && value.blockID.toLowerCase() === (options.expectedGenesis ?? tvmGenesis);
    const number = value.block_header?.raw_data?.number ?? (genesis || pinnedGenesis ? 0 : undefined);
    check(Number.isSafeInteger(number) && number >= 0 && typeof value.blockID === 'string'
      && /^[a-f0-9]{64}$/i.test(value.blockID) && BigInt('0x' + value.blockID.slice(0, 16)) === BigInt(number), 'INVALID_BLOCK');
    return { number: String(number), id: value.blockID.toLowerCase() as string };
  };
  try {
    check(accountCount === 0 || accountCount === 3, 'CONTAINER_MISMATCH');
    result.observations.requestedAccountCount = String(accountCount);
    result.observations.accountGenerationVerified = false;
    interrupt();
    const context = object(parse(await io.docker(['context', 'inspect']))[0]);
    check(context.Name === 'desktop-linux' && /^unix:\/\//.test(context.Endpoints?.docker?.Host ?? '')
      && !process.env.DOCKER_HOST, 'LOCAL_DOCKER_REQUIRED');
    check(parse(await io.docker(['info', '--format', '{{json .OperatingSystem}}'])) === 'Docker Desktop', 'LOCAL_DOCKER_REQUIRED');
    const image = object(parse(await io.docker(['image', 'inspect', tvmImage]))[0]);
    check(image.Architecture === 'arm64' && image.Os === 'linux' && /^sha256:[a-f0-9]{64}$/.test(image.Id)
      && image.RepoDigests?.some((d: unknown) => d === tvmImage || d === 'docker.io/' + tvmImage)
      && !Object.keys(image.Config?.Volumes ?? {}).length, 'IMAGE_MISMATCH');
    imageId = image.Id; interrupt();
    probe = await io.prepare(); result.observations.probe = { sourceSha256: probe.sourceSha256, classSha256: probe.classSha256, compiler: probe.compiler }; interrupt();
    result.observations.imageId = imageId;
    if (options.fixture) {
      check(/^[a-z]+(?: [a-z]+){23}$/.test(options.fixture.mnemonic) && accountCount === 3, 'CONTAINER_MISMATCH');
      bootstrapDirectory = await mkdtemp(join(tmpdir(), 'mca-tvm-bootstrap-')); bootstrapFile = join(bootstrapDirectory, 'bootstrap.env');
      await writeFile(bootstrapFile, 'mnemonic=' + options.fixture.mnemonic + "\nhdPath=m/44'/60'/0'/0/\n", { mode: 0o600, flag: 'wx' });
    }
    networkAttempted = true;
    await io.docker(['network', 'create', '--internal', '--driver', 'bridge', '--label', `${label}=${runId}`, networkName]);
    await verifyNetwork(); interrupt();
    containerAttempted = true;
    await io.docker(['create', '--name', name, '--label', `${label}=${runId}`, '--platform', 'linux/arm64',
      '--network', networkName, '--memory', String(memory), '--memory-swap', String(memory),
      '--cpus', '2', '--pids-limit', String(pids), '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '--log-driver', 'none', '--env', `accounts=${accountCount}`, ...(bootstrapFile ? ['--env-file', bootstrapFile] : []), tvmImage]);
    if (bootstrapFile) await unlink(bootstrapFile);
    await verifyContainer(false); interrupt();
    await io.docker(['start', containerId]); await verifyContainer(true); await verifyNetwork();
    const javaVersion = (await io.docker(['exec', containerId, '/opt/java/bin/java', '--version'])).match(/^openjdk (17\.[0-9.]+)/)?.[1];
    check(javaVersion, 'NODE_MISMATCH'); result.observations.javaRuntimeVersion = javaVersion;
    await verifyContainer(true);
    await io.docker(['cp', probe.directory + '/.', containerId + ':' + classpath]);
    await verifyContainer(true);
    await io.docker(['exec', containerId, '/usr/bin/test', '-r', classpath + '/LocalReadProbe.class']);
    const deadline = io.now() + 60000;
    let alive = false;
    while (io.now() < deadline) {
      interrupt();
      try { if (object(await request('health')).ok === true) { alive = true; break; } } catch { /* Startup only. */ }
      await io.pause(500);
    }
    check(alive, 'START_TIMEOUT');
    const info = object(await request('node'));
    check(info.configNodeInfo?.codeVersion === '4.8.2', 'NODE_MISMATCH');
    check(Array.isArray(info.peerList) && info.peerList.length === 0 && info.currentConnectCount === 0, 'PEERS_PRESENT');
    result.observations.codeVersion = '4.8.2'; result.observations.peerCount = '0';
    const genesis = block(await request('genesis'), true);
    check(genesis.number === '0', 'INVALID_BLOCK'); result.observations.genesis = genesis;
    const expected = options.expectedGenesis ?? tvmGenesis;
    check(expected !== '', 'GENESIS_UNPINNED'); check(genesis.id === expected, 'GENESIS_MISMATCH');
    const before = block(await request('head'));
    let after = before;
    result.observations.headBefore = before; result.observations.headAfter = after;
    const headStarted = io.now();
    while (io.now() < deadline && BigInt(after.number) <= BigInt(before.number)) {
      interrupt(); await io.pause(500); after = block(await request('head'));
      result.observations.headAfter = after; result.observations.headObservationMs = String(io.now() - headStarted);
    }
    check(BigInt(after.number) > BigInt(before.number), 'HEAD_TIMEOUT');
    const finalInfo = object(await request('node'));
    check(Array.isArray(finalInfo.peerList) && finalInfo.peerList.length === 0 && finalInfo.currentConnectCount === 0, 'PEERS_PRESENT');
    await verifyContainer(true); const network = await verifyNetwork();
    check(Object.keys(network.Containers ?? {}).length === 1 && !!network.Containers[containerId], 'NETWORK_MISMATCH');
    if (options.fixture) {
      let active = true;
      const fixtureDeadline = io.now() + 120000;
      if (options.fixture.allowance) { result.observations.fixtureRequestCount = '0'; result.observations.fixtureOperationCounts = {}; }
      const session: PrivateFixtureSession = Object.freeze({ request: async (operation: FixtureOperation, body: unknown) => {
        interrupt(); check(active && io.now() < fixtureDeadline, 'FIXTURE_TIMEOUT');
        check(['deploy', 'trigger', 'broadcast', 'receipt', 'contract', 'constant', 'account', 'block'].includes(operation)
          && body && typeof body === 'object' && !Array.isArray(body)
          && Buffer.byteLength(JSON.stringify(body)) <= 1024 * 1024, 'FIXTURE_OPERATION_REJECTED');
        await verifyContainer(true); const currentNetwork = await verifyNetwork();
        check(Object.keys(currentNetwork.Containers ?? {}).length === 1 && !!currentNetwork.Containers[containerId], 'NETWORK_MISMATCH');
        check(typeof io.exchange === 'function', 'CONTAINER_MISMATCH');
        // Inspection awaits may outlive the session or an abort. Recheck at dispatch.
        interrupt(); check(active && io.now() < fixtureDeadline, 'FIXTURE_TIMEOUT');
        if (options.fixture?.allowance) {
          result.observations.fixtureRequestCount = String(BigInt(result.observations.fixtureRequestCount as string) + 1n);
          const counts = result.observations.fixtureOperationCounts as Record<string, string>; counts[operation] = String(BigInt(counts[operation] ?? '0') + 1n);
        }
        const text = await io.exchange!(containerId, classpath, operation, body);
        interrupt(); check(active && io.now() < fixtureDeadline, 'FIXTURE_TIMEOUT');
        return parseTronJson(text);
      } });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        result.observations.fixture = await Promise.race([options.fixture.work(session),
          new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('FIXTURE_TIMEOUT')), 120000); })]);
      } finally { active = false; clearTimeout(timer); }
      interrupt(); await verifyContainer(true); await verifyNetwork();
      const peers = object(await request('node'));
      check(Array.isArray(peers.peerList) && peers.peerList.length === 0 && peers.currentConnectCount === 0, 'PEERS_PRESENT');
    }
    const metrics = object(parse(await io.docker(['stats', '--no-stream', '--format', '{{json .}}', containerId])));
    const metric = (v: unknown) => typeof v === 'string' && /^[0-9. %/KMGTiB]+$/.test(v) ? v : 'UNKNOWN';
    result.observations.resourceSample = { cpuPercent: metric(metrics.CPUPerc), memory: metric(metrics.MemUsage),
      memoryPercent: metric(metrics.MemPerc), sampleKind: 'SINGLE_DOCKER_STATS_OBSERVATION' };
    result.observations = { ...result.observations, codeVersion: '4.8.2', genesis, headBefore: before, headAfter: after,
      peerCount: '0', internalNetwork: true, hostPublishedPorts: '0', containerLoopbackProbe: true, automaticAccountsRequested: accountCount > 0,
      memoryLimitBytes: String(memory), cpuLimit: '2', pidsLimit: String(pids), elapsedMs: String(io.now() - started) };
    interrupt(); result.outcome = 'READY';
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    result.failure = safeFailures.has(code) ? code : 'RUNTIME_CHECK_FAILED';
  } finally {
    const clean = async (kind: 'container' | 'network', attempted: boolean): Promise<string> => {
      if (!attempted) return 'NOT_CREATED';
      const resource = kind === 'container' ? name : networkName;
      try {
        // `ls` distinguishes absence from an inspect/daemon failure without trusting stderr text.
        const ids = (await io.docker(kind === 'container' ? ['container', 'ls', '-aq', '--filter', `name=^/${resource}$`]
          : ['network', 'ls', '-q', '--filter', `name=^${resource}$`])).trim();
        if (!ids) return 'ABSENT';
        const value = await inspect(kind, resource);
        if (!owned(value, kind) || !/^[a-f0-9]{64}$/.test(value.Id)
          || kind === 'container' && containerId && containerId !== value.Id
          || kind === 'network' && networkId && networkId !== value.Id) return 'UNVERIFIED';
        if (kind === 'container') result.resources.containerId = value.Id; else result.resources.networkId = value.Id;
        if (kind === 'network' && Object.keys(value.Containers ?? {}).length !== 0) return 'RETAINED';
        if (kind === 'container') {
          if (value.State?.Running) {
            try {
              await io.docker(['stop', '--time', '10', value.Id]);
              const stopped = await inspect('container', resource);
              check(owned(stopped, kind) && stopped.Id === value.Id && stopped.State?.Running === false
                && [0, 143].includes(stopped.State.ExitCode), 'CONTAINER_MISMATCH');
              result.observations.oomKilled = stopped.State.OOMKilled === true;
              result.observations.shutdownExitCode = String(stopped.State.ExitCode);
            } catch { result.outcome = 'ERROR'; result.failure ??= 'GRACEFUL_STOP_FAILED'; }
          }
          await io.docker(['container', 'rm', '-f', '-v', value.Id]);
        }
        else await io.docker(['network', 'rm', value.Id]);
        return 'REMOVED';
      } catch { return 'FAILED'; }
    };
    result.cleanup.container = await clean('container', containerAttempted);
    result.cleanup.network = ['FAILED', 'UNVERIFIED', 'RETAINED'].includes(result.cleanup.container) && networkAttempted
      ? 'RETAINED' : await clean('network', networkAttempted);
    if ([result.cleanup.container, result.cleanup.network].some(v => ['FAILED', 'UNVERIFIED', 'RETAINED'].includes(v))) {
      result.outcome = 'ERROR'; result.failure ??= 'CLEANUP_FAILED';
    }
    try { if (bootstrapDirectory) await rm(bootstrapDirectory, { recursive: true, force: true }); }
    catch { result.outcome = 'ERROR'; result.failure ??= 'BOOTSTRAP_CLEANUP_FAILED'; }
    try { await probe?.cleanup(); } catch { result.outcome = 'ERROR'; result.failure ??= 'PROBE_CLEANUP_FAILED'; }
    result.completedAt = new Date().toISOString();
  }
  return structuredClone(result);
}
