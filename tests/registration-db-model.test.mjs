import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFilter} from '../tools/market-db/registration.mjs';
import {registrationDatabaseArguments,main} from '../tools/market-db/registration-cli.mjs';
const filter={selectionId:'a'.repeat(64),coinId:'jpyc',metric:'NETWORK_CIRCULATING',from:'2025-10-22',to:'2026-10-22'};
test('registration database requires bounded coin/quantity metric/date/selection filters',()=>{
 assert.deepEqual(registrationFilter(filter),filter);
 for(const change of [{selectionId:'bad'},{coinId:"jpyc'; SELECT 1"},{metric:'NETWORK_CIRCULATING_VALUE'},{from:'2025-10-21'},{to:'2026-02-30'},{to:'2025-01-01'},{sourceId:'bad'},{limit:100000}])assert.throws(()=>registrationFilter({...filter,...change}),/REGISTRATION_DB_FILTER_INVALID/);
});
test('registration database CLI rejects activation, HTTP collection, credentials and unbounded reads before connecting',async()=>{
 assert.equal(registrationDatabaseArguments(['init']).command,'init');
 for(const args of [['collect'],['init','--activate','true'],['read'],['init','--api-key','private'],['init','--env-file','a','--env-file','b']])await assert.rejects(main(args,{}),/INVALID_COMMAND|INVALID_ARGUMENTS|MISSING_ARGUMENT/);
 const args=['read','--selection',filter.selectionId,'--coin','jpyc','--metric',filter.metric,'--from',filter.from,'--to',filter.to];
 assert.deepEqual(registrationDatabaseArguments(args).filter,filter);
 await assert.rejects(main([...args,'--source-id','wrong'],{}),/REGISTRATION_DB_FILTER_INVALID/);
});
