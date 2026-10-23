import {connectDatabase} from './connection.mjs';
import {readSurvey} from './survey.mjs';
import {validateStoredSurvey} from '../../web/survey-model.js';
export function databaseSurveyReader({env,connect=connectDatabase,read=readSurvey,now=Date.now}={}){
 let pending,cache,failed=false,expires=0;
 return ()=>{
  if(expires>now())return failed?Promise.reject(Error('SURVEY_UNAVAILABLE')):Promise.resolve(cache);
  if(pending)return pending;
  pending=(async()=>{let c;try{
   c=await connect(env);const raw=await read(c);if(Buffer.byteLength(JSON.stringify(raw))>128*1024)throw Error('READ_LIMIT');
   cache=validateStoredSurvey(raw);failed=false;return cache;
  }catch{failed=true;throw Error('SURVEY_UNAVAILABLE');}finally{await c?.end().catch(()=>{});expires=now()+10000;}})();
  pending.finally(()=>{pending=null;}).catch(()=>{});return pending;
 };
}
