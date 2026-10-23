import {canonical,instant,epochMicros} from './market-db/plan.mjs';
import {dailyDay,dailyHash,dailyFail,hashValue,dailyPlan,validateSimulationAuthorization} from './allium-daily-plan.mjs';

// Finite offline experiment. No timer, provider client, activation flag or live executor.
export function simulationSchedule({organizationHash,days,utcMinute}={}){
 if(!hashValue(organizationHash)||!Array.isArray(days)||!days.length||days.length>31||
  days.some((d,i)=>!dailyDay(d)||(i>0&&d<=days[i-1]))||
  !Number.isInteger(utcMinute)||utcMinute<0||utcMinute>1425)dailyFail();
 const body={kind:'ALLIUM_FINITE_SCHEDULE_SIMULATION',organizationHash,days:[...days],utcMinute,
  windowMinutes:15,maxTicks:128,executionEnabled:false,providerRequests:0,scheduleWrites:0};
 return {...body,scheduleHash:dailyHash(body)};
}
function verify(schedule){
 const expected=simulationSchedule(schedule);
 if(canonical(schedule)!==canonical(expected))dailyFail();return expected;
}
function due(schedule,at,view){
 instant(at);
 if(view.kind!=='ALLIUM_DAILY_OFFLINE_SIMULATION'||view.executionEnabled!==false||view.providerRequests!==0||
  (view.lastEventAt&&epochMicros(at)<epochMicros(view.lastEventAt)))dailyFail();
 const day=at.slice(0,10);
 if(!schedule.days.includes(day))return 'UNLISTED_DAY';
 const elapsed=epochMicros(at)-epochMicros(day+'T00:00:00Z')-BigInt(schedule.utcMinute)*60000000n;
 if(elapsed<0n)return 'NOT_DUE';
 if(elapsed>=900000000n)return 'MISSED_WINDOW';
 if(view.usages.some(u=>u.day===day)||view.reservations.some(r=>r.day===day))return 'DAY_CONSUMED';
 if(view.reservations.some(r=>r.state!=='SUCCEEDED'))return 'PRIOR_INCOMPLETE';
 return 'DUE';
}
export function scheduleSimulation(ledger,input){
 const schedule=verify(structuredClone(input)),org=schedule.organizationHash;
 let busy=false,ticks=0,lastAt=null;
 return Object.freeze({async tick({authorization,usage,exchanges}={}){
  if(busy||ticks>=schedule.maxTicks)dailyFail();busy=true;ticks++;
  let claimed=false,result;
  const report=state=>({kind:schedule.kind,state,executionEnabled:false,providerRequests:0,scheduleWrites:0});
  try{
   const at=await ledger.simulationTime();
   if(lastAt&&epochMicros(at)<epochMicros(lastAt))dailyFail();lastAt=at;
   let state=due(schedule,at,await ledger.read(org));
   if(state!=='DUE')return report(state);
   const plan=dailyPlan({asOfDay:at.slice(0,10)});
   authorization=structuredClone(authorization);usage=structuredClone(usage);exchanges=structuredClone(exchanges);
   validateSimulationAuthorization(authorization,plan,at);
   if(authorization.organizationHash!==org||usage?.kind!=='ALLIUM_SIMULATED_USAGE'||usage.organizationHash!==org||
    !Array.isArray(exchanges)||exchanges.length<1||exchanges.length>26||exchanges.some(e=>!e||
     Object.keys(e).sort().join(',')!=='body,job,operation'||!['supply','volume'].includes(e.job)||
     !['create','run','status','result'].includes(e.operation)||
     (e.body!==null&&(typeof e.body!=='string'||Buffer.byteLength(e.body)>2097152))))dailyFail();
   await ledger.claimWorker(org);claimed=true;
   // Recheck after exclusive ownership; another session may have consumed the day.
   const lockedAt=await ledger.simulationTime();
   if(lockedAt.slice(0,10)!==plan.asOfDay)dailyFail();
   validateSimulationAuthorization(authorization,plan,lockedAt);
   state=due(schedule,lockedAt,await ledger.read(org));
   if(state!=='DUE')result=report(state);
   else{
    const u=await ledger.usageIntent(org);await ledger.usageResponse(org,u.id,usage);
    const r=await ledger.reserve(org,plan,authorization);
    for(const e of exchanges){
     const intent=await ledger.intent(org,r.id,e.job,e.operation);
     await ledger.publishCheckpoint(org);
     await ledger.fakeSend(org,r.id,intent.id);
     await ledger.response(org,r.id,intent.id,e.body);
     const v=await ledger.read(org),current=v.reservations.find(x=>x.id===r.id);
     if(current.state==='UNKNOWN'||current.state==='FAILED')break;
    }
    const v=await ledger.read(org),current=v.reservations.find(x=>x.id===r.id);
    await ledger.publishCheckpoint(org);
    result={...report(current.state==='SUCCEEDED'?'SIMULATED_SUCCEEDED':'BLOCKED'),pendingUnits:v.pendingUnits};
   }
  }catch{result=report('BLOCKED');}
  finally{
   if(claimed)try{await ledger.releaseWorker(org);}catch{result=report('BLOCKED');}
   busy=false;
  }
  return result;
 }});
}
