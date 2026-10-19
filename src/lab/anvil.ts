import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { Rpc } from '../evm/rpc.js';

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Cannot allocate local port');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}
export class LocalLab {
  private constructor(readonly rpc: Rpc, private process: ChildProcess) {}
  static async start(): Promise<LocalLab> {
    const port = await freePort();
    const child = spawn('anvil', ['--host', '127.0.0.1', '--port', String(port), '--chain-id', '31337', '--silent',
      '--mnemonic', 'test test test test test test test test test test test junk', '--timestamp', '1700000000', '--hardfork', 'shanghai'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
    let failure: string | undefined;
    child.on('error', () => { failure = 'Cannot start Anvil. Install Foundry and ensure anvil is on PATH.'; });
    let stderr = '';
    child.stderr?.on('data', data => { stderr = (stderr + String(data)).slice(-2000); });
    const rpc = new Rpc(`http://127.0.0.1:${port}`);
    for (let attempt = 0; attempt < 100; attempt++) {
      if (failure || child.exitCode !== null) { child.kill(); throw new Error(failure ?? `Anvil exited: ${stderr}`); }
      try {
        const version = await rpc.request<string>('web3_clientVersion');
        if (!version.toLowerCase().includes('anvil')) throw new Error('Unexpected local server');
        if (await rpc.request<string>('eth_chainId') !== '0x7a69') throw new Error('Unexpected local chain');
        rpc.evidence.length = 0;
        return new LocalLab(rpc, child);
      } catch { await delay(50); }
    }
    child.kill(); throw new Error('Anvil startup timed out');
  }
  async stop(): Promise<void> {
    if (this.process.exitCode !== null) return;
    const exited = new Promise<void>(resolve => this.process.once('exit', () => resolve()));
    this.process.kill('SIGTERM');
    const force = setTimeout(() => this.process.kill('SIGKILL'), 2000);
    try { await exited; } finally { clearTimeout(force); }
  }
}
