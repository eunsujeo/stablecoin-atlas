import {capabilityToken} from './provider-capability-plan.mjs';
export function balanceArrayPlan(){
 return {version:1,kind:'READ_ONLY_BALANCE_ARRAY_PROBE',slot:'balance-array-20261024',
  leaseMs:300000,maxResponseBytes:2097152,maxTotalBytes:2097152,timeoutMs:20000,retries:0,pages:1,maxRuns:0,maxHttpRequests:1,
  providerLimits:{arkham:{maxRuns:0,maxHttpRequests:0},allium:{maxRuns:0,maxHttpRequests:1}},maxSqlHttpRequests:0,maxStatusReads:0,
  costStatus:'UNCONFIRMED',globalBudgetGuaranteed:false,
  source:{commit:'3eae75066fbccd379d82d0429943593fe5c66076',path:'cli/commands/realtime.py',sha256:'c185c441859f243132d8b9257edcc17879411842442efa902528d6f9234d44db'},
  jobs:[{id:'allium-balances-array',provider:'allium',type:'rest',method:'POST',path:'developer/wallet/balances',body:[{chain:'ethereum',address:capabilityToken}],source:'https://docs.allium.so/api/developer/wallets/latest-token-balances'}],
  previous:[],notTested:[]};
}
