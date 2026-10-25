import {lstat,open,constants} from 'node:fs/promises';
import {isAbsolute,normalize} from 'node:path';

const denied=()=>{throw Error('READER_FILE_PRIVATE_REQUIRED');};
function filePolicy(file,credential,uid){
  if(!file.isFile()||file.isSymbolicLink())denied();
  const mode=file.mode&0o7777;
  if(credential){
    if(!((file.uid===0&&[0o400,0o440].includes(mode))||(file.uid===uid&&[0o400,0o600].includes(mode))))denied();
  }else if((mode&0o077)!==0||file.uid!==uid)denied();
}
function sameFile(a,b){
  return ['dev','ino','uid','gid','mode','size','mtimeMs','ctimeMs'].every(k=>a[k]===b[k]);
}

// OS dependencies are injectable solely for modeled Linux metadata tests on macOS.
export async function readProductionReader(readerFile,{
  credentialsDirectory=process.env.CREDENTIALS_DIRECTORY,uid=process.getuid?.(),
  lstatFile=lstat,openFile=open,
}={}){
  try{
    const credential=credentialsDirectory!==undefined;
    if(credential){
      // This application supports system services, not user-manager credentials.
      if(typeof credentialsDirectory!=='string'||!/^\/run\/credentials\/[^/]+$/.test(credentialsDirectory)||
        normalize(credentialsDirectory)!==credentialsDirectory||!isAbsolute(readerFile)||
        readerFile!==credentialsDirectory+'/reader.env')denied();
      for(const path of ['/','/run','/run/credentials',credentialsDirectory]){
        const dir=await lstatFile(path),unit=path===credentialsDirectory;
        if(!dir.isDirectory()||dir.isSymbolicLink()||(dir.mode&0o7022)!==0)denied();
        if(unit){
          // Root's group r/x bits can represent systemd's service-user ACL mask.
          if(![0,uid].includes(dir.uid)||(dir.mode&0o007)!==0||(dir.mode&0o500)!==0o500||
            (dir.uid!==0&&(dir.mode&0o077)!==0))denied();
        }else if(dir.uid!==0)denied();
      }
    }
    const before=await lstatFile(readerFile);filePolicy(before,credential,uid);
    const handle=await openFile(readerFile,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    try{
      const file=await handle.stat();filePolicy(file,credential,uid);
      if(!sameFile(before,file)||file.size>65536)denied();
      const bytes=Buffer.alloc(file.size+1);let used=0;
      while(used<bytes.length){const {bytesRead}=await handle.read(bytes,used,bytes.length-used,null);if(!bytesRead)break;used+=bytesRead;}
      if(used!==file.size||!sameFile(file,await handle.stat()))denied();
      return bytes.subarray(0,used).toString('utf8');
    }finally{await handle.close();}
  }catch{denied();} // Never propagate paths, OS errors or credential contents.
}
