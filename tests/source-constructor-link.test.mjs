import {readFile} from 'node:fs/promises';
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {initialLogicFromMetadata,verifyConstructorParent} from '../tools/research/source-constructor-link.mjs';
const word=n=>BigInt(n).toString(16).padStart(64,'0');
function fixture(multi=false){
 const inputs=multi?[{name:'_logic',type:'address'},{name:'admin_',type:'address'},{name:'_data',type:'bytes'}]:[{name:'implementationContract',type:'address'}];
 const base={chainId:'8453',address:'0x'+'a'.repeat(40),matchId:'123',compilation:{name:'FiatTokenProxy'},abi:[{type:'constructor',inputs}]};const bytes=Buffer.from(JSON.stringify(base));
 const target={chainId:'8453',address:base.address,expectedMatchId:'123',expectedContractName:'FiatTokenProxy',expectedConstructorFirstName:inputs[0].name,parentSourceHash:createHash('sha256').update(bytes).digest('hex')};
 const args=word(1)+(multi?word(2)+word(96)+word(0):'');return {data:{...base,creationBytecode:{transformationValues:{constructorArguments:'0x'+args}}},target,bytes};
}
test('indexed constructor association decodes initial logic while retaining current binding uncertainty',()=>{const f=fixture();const out=initialLogicFromMetadata(f.data,f.target,f.bytes);assert.equal(out.address,'0x'+'0'.repeat(39)+'1');assert.equal(out.currentImplementationBinding,'NOT_ESTABLISHED');assert.equal(out.relation,'INDEXED_CONSTRUCTOR_INITIAL_LOGIC_ONLY');});
test('missing creation data remains unlinked rather than guessed',()=>{const f=fixture();delete f.data.creationBytecode;assert.equal(initialLogicFromMetadata(f.data,f.target,f.bytes),null);});
test('parent byte corruption and parent/meta ABI changes cannot produce a candidate',()=>{
 const f=fixture();assert.throws(()=>verifyConstructorParent(Buffer.from('changed'),f.target));
 const g=fixture();g.data.abi=[{type:'constructor',inputs:[{name:'implementationContract',type:'address'},{name:'admin',type:'address'}]}];assert.throws(()=>initialLogicFromMetadata(g.data,g.target,g.bytes));
});
test('wrong identity, match, name or argument role is rejected',()=>{
 for(const patch of [{chainId:'1'},{address:'0x'+'b'.repeat(40)},{matchId:'999'},{compilation:{name:'Other'}},{abi:[{type:'constructor',inputs:[{name:'admin',type:'address'}]}]}]){const f=fixture();assert.throws(()=>initialLogicFromMetadata({...f.data,...patch},f.target,f.bytes));}
});
test('complete multi-argument heads and bytes tails are checked without executing initializer data',()=>{const f=fixture(true);assert(initialLogicFromMetadata(f.data,f.target,f.bytes));for(const args of [word(1),word(1)+word(2)+word(32),word(1)+word(2)+word(1024)+word(0),word(1)+word(2)+word(96)+word(200)]){f.data.creationBytecode.transformationValues.constructorArguments='0x'+args;assert.throws(()=>initialLogicFromMetadata(f.data,f.target,f.bytes));}});
test('malformed addresses and noncanonical padding fail closed',()=>{for(const args of ['0x','0x01','0x'+'f'.repeat(64),'0x'+'0'.repeat(64)]){const f=fixture();f.data.creationBytecode.transformationValues.constructorArguments=args;assert.throws(()=>initialLogicFromMetadata(f.data,f.target,f.bytes));}});

test('corrected provider lookup uses only one level field selection and never requests proxy resolution',async()=>{
 const p=JSON.parse(await readFile(new URL('../data/source-review-top10-constructor-corrected-plan.json',import.meta.url),'utf8'));
 assert.equal(p.targets.length,9);for(const t of p.targets){const fields=new URL(t.url).searchParams.get('fields').split(',');assert(fields.every(f=>f.split('.').length<=2));assert(fields.includes('creationBytecode.transformationValues'));assert(!fields.includes('all'));assert(!fields.includes('proxyResolution'));}
});
