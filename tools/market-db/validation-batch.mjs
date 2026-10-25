import {fail} from './plan.mjs';

const prefetch=Symbol('snapshot validation prefetch');
const key=(sql,values=[])=>JSON.stringify([sql,values]);
const exactJson=value=>{
  if(typeof value==='number')return Number.isSafeInteger(value);
  if(Array.isArray(value))return value.every(exactJson);
  if(value&&typeof value==='object')return Object.values(value).every(exactJson);
  return value===null||typeof value==='string'||typeof value==='boolean';
};

// Only a market snapshot receives this short-lived facade. No permission result
// survives the operation, and the underlying client/transaction stays exclusive.
export async function withValidationBatch(client,operation,enabled=true){
  if(!enabled)return operation(client);
  const pending=new Map();let active=true;
  const scoped={
    async [prefetch](statements,values=[]){
      if(!active)fail('VALIDATION_BATCH_CLOSED');
      if(!Array.isArray(values)||values.some(value=>typeof value!=='string')||!statements.length||statements.length>16||
        statements.some(sql=>! /^(SELECT|WITH)\b/.test(sql)||sql.includes(';')||[...sql.matchAll(/\$(\d+)\b/g)].some(m=>Number(m[1])<1||Number(m[1])>values.length)))fail('VALIDATION_BATCH_INVALID');
      // Fixed internal SELECTs share the same bind positions. Values are never
      // interpolated; amounts and arbitrary pg types must use the normal reader.
      const sql='SELECT '+statements.map((statement,i)=>`(SELECT coalesce(json_agg(validation_row),'[]'::json) FROM (${statement}) validation_row) AS q${i}`).join(',\n');
      const {rows:[result]}=await client.query(sql,values);
      for(const [i,statement]of statements.entries()){
        const rows=result?.['q'+i];if(!Array.isArray(rows))fail('VALIDATION_BATCH_INVALID');
        if(!exactJson(rows))fail('VALIDATION_BATCH_TYPE_UNSAFE');
        const id=key(statement,values);if(pending.has(id))fail('VALIDATION_BATCH_INVALID');
        pending.set(id,{rows,rowCount:rows.length});
      }
    },
    query(sql,values){
      if(!active)return Promise.reject(Error('VALIDATION_BATCH_CLOSED'));
      const id=key(sql,values),result=pending.get(id);
      if(result){pending.delete(id);return Promise.resolve(result);}
      return client.query(sql,values);
    }
  };
  try{
    const result=await operation(scoped);
    if(pending.size)fail('VALIDATION_BATCH_UNCONSUMED');
    return result;
  }finally{active=false;pending.clear();}
}

// A no-op for every existing writer/collector/standalone read path. Validators
// still consume and check each individual result in their original order.
export async function prefetchValidation(client,statements,values){
  await client[prefetch]?.(statements,values);
}
