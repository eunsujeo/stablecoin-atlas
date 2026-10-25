import test from 'node:test';
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {mkdtemp,writeFile,chmod,symlink,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readProductionReader} from '../tools/production-reader-file.mjs';
import {productionSettings} from '../tools/production-web.mjs';

const directory='/run/credentials/atlas-web.service',path=directory+'/reader.env',uid=981;
const contents='DATABASE_URL=postgresql://reader:SECRET_CANARY@database.invalid/db?sslmode=verify-full\n';
const metadata=(mode,owner=0,type='file')=>({mode,uid:owner,gid:0,dev:1,ino:2,size:Buffer.byteLength(contents),mtimeMs:1,ctimeMs:1,
  isFile:()=>type==='file',isDirectory:()=>type==='directory',isSymbolicLink:()=>type==='symlink'});
function modeled({file=metadata(0o440),directories={},opened=file,after=opened,openError,readError}={}){
  let opens=0,closes=0,stats=0,offset=0;
  return {counts:()=>({opens,closes}),options:{credentialsDirectory:directory,uid,
    lstatFile:async p=>p===path?file:(directories[p]??metadata(p===directory?0o510:0o755,0,'directory')),
    openFile:async(p,flags)=>{
      opens++;assert.equal(p,path);assert.equal(flags,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
      if(openError)throw openError;
      return {stat:async()=>stats++===0?opened:after,close:async()=>{closes++;},read:async(buffer,start,length)=>{
        if(readError)throw readError;
        const bytes=Buffer.from(contents),bytesRead=Math.min(length,bytes.length-offset);
        bytes.copy(buffer,start,offset,offset+bytesRead);offset+=bytesRead;return {bytesRead};
      }};
    },
  }};
}
const privateError=e=>e.message==='READER_FILE_PRIVATE_REQUIRED'&&!e.message.includes('SECRET_CANARY');

test('modeled systemd metadata accepts root 0400/0440 and service 0400/0600, including root ACL directory mask',async()=>{
  for(const [owner,mode] of [[0,0o400],[0,0o440],[uid,0o400],[uid,0o600]]){
    for(const [dirOwner,dirMode] of [[0,0o500],[0,0o510],[0,0o550],[uid,0o700],[uid,0o500]]){
      const fixture=modeled({file:metadata(mode,owner),directories:{[directory]:metadata(dirMode,dirOwner,'directory')}});
      assert.equal(await readProductionReader(path,fixture.options),contents);
      assert.deepEqual(fixture.counts(),{opens:1,closes:1});
    }
  }
});
test('modeled credentials reject untrusted owners, excessive/special permissions and nonregular files before opening',async()=>{
  for(const file of [metadata(0o440,982),metadata(0o600),metadata(0o640),metadata(0o444),metadata(0o460),metadata(0o450),
    metadata(0o444,uid),metadata(0o440,uid),metadata(0o6000|0o440),metadata(0o1440),metadata(0o440,0,'directory'),metadata(0o440,0,'symlink')]){
    const fixture=modeled({file});await assert.rejects(readProductionReader(path,fixture.options),privateError);
    assert.deepEqual(fixture.counts(),{opens:0,closes:0});
  }
});
test('credentials directory cannot select external, relative, nested, traversal, prefix sibling or symlink paths',async()=>{
  for(const [selected,file] of [['/tmp/credentials',path],['run/credentials/atlas-web.service',path],['',path],
    ['/run/credentials/..',path],['/run/credentials/atlas-web.service/',path],['/run/credentials/a/b',path],
    [directory,'/etc/atlas-web/reader.env'],[directory,directory+'/nested/reader.env'],[directory,directory+'/../reader.env'],
    [directory,directory+'-other/reader.env'],[directory,directory+'/other.env'],[directory,'reader.env']]){
    const fixture=modeled();await assert.rejects(readProductionReader(file,{...fixture.options,credentialsDirectory:selected}),privateError);
    assert.equal(fixture.counts().opens,0);
  }
  for(const p of ['/','/run','/run/credentials',directory]){
    for(const dir of [metadata(0o755,0,'symlink'),metadata(0o777,0,'directory'),metadata(0o755,982,'directory'),metadata(0o755,0,'file')]){
      const fixture=modeled({directories:{[p]:dir}});await assert.rejects(readProductionReader(path,fixture.options),privateError);
      assert.equal(fixture.counts().opens,0);
    }
  }
  for(const dir of [metadata(0o555,0,'directory'),metadata(0o750,uid,'directory'),metadata(0o410,0,'directory')]){
    const fixture=modeled({directories:{[directory]:dir}});await assert.rejects(readProductionReader(path,fixture.options),privateError);
  }
});
test('reader validates opened descriptor identity, permissions, size and post-read stability, and closes on errors',async()=>{
  for(const change of [{ino:3},{dev:3},{uid:982},{mode:0o444},{size:65537},{mtimeMs:2},{ctimeMs:2}]){
    const fixture=modeled({opened:{...metadata(0o440),...change}});
    await assert.rejects(readProductionReader(path,fixture.options),privateError);assert.equal(fixture.counts().closes,1);
  }
  for(const options of [{file:{...metadata(0o440),size:65537}},
    {file:{...metadata(0o440),size:1}},{file:{...metadata(0o440),size:Buffer.byteLength(contents)+1}},
    {after:{...metadata(0o440),ino:9}},{readError:Error(contents)}]){
    const fixture=modeled(options);await assert.rejects(readProductionReader(path,fixture.options),privateError);assert.equal(fixture.counts().closes,1);
  }
  const unreadable=modeled({openError:Error(contents)});
  await assert.rejects(readProductionReader(path,unreadable.options),privateError);assert.equal(unreadable.counts().closes,0);
});
test('actual local files retain owner-only private policy, reject links, open permissions and oversize, and settings fail closed',async()=>{
  const root=await mkdtemp(join(tmpdir(),'atlas-reader-credential-'));
  const previous=process.env.CREDENTIALS_DIRECTORY,previousTLS=process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  try{
    delete process.env.CREDENTIALS_DIRECTORY;
    const readerFile=join(root,'reader.env'),configFile=join(root,'web.json'),revisionFile=join(root,'REVISION');
    await writeFile(readerFile,contents,{mode:0o600});
    await writeFile(configFile,JSON.stringify({hosts:['atlas.example.com'],port:4173,fxFile:'/tmp/fx.json'}));await writeFile(revisionFile,'a'.repeat(40));
    const settings={readerFile,configFile,revisionFile};
    for(const mode of [0o600,0o400]){
      await chmod(readerFile,mode);assert.equal(await readProductionReader(readerFile),contents);
      assert.equal((await productionSettings(settings)).commit,'a'.repeat(40));
    }
    for(const mode of [0o440,0o640,0o644,0o660,0o666]){
      await chmod(readerFile,mode);await assert.rejects(productionSettings(settings),privateError);
    }
    await chmod(readerFile,0o600);await symlink(readerFile,join(root,'link.env'));
    await assert.rejects(readProductionReader(join(root,'link.env')),privateError);
    await mkdir(join(root,'dir.env'));await assert.rejects(readProductionReader(join(root,'dir.env')),privateError);
    process.env.CREDENTIALS_DIRECTORY=root;await assert.rejects(productionSettings(settings),privateError);
    process.env.CREDENTIALS_DIRECTORY=directory;await assert.rejects(productionSettings(settings),privateError);
    delete process.env.CREDENTIALS_DIRECTORY;
    await writeFile(readerFile,contents+'ARKM_API_KEY=SECRET_CANARY\n');
    await assert.rejects(productionSettings(settings),e=>e.message==='READER_CONFIG_INVALID');
    await writeFile(readerFile,contents);process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
    await assert.rejects(productionSettings(settings),e=>e.message==='RUNTIME_UNSUPPORTED');
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    await writeFile(readerFile,'x'.repeat(65537));await assert.rejects(productionSettings(settings),privateError);
    await assert.rejects(readProductionReader(join(root,'missing')),privateError);
  }finally{
    if(previous===undefined)delete process.env.CREDENTIALS_DIRECTORY;else process.env.CREDENTIALS_DIRECTORY=previous;
    if(previousTLS===undefined)delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;else process.env.NODE_TLS_REJECT_UNAUTHORIZED=previousTLS;
    await rm(root,{recursive:true,force:true});
  }
});
