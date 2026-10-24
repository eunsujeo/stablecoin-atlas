import {surveyTargets,surveyRows,surveyWindow} from './survey-model.js';
import {units} from './market-model.js';
export const alliumFields={
 supply:[['total_supply','총공급량','tokens'],['circulating_supply','유통량','tokens'],['adjusted_circulating_supply','조정 유통량','tokens']],
 volume:[['transfer_volume','전송량','tokens'],['transfer_count','전송 건수','건'],['transfer_tx_count','트랜잭션 수','건']],
};
// Only observed, non-null fields become display points. The input DTO retains all missing states.
export function alliumSeries(data,coinId,kind,field){
 if(!alliumFields[kind]?.some(f=>f[0]===field))throw Error('INVALID_ALLIUM_FIELD');
 const snapshot=data?.snapshots.find(s=>s.survey===kind);if(!snapshot)return [];
 const window=data.window??snapshot.window??surveyWindow;
 return surveyTargets.filter(t=>t.coinId===coinId).map(t=>({...t,queriedAt:snapshot.queriedAt,
  points:surveyRows(snapshot,{coin:coinId,network:t.networkId,window}).filter(r=>r.state==='OBSERVED'&&r.point.values[field]!==null).map(r=>({day:r.day,amount:r.point.values[field]})),
 })).filter(s=>s.points.length);
}
export function alliumCoins(data){return [...new Set(surveyTargets.map(t=>t.coinId))].filter(c=>Object.entries(alliumFields).some(([kind,fields])=>fields.some(([field])=>alliumSeries(data,c,kind,field).length)));}
export function alliumGeometry(points){
 if(!points.length)return [];
 const first=Date.parse(points[0].day),last=Date.parse(points.at(-1).day),high=points.reduce((m,p)=>units(p.amount)>m?units(p.amount):m,0n);
 const segments=[];let previous;
 for(const p of points){const time=Date.parse(p.day),point={...p,x:35+(last===first?280:560*(time-first)/(last-first)),y:150-Number(high===0n?0n:units(p.amount)*120000n/high)/1000};
  if(previous===undefined||time-previous!==86400000)segments.push([]);segments.at(-1).push(point);previous=time;
 }
 return segments;
}
