import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,writeFile,symlink,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {gzipSync} from 'node:zlib';import {archiveCompressedSources,readCompressedSource} from '../tools/history-archive.mjs';import {hashHistory} from '../tools/supply-history-source.mjs';
test('compressed source archive preserves original hash/bytes, is idempotent and private, and rejects collisions, links and corrupt data',async()=>{
 const root=await mkdtemp(join(tmpdir(),'atlas-history-gzip-'));try{
  const bytes=Buffer.from('{"circulating":"900719925474099300000.123456789"}\n'.repeat(50000)),hash=hashHistory(bytes),path=join(root,hash.slice(0,2),hash+'.json.gz');await archiveCompressedSources([{hash,bytes}],root);const initial=await readFile(path);await archiveCompressedSources([{hash,bytes}],root);assert.deepEqual(await readFile(path),initial);assert.deepEqual(await readCompressedSource(root,hash),bytes);assert.ok((await stat(path)).size<bytes.length/10);assert.equal((await stat(path)).mode&0o077,0);
  await assert.rejects(archiveCompressedSources([{hash:'0'.repeat(64),bytes}],root));await writeFile(path,gzipSync(Buffer.from('other')),{mode:0o600});await assert.rejects(readCompressedSource(root,hash),/HISTORY_ARCHIVE_INVALID/);await assert.rejects(archiveCompressedSources([{hash,bytes}],root),/HISTORY_ARCHIVE_INVALID/);
  await rm(path);await symlink(join(root,'other'),path);await assert.rejects(archiveCompressedSources([{hash,bytes}],root),/HISTORY_ARCHIVE_INVALID/);await assert.rejects(readCompressedSource(root,'../x'));
 }finally{await rm(root,{recursive:true,force:true});}
});
