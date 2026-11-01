import {knowledgeFiles} from '../../tools/knowledge-assets.mjs';
import http from 'node:http';import {readFile} from 'node:fs/promises';
const port=Number(process.env.KNOWLEDGE_PORT??54874);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('INVALID_PORT');
const files=new Set(knowledgeFiles);
const server=http.createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)||req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403).end();return;}
 const path=req.url==='/'?'index.html':req.url.replace(/^\/knowledge\//,'').replace(/^\//,'');if(path!=='pop-outline.css'&&!files.has(path)){res.writeHead(404).end();return;}
 try{const body=await readFile(new URL(path==='pop-outline.css'?'../../web/pop-outline.css':'../../web/knowledge/'+path,import.meta.url));res.writeHead(200,{'Content-Type':path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; connect-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(404).end();}
});server.listen(port,'127.0.0.1',()=>console.log(`Knowledge prototype http://127.0.0.1:${port}`));
