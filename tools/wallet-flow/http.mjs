import {readFile} from 'node:fs/promises';
import {validateSnapshot} from '../../web/wallet-flow/model.mjs';
export async function flowSnapshotBytes({read=()=>readFile(new URL('../../web/wallet-flow/data.json',import.meta.url))}={}){
 const bytes=await read();if(bytes.length>2*1024*1024)throw Error('FLOW_READ_LIMIT');return Buffer.from(JSON.stringify(validateSnapshot(JSON.parse(bytes.toString('utf8')))));
}
export const flowAssets=['index.html','app.mjs','model.mjs','findings.mjs','profiles.mjs','style.css'];
