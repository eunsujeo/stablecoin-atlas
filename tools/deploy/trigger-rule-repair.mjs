import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {verifyInstallation} from './system.mjs';
import {checkTriggerRule,triggerRulePath} from './trigger-rule.mjs';
import {hash,requireThat,json} from './files.mjs';
// Explicit root migration of a public deployment-owned rule, never a secret or arbitrary path.
export async function repairInstalledTriggerRule(args){
 requireThat(!args.length&&process.platform==='linux'&&process.arch==='arm64'&&process.getuid()===0,'TRIGGER_REPAIR_CONTEXT');
 await verifyInstallation();const receipt=await json('/etc/atlas-deploy/control-plane.json');
 const expected=receipt.units[triggerRulePath];requireThat(expected===hash(await readFile(new URL('../../deploy/atlas-deploy.rules',import.meta.url))),'TRIGGER_RULE_SOURCE_MISMATCH');
 return checkTriggerRule({repair:true,expectedHash:expected});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await repairInstalledTriggerRule(process.argv.slice(2))));}catch(e){console.error(/^[A-Z_]{1,64}$/.test(e.message)?e.message:'TRIGGER_REPAIR_FAILED');process.exitCode=1;}}
