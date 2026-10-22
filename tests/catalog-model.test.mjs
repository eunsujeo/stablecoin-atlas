import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateTokenProfiles,officialProfileUrl} from '../web/token-profile-model.js';
import {validateMarket} from '../web/market-model.js';
import {main} from '../tools/market-db/catalog-cli.mjs';
const registry=JSON.parse(await readFile(new URL('../data/asset-registry.json',import.meta.url))),data=JSON.parse(await readFile(new URL('../data/token-profiles.json',import.meta.url)));
test('token profiles bind standards and exact reviewed identities per deployment and reject unsafe source URLs',()=>{
  assert.equal(validateTokenProfiles(data.profiles,registry).length,8);
  for(const change of [p=>p.identity.address='0x'+'1'.repeat(40),p=>p.standard='ERC-721',p=>p.revision=0,p=>p.reviewedAt='2026-02-30T00:00:00.000Z',p=>p.sources[0].url='javascript:alert(1)',p=>p.extra='unexpected']){
    const profiles=structuredClone(data.profiles);change(profiles[0]);assert.throws(()=>validateTokenProfiles(profiles,registry),/CATALOG_PROFILE_INVALID/);
  }
  assert.throws(()=>validateTokenProfiles([...data.profiles,data.profiles[0]],registry));
  for(const url of ['https://evil.invalid/','https://tether.to@evil.invalid/','https://tether.to:444/','https://tether.to/?secret=x','https://tether.to/#x','http://tether.to/'])assert.equal(officialProfileUrl(url),false);
  assert.equal(officialProfileUrl('https://tether.to/en/supported-protocols/'),true);
  assert.doesNotThrow(()=>validateMarket({schemaVersion:1,kind:'STORED_PROVIDER_OBSERVATIONS_NOT_ASSESSMENT',publishedAt:new Date().toISOString(),registry,observations:[],networks:[],omittedSupplyEntries:0,tokenProfiles:data.profiles}));
});
test('catalog CLI rejects missing and unrelated options before reading credentials or connecting',async()=>{
  for(const args of [[],['drop'],['grant'],['init','--role','postgres'],['grant','--role','x','--role','y'],['import','--file']])await assert.rejects(main(args,{}));
});
