import {readFile,lstat} from 'node:fs/promises';
import {join,posix} from 'node:path';
import {requireThat} from './files.mjs';

// Operational entrypoints use pg only. Keep entire installed dependency packages, including natives.
export const runtimeRoots=Object.freeze(['pg']);
// Reader verification hashes these local SQL originals; none are executed by packaging/smoke.
export const runtimeSchemaFiles=Object.freeze([
 ...['activity','allium-daily-lab','allium-supply','asset-review','catalog','contract-review','frankfurter-fx','fx','history','market','network-usage','registration','survey'].map(n=>'db/'+n+'/001-initial.sql'),
 'db/history/002-supply-metric.sql','db/history/003-periodic-normalized.sql','db/history/004-continuous-collection.sql','db/network-usage/002-expanded.sql','db/registration/002-daily-collection.sql','db/registration/003-coin-market.sql','db/scheduler/001-configurable-schedule.sql','db/survey/002-windowed-snapshots.sql',
]);
export function runtimeSource(name){
 if(['package.json','package-lock.json','LICENSE','.github/workflows/production.yml','docs/ui/mock-dashboard-data.json'].includes(name))return true;
 if(name.startsWith('deploy/')||name.startsWith('data/'))return true;
 if(name.startsWith('db/'))return name.endsWith('.sql');
 if(name.startsWith('web/'))return !/\.test\./.test(name);
 return name.startsWith('tools/')&&!/^tools\/(research|intelligent-router)\//.test(name)&&!/(?:browser-check|\.test\.)/.test(name)&&/\.(mjs|js|json|sql)$/.test(name);
}
export async function runtimePackageDirectories(root){
 const lock=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
 requireThat(lock.lockfileVersion>=2&&lock.packages,'BUILD_DEPENDENCY_LOCK');
 const selected=new Set();
 async function locate(name,from,optional){
  requireThat(/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name)&&!name.includes('..'),'BUILD_DEPENDENCY_NAME');
  let base=from;
  for(;;){
   const directory=posix.join(base,'node_modules',name);
   if(posix.basename(base)!=='node_modules'){
    try{const s=await lstat(join(root,directory));requireThat(s.isDirectory()&&!s.isSymbolicLink(),'BUILD_DEPENDENCY_UNSAFE');return directory;}
    catch(e){if(e.code!=='ENOENT')throw e;}
   }
   if(base==='.')break;base=posix.dirname(base);
  }
  requireThat(optional,'BUILD_DEPENDENCY_MISSING');return null;
 }
 async function visit(name,from='.',optional=false){
  const directory=await locate(name,from,optional);if(!directory||selected.has(directory))return;
  // Reject symlinked scopes/ancestors before reading package metadata.
  let ancestor=directory;while(ancestor!=='.'){const s=await lstat(join(root,ancestor));requireThat(s.isDirectory()&&!s.isSymbolicLink(),'BUILD_DEPENDENCY_UNSAFE');ancestor=posix.dirname(ancestor);}
  const file=join(root,directory,'package.json'),s=await lstat(file);requireThat(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'BUILD_DEPENDENCY_UNSAFE');
  const metadata=JSON.parse(await readFile(file,'utf8')),pin=lock.packages[directory];
  requireThat(pin&&!pin.dev&&!pin.link&&typeof pin.version==='string'&&pin.version===metadata.version&&metadata.name===name,'BUILD_DEPENDENCY_LOCK');selected.add(directory);
  const optionalNames=new Set(Object.keys(metadata.optionalDependencies??{}));
  for(const dependency of Object.keys(metadata.dependencies??{}))await visit(dependency,directory,optionalNames.has(dependency));
  for(const dependency of optionalNames)await visit(dependency,directory,true);
  for(const dependency of Object.keys(metadata.peerDependencies??{}))await visit(dependency,directory,metadata.peerDependenciesMeta?.[dependency]?.optional===true);
 }
 for(const name of runtimeRoots)await visit(name);
 return [...selected].sort();
}
