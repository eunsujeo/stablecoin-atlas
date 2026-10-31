import {mkdtemp,mkdir,writeFile,lstat,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {bootstrapLayout} from '../tools/deploy/bootstrap-install.mjs';
import {packEntries,releaseManifest,tarEntries} from '../tools/deploy/archive.mjs';
import {policyFiles,payloadPolicies} from '../tools/deploy/policy.mjs';
import {stageVerified} from '../tools/deploy/stage.mjs';
import {point} from '../tools/release-switch.mjs';
export const commit='b'.repeat(40),oldCommit='a'.repeat(40);
export function fixtureTrust(prefix){return async(path,{directory=false,privateFile=false,limit=262144}={})=>{
 if(path!==prefix&&!path.startsWith(prefix+'/'))throw Error('FIXTURE_PATH_ESCAPE');let current=path;
 for(;;){const s=await lstat(current);if(s.isSymbolicLink()||s.uid!==process.getuid()||(s.mode&0o022))throw Error('PATH_UNTRUSTED');if(current===path){if(directory?!s.isDirectory():!s.isFile()||s.size>limit||privateFile&&!!(s.mode&0o077))throw Error('FILE_UNTRUSTED');}if(current===prefix)break;current=dirname(current);}
 return path;
};}
export function testBundle({attempt=1,component='web'}={}){
 const entries=[{name:'REVISION',bytes:Buffer.from(commit+'\n')},...['package.json','package-lock.json','tools/production-web.mjs','node_modules/pg/package.json',...new Set(Object.values(policyFiles).flat())].map(name=>({name,bytes:Buffer.from('inert fixture')}))],payload=packEntries(entries);
 return {payload,manifest:releaseManifest(payload,{commit,component,runId:10,attempt,policies:payloadPolicies(tarEntries(payload))})};
}
export async function bootstrapFixture({receipt=false,install=true}={}){
 const prefix=await realpath(await mkdtemp(join(tmpdir(),'atlas-bootstrap-fixture-'))),layout=bootstrapLayout(prefix),trust=fixtureTrust(prefix);
 for(const dir of [join(layout.root,'releases'),layout.bin,layout.unitDir,layout.state,dirname(layout.config),dirname(layout.install)])await mkdir(dir,{recursive:true,mode:0o700});
 if(install){await mkdir(layout.install,{mode:0o700});await writeFile(join(layout.install,'old-control.mjs'),'OLD_CONTROL',{mode:0o644});}
 await writeFile(layout.config,'ORIGINAL_CONFIG',{mode:0o600});if(receipt)await writeFile(layout.receipt,'ORIGINAL_RECEIPT',{mode:0o600});
 await writeFile(join(layout.bin,'atlas-release'),'OLD_HELPER',{mode:0o755});await writeFile(join(layout.unitDir,'atlas-deploy-agent.service'),'SAME_UNIT',{mode:0o640});
 await mkdir(join(layout.root,'releases',oldCommit),{mode:0o700});await writeFile(join(layout.root,'releases',oldCommit,'REVISION'),oldCommit+'\n');
 for(const name of ['current','collector-current','usage-current'])await point(layout.root,name,oldCommit);
 const bundle=testBundle();await stageVerified(layout.root,commit,bundle);
 async function next(){const path=layout.install+'.next-'+randomUUID();await mkdir(path,{mode:0o700});await writeFile(join(path,'new-control.mjs'),'NEW_CONTROL',{mode:0o644});return path;}
 const files=[{path:join(layout.bin,'atlas-release'),bytes:Buffer.from('NEW_HELPER'),mode:0o755},{path:join(layout.bin,'atlas-deploy-admin'),bytes:Buffer.from('NEW_ADMIN'),mode:0o755},{path:join(layout.unitDir,'atlas-deploy-agent.service'),bytes:Buffer.from('SAME_UNIT'),mode:0o644},{path:join(layout.unitDir,'atlas-fx.service.d/90-atlas-deploy-barrier.conf'),bytes:Buffer.from('NEW_DROPIN'),mode:0o644},{path:layout.config,bytes:Buffer.from('NEW_CONFIG'),mode:0o600}];
 return {prefix,layout,trust,commit,bundle,next,files,receipt:{schemaVersion:1,commit,files:{'new-control.mjs':'fixture'},units:{}},options:async()=>({layout,trust,commit,next:await next(),files,receipt:{schemaVersion:1,commit,files:{'new-control.mjs':'fixture'},units:{}}})};
}
