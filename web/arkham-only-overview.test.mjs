import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{productionDocument}from'../tools/production-policy.mjs';
test('overview contains no Allium panels or source selector and does not request archived Allium data',async()=>{
 const html=await readFile(new URL('./index.html',import.meta.url)),source=await readFile(new URL('./overview.js',import.meta.url),'utf8'),component=await readFile(new URL('./supply-overview.js',import.meta.url),'utf8');
 for(const text of [html.toString(),productionDocument(html).toString()]){assert(!text.includes('Allium'));for(const id of ['overview-survey','overview-geography','overview-reviewed-supply','overview-activity-rows'])assert(!text.includes('id="'+id+'"'));}
 for(const url of ['/survey-data.json','/geography-data.json','/activity-data.json','/reviewed-supply-data.json'])assert(!source.includes(url));
 assert(!component.includes('활동 자료 출처'));assert(!component.includes('ALLIUM'));assert(component.includes("usageSource='ARKHAM'"));assert(component.includes("buttons('전송 활동 지표'"));
});
