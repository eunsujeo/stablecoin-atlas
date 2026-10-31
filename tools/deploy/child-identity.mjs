import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {requireThat} from './files.mjs';
const exec=promisify(execFile);
// libuv clears supplementary groups and sets the primary GID/UID before exec.
// Avoid PAM/session helpers inside the broker's existing capability sandbox.
export function checkedIdentity(uid,gid){requireThat([uid,gid].every(n=>Number.isSafeInteger(n)&&n>0),'CHILD_IDENTITY_INVALID');return {uid,gid};}
export async function childIdentity(user){
 requireThat(['atlasbuild','atlasweb','atlascollector'].includes(user),'CHILD_USER_INVALID');
 const values=[];for(const flag of ['-u','-g']){const {stdout}=await exec('/usr/bin/id',[flag,user],{timeout:5000,maxBuffer:64});requireThat(/^[0-9]+\n?$/.test(stdout),'CHILD_IDENTITY_INVALID');values.push(Number(stdout.trim()));}
 return checkedIdentity(...values);
}
