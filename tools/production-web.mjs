import {parseEnv} from 'node:util';
import {isCLIEntrypoint} from './cli-entrypoint.mjs';
import {boundedRead} from './evidence-store.mjs';
import {deploymentRuntimeSupported} from './collector-deploy.mjs';
import {startPreviewServer} from './ui-preview.mjs';
import {validatePublicHosts} from './production-policy.mjs';
import {productionConnector} from './production-database.mjs';
import {databaseMarketReader} from './market-db/preview.mjs';
import {databaseRegistrationReader} from './market-db/registration-preview.mjs';
import {databaseActivityReader} from './market-db/activity-preview.mjs';
import {databaseReviewedSupplyReader} from './market-db/allium-supply-preview.mjs';
import {databaseSurveyReader} from './market-db/survey-preview.mjs';
import {readPublicFX} from './publish-production-fx.mjs';
import {readProductionReader} from './production-reader-file.mjs';

export async function productionSettings({configFile,readerFile,revisionFile}){
  if(!deploymentRuntimeSupported()||process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw Error('RUNTIME_UNSUPPORTED');
  const config=JSON.parse((await boundedRead(configFile,16384)).toString('utf8'));
  if(Object.keys(config).some(k=>!['hosts','port','fxFile'].includes(k))||!Number.isInteger(config.port)||config.port<1||config.port>65535||typeof config.fxFile!=='string'||!config.fxFile.startsWith('/'))throw Error('PUBLIC_CONFIG_INVALID');
  validatePublicHosts(config.hosts);
  const env=parseEnv(await readProductionReader(readerFile));
  if(!env.DATABASE_URL||Object.keys(env).some(k=>!['DATABASE_URL','DATABASE_CA_FILE'].includes(k)))throw Error('READER_CONFIG_INVALID');
  const commit=(await boundedRead(revisionFile,128)).toString('utf8').trim();
  if(!/^[a-f0-9]{40}$/.test(commit))throw Error('COMMIT_INVALID');
  return {config,env,commit};
}
export async function startProduction({config,env,commit},{connector=productionConnector(env)}={}){
  if(!/^[a-f0-9]{40}$/.test(commit))throw Error('COMMIT_INVALID');
  // Fail before listening if a writer/owner or missing reader is configured.
  const probe=await connector.connect();await probe.end();
  const connect=connector.connect;
  const server=await startPreviewServer(config.port,{
    production:{hosts:config.hosts,commit},
    marketReader:databaseMarketReader({env,connect,includeLocalStatus:false}),registrationReader:databaseRegistrationReader({env,connect}),
    activityReader:databaseActivityReader({env,connect}),reviewedSupplyReader:databaseReviewedSupplyReader({env,connect}),surveyReader:databaseSurveyReader({env,connect}),
    fxReader:()=>readPublicFX(config.fxFile),
  });
  let stopping;
  const stop=()=>stopping??=(async()=>{
    const timer=setTimeout(()=>server.closeAllConnections(),20000);timer.unref();
    try{await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});await connector.close();}
    finally{clearTimeout(timer);}
  })();
  return {server,stop};
}
export function productionArguments(args){
  const o={revisionFile:new URL('../REVISION',import.meta.url)},seen=new Set();
  for(let i=0;i<args.length;i+=2){const k={'--config':'configFile','--reader-env':'readerFile','--revision-file':'revisionFile'}[args[i]];if(!k||!args[i+1]||seen.has(k))throw Error('INVALID_ARGUMENTS');seen.add(k);o[k]=args[i+1];}
  if(!o.configFile||!o.readerFile)throw Error('CONFIG_REQUIRED');return o;
}
export function installProductionSignals(app){
  const handler=()=>{app.stop().catch(()=>{process.exitCode=1;});};
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,handler);
}
export async function main(args){
  const app=await startProduction(await productionSettings(productionArguments(args)));
  installProductionSignals(app);
  console.log('ATLAS_WEB_READY (loopback, PostgreSQL reader, public allowlist)');return app;
}
if(isCLIEntrypoint(import.meta.url)){
  try{await main(process.argv.slice(2));}catch{console.error('ATLAS_WEB_START_FAILED: configuration or reader unavailable; details omitted.');process.exitCode=1;}
}
