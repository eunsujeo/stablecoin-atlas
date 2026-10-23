import {supplyFixture} from './allium-supply-fixture.mjs';
import {alliumSupplySource} from '../tools/allium-supply-source.mjs';
export function reviewedSupplyFixture(){
 const f=supplyFixture(),s=alliumSupplySource(f.bytes,f.options);
 return {schemaVersion:1,kind:'DAILY_SUPPLY',provider:'ALLIUM',networkId:'ethereum',networkIdentity:'1',unit:'token',dateBasis:'PROVIDER_DAY',aggregateTimezone:'UNKNOWN',precision:'PROVIDER_DECIMAL_STRING_NOT_BASE_UNIT_VERIFIED',metrics:['TOTAL_SUPPLY','CIRCULATING_SUPPLY','ADJUSTED_CIRCULATING_SUPPLY'],usdAvailability:'NOT_REQUESTED',requestedRange:{coinId:null,from:s.from,to:s.to},state:'AVAILABLE',series:['usdc','usdt'].map(coinId=>({coinId,networkId:'ethereum',deploymentId:coinId+'-ethereum',points:s.rows.filter(r=>r.coinId===coinId).map(r=>({day:r.day,...r.values,queriedAt:s.queriedAt,sourceHash:s.sourceHash}))}))};
}
