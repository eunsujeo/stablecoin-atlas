import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { decodeLegacyMint, encodePublicKey, readStablecoinMints, LEGACY_TOKEN_PROGRAM, SOLANA_MAINNET_GENESIS,
  SOLANA_STABLECOIN_MINTS } from '../src/research/solana-mint-readonly.js';

const sentinel = 'synthetic-endpoint-token-sentinel';
function mint(supply = 18446744073709551615n) {
  const b = Buffer.alloc(82); b.writeUInt32LE(1, 0); b.fill(7, 4, 36);
  b.writeBigUInt64LE(supply, 36); b[44] = 6; b[45] = 1;
  b.writeUInt32LE(1, 46); b.fill(9, 50, 82); return b;
}
function account(data = mint()) {
  return { owner: LEGACY_TOKEN_PROGRAM, executable: false, space: 82, data: [data.toString('base64'), 'base64'],
    // Ignored numeric balances/epochs never enter the report.
    lamports: 9007199254740994, rentEpoch: 18446744073709551615 };
}
type Request = { id: number; method: string; params: unknown[] };
async function withNode(run: (url: string, calls: Request[], set: (fault: string) => void) => Promise<void>) {
  let fault = ''; const calls: Request[] = [];
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += String(chunk);
    const body = JSON.parse(raw) as Request; calls.push(body);
    if (fault === 'http') { response.writeHead(403); response.end(sentinel); return; }
    if (fault === 'squid') { response.writeHead(451, { 'x-squid-error': 'ERR_ACCESS_DENIED 0', via: 'synthetic-proxy' }); response.end(sentinel); return; }
    if (fault === 'rpc') { response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32000, message: sentinel, data: sentinel } })); return; }
    if (fault === 'oversize') { response.end(' '.repeat(65537)); return; }
    if (fault === 'redirect') { response.writeHead(302, { location: '/redirect-target?secret='+sentinel }); response.end(); return; }
    let result: unknown;
    if (body.method === 'getGenesisHash') result = fault === 'wrong-network' ? '1'.repeat(32) : fault === 'bad-genesis' ? sentinel : SOLANA_MAINNET_GENESIS;
    else {
      assert.equal(body.method, 'getMultipleAccounts');
      assert.deepEqual(body.params, [SOLANA_STABLECOIN_MINTS.map(p => p.mint), { commitment: 'finalized', encoding: 'base64' }]);
      const a: Record<string, unknown> = account();
      if (fault === 'owner') a.owner = '1'.repeat(32);
      if (fault === 'token2022') a.owner = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
      if (fault === 'bad-owner') a.owner = sentinel;
      if (fault === 'executable') a.executable = true;
      if (fault === 'encoding') a.data = [mint().toString('base64'), 'base64+zstd'];
      if (fault === 'length') a.data = [Buffer.alloc(165).toString('base64'), 'base64'];
      if (fault === 'bad-base64') a.data = [mint().toString('base64').slice(0,-2)+'!?', 'base64'];
      if (fault === 'space') a.space = 165;
      if (fault === 'option') { const b=mint(); b.writeUInt32LE(256,46); a.data=[b.toString('base64'),'base64']; }
      if (fault === 'uninitialized') { const b=mint(); b[45]=0; a.data=[b.toString('base64'),'base64']; }
      result = { context: { slot: fault === 'unsafe-slot' ? 9007199254740992 : fault === 'negative-slot' ? -1 : 123456789 },
        value: fault === 'missing' ? [a] : fault === 'null' ? [null, account( mint(0n))] : [a, account(mint(9007199254740993n))] };
    }
    response.end(JSON.stringify({ jsonrpc: '2.0', id: fault === 'id' ? body.id + 1 : body.id, result,
      ...(fault === 'both' ? { error: { code: -1, message: sentinel } } : {}) }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  try { await run(`http://127.0.0.1:${address.port}/?token=${sentinel}`, calls, f => { fault=f; calls.length=0; }); }
  finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
test('legacy Mint binary decoding preserves exact u64, COption None/Some and base58 leading zeros', () => {
  const b=mint(); const state=decodeLegacyMint(b);
  assert.equal(state.supplyRaw,'18446744073709551615'); assert.equal(state.decimals,6);
  assert.deepEqual(state.mintAuthority,{state:'PRESENT',address:encodePublicKey(Buffer.alloc(32,7))});
  assert.deepEqual(state.freezeAuthority,{state:'PRESENT',address:encodePublicKey(Buffer.alloc(32,9))});
  assert.equal(encodePublicKey(Buffer.alloc(32)),'1'.repeat(32));
  const one=Buffer.alloc(32);one[31]=1;assert.equal(encodePublicKey(one),'1'.repeat(31)+'2');
  const zeroAuthority=mint();zeroAuthority.fill(0,4,36);
  assert.deepEqual(decodeLegacyMint(zeroAuthority).mintAuthority,{state:'PRESENT',address:'1'.repeat(32)});
  b.writeUInt32LE(0,0); b.writeUInt32LE(0,46); b.writeBigUInt64LE(0n,36); b[45]=0;
  // COption None ignores stale payload bytes, matching official unpack implementation.
  assert.deepEqual(decodeLegacyMint(b),{initialized:false,supplyRaw:'0',decimals:6,mintAuthority:{state:'NONE_IN_MINT'},freezeAuthority:{state:'NONE_IN_MINT'}});
  for (const offset of [0,46]) { const x=mint(); x.writeUInt32LE(2,offset); assert.throws(()=>decodeLegacyMint(x)); }
  for (const length of [0,81,83,165]) assert.throws(()=>decodeLegacyMint(Buffer.alloc(length)));
  b[45]=2;assert.throws(()=>decodeLegacyMint(b));
});
test('mint research binds RPC genesis, single finalized slot, fixed methods/order and no writes', async () => {
  await withNode(async (url,calls,set) => {
    const report=await readStablecoinMints(url);
    assert.equal(report.status,'OBSERVED'); assert.equal(report.responseContextSlot,'123456789');
    assert.equal(report.genesisBinding,'MATCHED_RPC_REPORTED_GENESIS');
    assert.equal(report.observations[1]!.mintState!.supplyRaw,'9007199254740993');
    assert.equal(report.productAdapter,'AVAILABLE_SEPARATELY_MINT_ONLY');assert.equal(report.actualAuthorityExercise,'NOT_TESTED');
    assert.deepEqual(calls.map(x=>x.method),['getGenesisHash','getMultipleAccounts']);
    assert(!JSON.stringify(report).includes(sentinel));assert(!JSON.stringify(report).includes('lamports'));
    for (const fault of ['wrong-network','bad-genesis']) {
      set(fault); const r=await readStablecoinMints(url);assert.equal(r.status,'INCONCLUSIVE');assert.equal(calls.length,1);
      assert.equal(r.responseContextSlot,'UNKNOWN');assert(r.observations.every(o=>o.mintState===undefined));
    }
    set('null');const missing=await readStablecoinMints(url);
    assert.equal(missing.observations[0]!.reason,'NULL_ACCOUNT_AT_RESPONSE_CONTEXT');
    assert.equal(missing.observations[1]!.mintState!.supplyRaw,'0');assert.equal(missing.status,'INCONCLUSIVE');
  });
});
test('unsupported owner/layout, invalid fields and upstream failures never imply token absence or authority absence', async () => {
  await withNode(async (url,calls,set) => {
    for (const fault of ['owner','token2022','bad-owner','executable','encoding','length','bad-base64','space','option','uninitialized',
      'unsafe-slot','negative-slot','missing','http','squid','rpc','oversize','redirect','id','both']) {
      set(fault);const r=await readStablecoinMints(url);assert.equal(r.status,'INCONCLUSIVE',fault);
      assert(!r.observations[0]!.mintState,fault);assert(!JSON.stringify(r).includes(sentinel),fault);
      assert(calls.length<=2);assert(calls.every(x=>['getGenesisHash','getMultipleAccounts'].includes(x.method)));
      if (fault==='squid') assert.deepEqual(r.failure,{category:'HTTP_ERROR',httpStatus:451,squidErrorCode:'ERR_ACCESS_DENIED'});
      if (fault==='rpc') assert.deepEqual(r.failure,{category:'RPC_ERROR',rpcCode:-32000});
      if (fault==='http') assert.deepEqual(r.failure,{category:'HTTP_ERROR',httpStatus:403});
    }
    await assert.rejects(readStablecoinMints('file:///synthetic'),/INVALID_RPC_CONFIGURATION/);
  });
});

export function cli(url: string, out: string, args: string[] = []) {
  return new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{
    const child=spawn(process.execPath,['--use-env-proxy','--import','tsx','src/research/solana-mint-cli.ts','--out',out,...args],
      {env:{...process.env,SOLANA_RPC_URL:url},stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',d=>{stdout+=String(d);});child.stderr.on('data',d=>{stderr+=String(d);});
    child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));
  });
}

export async function verifyCli() {
  const dir=await mkdtemp(join(tmpdir(),'solana-mint-cli-'));const out=join(dir,'report.json');
  try { await withNode(async (url,calls,set)=>{
    const success=await cli(url,out);assert.equal(success.code,0,success.stderr);
    assert.equal(JSON.parse(await readFile(out,'utf8')).status,'OBSERVED');assert.equal((await stat(out)).mode&0o777,0o600);
    await writeFile(out,'preserve-me');calls.length=0;
    const bad=await cli(url,out,['--mint',sentinel]);assert.equal(bad.code,1);assert.equal(calls.length,0);
    assert.equal(await readFile(out,'utf8'),'preserve-me');assert(!bad.stderr.includes(sentinel));
    set('http');const failed=await cli(url,out);assert.equal(failed.code,2);
    assert.equal(JSON.parse(await readFile(out,'utf8')).status,'INCONCLUSIVE');
    assert(!(failed.stdout+failed.stderr+await readFile(out,'utf8')).includes(sentinel));
  }); } finally {await rm(dir,{recursive:true,force:true});}
}

test('research CLI writes private reports, keeps output on argument failure and returns2 for inconclusive RPC', verifyCli);
