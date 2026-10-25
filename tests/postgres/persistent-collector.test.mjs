import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fixture} from './fixture.mjs';
import {initialize,partition,grantAccess} from '../../tools/market-db/schema.mjs';
import {initializeHistory,normalizeHistory,enableContinuousHistory,upgradeScheduler,grantHistoryWriter} from '../../tools/market-db/history.mjs';
import {runCollector} from '../../tools/collector-worker.mjs';
import {periodicJobs,receiptStore} from '../../tools/periodic-jobs.mjs';
import {publishedMarket} from '../../tools/market-store.mjs';
const registry=JSON.parse(await readFile(new URL('../../data/asset-registry.json',import.meta.url)));
test('persistent collector stores outside checkout and recovers from the same archive without another provider request',{timeout:120000},async()=>{
 const f=await fixture(),root=await mkdtemp(join(tmpdir(),'atlas-persistent-'));try{
  await initialize(f.admin);const month=new Date().toISOString().slice(0,7);await partition(f.admin,month);const next=new Date();next.setUTCMonth(next.getUTCMonth()+1);await partition(f.admin,next.toISOString().slice(0,7));
  await initializeHistory(f.admin);await normalizeHistory(f.admin,registry);await enableContinuousHistory(f.admin);await upgradeScheduler(f.admin);
  const url=await f.createUser('atlas_test_persistentwriter');await grantAccess(f.admin,'atlas_test_persistentwriter','writer');await grantHistoryWriter(f.admin,'atlas_test_persistentwriter');
  const options={once:true,skipDailyHistory:true,arkhamRunsPerDay:288,arkhamInterval:'5m',stateDirectory:join(root,'receipts'),archiveRoot:join(root,'archive'),marketDirectory:join(root,'market-store')},env={DATABASE_URL:url,ARKM_API_KEY:'not-live-test-key'};
  await mkdir(options.marketDirectory,{mode:0o700});
  let requests=0,slot;const fetcher=async url=>{requests++;const path=new URL(url).pathname;return new Response(JSON.stringify(path.includes('/market/')?{price:'1',circulatingSupply:'123.000000000000000001'}:path.includes('/holders/')?{totalSupply:{ethereum:'456'}}:{ethereum:{active:true,tip:'42',asOf:{tip:null}}}));};
  const result=await runCollector({env,options,jobsFactory:input=>{assert.equal(input.marketDirectory,options.marketDirectory);return periodicJobs({...input,fetcher});},onState:r=>{if(r.job==='ARKHAM')slot=r.slot;}});assert.equal(result.state,'COMPLETED');assert.equal(requests,7);
  const stored=await publishedMarket(options.marketDirectory);assert.equal(stored.databaseState.state,'STORED');
  const receipts=await receiptStore(options.stateDirectory),receipt=await receipts.read('ARKHAM',slot);assert(receipt);
  const restarted=periodicJobs({env,receipts,archiveRoot:options.archiveRoot,marketDirectory:options.marketDirectory,fetcher:()=>assert.fail('recovery must not refetch')});
  assert.equal((await restarted.ARKHAM.resume(receipt)).state,'SUCCESS');assert.equal(requests,7);assert.equal((await publishedMarket(options.marketDirectory)).databaseState.sourceHash,stored.databaseState.sourceHash);
 }finally{await f.stop();await rm(root,{recursive:true,force:true});}
});
