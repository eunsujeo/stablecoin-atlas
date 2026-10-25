import {request} from 'node:http';
const hop=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade']);
// No DNS, redirect following, proxy lookup or caller-supplied destination host.
export function loopbackRequest({port,path='/',host,origin,timeout=15000,limit=2*1024*1024}={}){
  if(!Number.isInteger(port)||port<1||port>65535||typeof path!=='string'||!path.startsWith('/')||path.length>2048)throw Error('LOOPBACK_ARGUMENTS_INVALID');
  return new Promise((resolve,reject)=>{
    let response,done=false,size=0;const chunks=[];
    const fail=()=>{if(done)return;done=true;clearTimeout(timer);response?.destroy();req.destroy();reject(Error('LOOPBACK_HTTP_FAILED'));};
    const req=request({hostname:'127.0.0.1',port,path,method:'GET',agent:false,headers:{host:host??`127.0.0.1:${port}`,'accept-encoding':'identity',...(origin?{origin}:{})}},res=>{
      response=res;res.on('error',fail);res.on('aborted',fail);
      res.on('data',chunk=>{size+=chunk.length;if(size>limit){fail();return;}chunks.push(chunk);});
      res.on('end',()=>{
        if(done)return;
        if(res.headers['content-length']!==undefined&&Number(res.headers['content-length'])!==size){fail();return;}
        done=true;clearTimeout(timer);
        const blocked=new Set([...hop,...String(res.headers.connection??'').split(',').map(v=>v.trim().toLowerCase())]);
        const headers=[];for(let i=0;i<res.rawHeaders.length;i+=2)if(!blocked.has(res.rawHeaders[i].toLowerCase()))headers.push({name:res.rawHeaders[i],value:res.rawHeaders[i+1]});
        resolve({status:res.statusCode,headers,body:Buffer.concat(chunks)});
      });
    });
    const timer=setTimeout(fail,timeout);req.on('error',fail);req.end();
  });
}
