import test from 'node:test';
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {mkdtemp,writeFile,readFile,lstat,symlink,open,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {destinations,verifyConfiguredFile} from '../tools/deploy/config.mjs';
import {hash} from '../tools/deploy/files.mjs';

const collector=42001,other=42002;
const metadata=(type,uid,mode,ino,size=0)=>({uid,mode,ino,dev:1,size,isFile:()=>type==='file',isDirectory:()=>type==='directory',isSymbolicLink:()=>type==='symlink'});
function fixture(id='schedule'){
 const path=destinations[id],parent=dirname(path),bytes=Buffer.from('APPROVED_SCHEDULE_FIXTURE\n');
 const spec={owner:'root',mode:id==='schedule'?0o644:0o600,sha256:hash(bytes)};
 const nodes=new Map([[path,metadata('file',0,0o100000|spec.mode,4,bytes.length)],[parent,metadata('directory',collector,0o40700,3)],['/etc',metadata('directory',0,0o40755,2)],['/',metadata('directory',0,0o40755,1)]]);
 const state={nodes,bytes,opens:0,closes:0,pathReads:0,uids:[],afterRead:null,handleStat:null};
 const options={
  uidFor:async name=>{state.uids.push(name);if(name==='root')return 0;if(name==='atlascollector')return collector;throw Error('USER_INVALID');},
  stat:async name=>{assert(nodes.has(name),'Unexpected path');return {...nodes.get(name)};},
  read:async name=>{assert.equal(name,path);state.pathReads++;return state.bytes;},
  openFile:async(name,flags)=>{
   assert.equal(name,path);assert.equal(flags,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);state.opens++;
   const pinned={...nodes.get(path)},contents=Buffer.from(state.bytes);
   return {stat:async()=>state.handleStat?.(pinned)??pinned,read:async(buffer,offset,length,position)=>{
    const size=Math.max(0,Math.min(length,contents.length-position));contents.copy(buffer,offset,position,position+size);state.afterRead?.();return {bytesRead:size};
   },close:async()=>{state.closes++;}};
  }
 };
 return {id,path,parent,spec,state,options,run:()=>verifyConfiguredFile(id,spec,options)};
}

test('root0644 schedule under the exact collector0700 parent is READY without ownership or mode changes',async()=>{
 const f=fixture(),before=JSON.stringify([...f.state.nodes]);
 assert.deepEqual(await f.run(),{id:'schedule',state:'READY'});assert.equal(JSON.stringify([...f.state.nodes]),before);
 assert.equal(f.state.opens,1);assert.equal(f.state.closes,1);assert.equal(f.state.pathReads,0);assert.deepEqual(f.state.uids,['root','atlascollector']);
 // The former rule rejects this precise configuration: the root file supplied uid0 for both entries.
 assert.equal([0,0].includes(f.state.nodes.get(f.parent).uid),false);
});

test('existing root-owned parents and collector-owned file/parent pairs keep their previous behavior',async()=>{
 const root=fixture();root.state.nodes.get(root.parent).uid=0;assert.equal((await root.run()).state,'READY');assert.equal(root.state.opens,0);assert.deepEqual(root.state.uids,['root']);
 const owned=fixture();owned.spec.owner='atlascollector';owned.state.nodes.get(owned.path).uid=collector;assert.equal((await owned.run()).state,'READY');assert.equal(owned.state.opens,0);
});

test('the schedule parent rejects symlinks, non-directories, arbitrary owners and every mode outside0700',async()=>{
 for(const patch of [{uid:other},...[0o770,0o707,0o702,0o720,0o777,0o750,0o755,0o4700].map(mode=>({mode:0o40000|mode})),{isSymbolicLink:()=>true},{isDirectory:()=>false}]){
  const f=fixture();Object.assign(f.state.nodes.get(f.parent),patch);await assert.rejects(f.run(),/CONFIGURED_PARENT_UNSAFE/);assert.equal(f.state.opens,0);assert.equal(f.state.pathReads,0);
 }
});

test('file symlink, wrong owner, group/other writes, special bits, size and hash mismatches remain rejected',async()=>{
 for(const patch of [{uid:collector},{uid:other},{isSymbolicLink:()=>true},{isFile:()=>false},...[0o664,0o646,0o666,0o4644].map(mode=>({mode:0o100000|mode})),{size:2097153}]){
  const f=fixture();Object.assign(f.state.nodes.get(f.path),patch);await assert.rejects(f.run(),/CONFIGURED_FILE_UNSAFE/);assert.equal(f.state.opens,0);
 }
 const hashMismatch=fixture();hashMismatch.spec.sha256='0'.repeat(64);await assert.rejects(hashMismatch.run(),/CONFIGURED_FILE_HASH/);assert.equal(hashMismatch.state.closes,1);
 const privateMode=fixture();privateMode.spec.mode=0o600;privateMode.state.nodes.get(privateMode.path).mode=0o100600;await assert.rejects(privateMode.run(),/CONFIGURED_PARENT_UNSAFE/);
});

test('collector parent exception never extends to another configured file or a higher ancestor',async()=>{
 for(const id of Object.keys(destinations).filter(id=>id!=='schedule')){
  const f=fixture(id);await assert.rejects(f.run(),/CONFIGURED_PARENT_UNSAFE/);assert.equal(f.state.opens,0);assert.deepEqual(f.state.uids,['root']);
 }
 for(const ancestor of ['/etc','/'])for(const patch of [{uid:collector},{uid:other},{mode:0o40777},{isSymbolicLink:()=>true},{isDirectory:()=>false}]){
  const f=fixture();Object.assign(f.state.nodes.get(ancestor),patch);await assert.rejects(f.run(),/CONFIGURED_PARENT_UNSAFE/);assert.equal(f.state.opens,0);
 }
 const original=destinations.schedule;
 try{destinations.schedule='/etc/atlas-collector/other.env';const f=fixture();await assert.rejects(f.run(),/CONFIGURED_PARENT_UNSAFE/);assert.deepEqual(f.state.uids,['root']);}
 finally{destinations.schedule=original;}
});

test('missing or invalid collector UID never creates a root-file parent exception',async()=>{
 for(const uid of [undefined,0,-1,other,1.5]){
  const f=fixture();f.options.uidFor=async name=>name==='root'?0:uid;await assert.rejects(f.run(),/CONFIGURED_PARENT_UNSAFE/);assert.equal(f.state.opens,0);
 }
 const f=fixture();f.options.uidFor=async name=>{if(name==='root')return 0;throw Error('USER_MISSING');};await assert.rejects(f.run(),/USER_MISSING/);assert.equal(f.state.opens,0);
});

test('opened schedule must retain the original inode, root owner, exact mode and bounded bytes',async()=>{
 for(const patch of [{ino:999},{dev:999},{uid:collector},{mode:0o100666},{size:2097153},{size:1},{isFile:()=>false}]){
  const f=fixture();f.state.handleStat=pinned=>({...pinned,...patch});await assert.rejects(f.run(),/CONFIGURED_FILE_UNSAFE/);assert.equal(f.state.closes,1);assert.equal(f.state.pathReads,0);
 }
 const short=fixture();short.state.bytes=Buffer.from('short');await assert.rejects(short.run(),/CONFIGURED_FILE_UNSAFE/);assert.equal(short.state.closes,1);
 const growth=fixture();growth.state.bytes=Buffer.alloc(growth.state.bytes.length+8);await assert.rejects(growth.run(),/CONFIGURED_FILE_UNSAFE/);assert.equal(growth.state.closes,1);
});

test('file and parent replacement or permission drift during the read is rejected and the handle closes',async()=>{
 for(const patch of [{ino:999},{uid:collector},{mode:0o100666},{isSymbolicLink:()=>true}]){
  const f=fixture();f.state.afterRead=()=>Object.assign(f.state.nodes.get(f.path),patch);await assert.rejects(f.run(),/CONFIGURED_FILE_UNSAFE/);assert.equal(f.state.closes,1);
 }
 for(const patch of [{ino:999},{uid:other},{mode:0o40770},{isSymbolicLink:()=>true},{isDirectory:()=>false}]){
  const f=fixture();f.state.afterRead=()=>Object.assign(f.state.nodes.get(f.parent),patch);await assert.rejects(f.run(),/CONFIGURED_PARENT_UNSAFE/);assert.equal(f.state.closes,1);
 }
 for(const patch of [{uid:collector},{mode:0o100666},{size:1},{ino:999}]){
  const f=fixture();let calls=0;f.state.handleStat=pinned=>++calls===1?pinned:{...pinned,...patch};await assert.rejects(f.run(),/CONFIGURED_FILE_UNSAFE/);assert.equal(f.state.closes,1);
 }
 const readError=fixture();readError.state.afterRead=()=>{throw Error('READ_FAILED');};await assert.rejects(readError.run(),/READ_FAILED/);assert.equal(readError.state.closes,1);
 const error=fixture();error.options.openFile=async()=>{throw Error('ELOOP');};await assert.rejects(error.run(),/ELOOP/);assert.equal(error.state.pathReads,0);
});

test('real isolated file reads preserve bytes/mode and a swapped symlink fails O_NOFOLLOW before reading its target',async t=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-schedule-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const path=join(root,'schedule.env'),target=join(root,'target.env'),link=join(root,'link.env');
 const f=fixture();await writeFile(path,f.state.bytes,{mode:0o644});await writeFile(target,'PRIVATE_TARGET_FIXTURE',{mode:0o600});await symlink(target,link);
 const before=await lstat(path);
 let closed=0;
 f.options.openFile=async(_name,flags)=>{const file=await open(path,flags);return {stat:async()=>f.state.nodes.get(f.path),read:(...args)=>file.read(...args),close:async()=>{closed++;await file.close();}};};
 assert.equal((await f.run()).state,'READY');assert.equal(closed,1);
 const after=await lstat(path);assert.equal(after.uid,before.uid);assert.equal(after.gid,before.gid);assert.equal(after.mode,before.mode);assert.deepEqual(await readFile(path),f.state.bytes);
 f.options.openFile=async(_name,flags)=>open(link,flags);await assert.rejects(f.run(),e=>e.code==='ELOOP');
});
