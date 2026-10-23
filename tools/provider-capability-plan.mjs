// Fixed read-only samples. This is an access probe, not production ingestion.
export const capabilitySlot='api-capabilities-20261024';
export const capabilityToken='0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const docs='https://docs.allium.so/';
export function providerCapabilityPlan(){
 const token=capabilityToken,account={chain:'ethereum',address:token},asset={chain:'ethereum',token_address:token};
 const arkham=[
  ['token-addresses','/token/addresses/usd-coin'],['token-intelligence',`/intelligence/token/ethereum/${token}`],['market','/token/market/usd-coin'],
  ['price-history','/token/price/history/usd-coin'],['holders',`/token/holders/ethereum/${token}`],['address-balances',`/balances/address/${token}`],
  ['entity-balances','/balances/entity/binance'],['portfolio','/portfolio/entity/binance'],['history','/history/entity/binance'],
  ['transfers','/transfers?base=binance&chains=ethereum&limit=1'],['flows','/flow/entity/binance'],['top-flows',`/token/top_flow/ethereum/${token}`],
  ['counterparties','/counterparties/entity/binance'],['token-volume',`/token/volume/ethereum/${token}`],['entity-volume','/volume/entity/binance'],
  ['entity-intelligence','/intelligence/entity/binance'],['risk','/risk/entity/binance'],['loans','/loans/entity/binance'],
  ['hypercore-balances','/hypercore/entity/binance/spot-balances'],['polymarket-collateral',`/polymarket/wallet/${token}/summary/balance`],
 ].map(([id,path])=>({id:'arkham-'+id,provider:'arkham',type:'rest',method:'GET',path,body:null,source:'https://arkm.com/llms.txt'}));
 const rest=[
  ['price','developer/prices',[asset],'prices/token-latest-price'],
  ['price-history','developer/prices/history',{addresses:[asset],start_timestamp:'2026-10-22T00:00:00Z',end_timestamp:'2026-10-22T00:05:00Z',time_granularity:'5m'},'prices/token-price-history'],
  ['price-stats','developer/prices/stats',[asset],'prices/token-price-stats'],
  ['token','developer/tokens/chain-address',[asset],'tokens/get-tokens-by-chain-address'],
  ['balances','developer/wallet/balances',account,'wallets/latest-token-balances'],
  ['transactions','developer/wallet/transactions?limit=1',[account],'wallets/transactions'],
  ['pnl','developer/wallet/pnl',[account],'holdings/holdings-pnl'],
  ['positions','developer/wallet/positions',[account],'defi-positions/get-positions'],
  ['markets','markets?quote_asset=USDC&limit=1',null,'market-data/list-markets'],
 ].map(([id,path,body,source])=>({id:'allium-'+id,provider:'allium',type:'rest',method:body?'POST':'GET',path,body,source:docs+'api/developer/'+source}));
 const filter=`chain = 'ethereum' AND LOWER(token_address) = '${token}'`,day="date = '2026-10-22'::DATE",timestamp="block_timestamp >= '2026-10-22'::TIMESTAMP_NTZ AND block_timestamp < '2026-10-23'::TIMESTAMP_NTZ";
 const sql=[
  ['catalog','stablecoins.registry.catalog',"product_id = 'usdc'",'stablecoins/registry'],
  ['deployments','stablecoins.registry.deployments',`chain = 'ethereum' AND LOWER(address) = '${token}'`,'stablecoins/registry'],
  ['transfers','stablecoins.core.transfers',filter+' AND '+timestamp,'stablecoins/transfers'],
  ['balances-daily','stablecoins.core.balances_daily',filter+' AND '+day,'stablecoins/balances-daily'],
  ['supply-change','stablecoins.core.supply_change',filter+' AND '+timestamp,'stablecoins/supply-change'],
  ['supply-daily','stablecoins.core.supply_daily',filter+' AND '+day,'stablecoins/supply-daily'],
  ['volume-daily','stablecoins.metrics.volume_daily',filter+" AND activity_date = '2026-10-22'::DATE",'stablecoins/volume-daily'],
  ['entity-wallet-registry','allium_identity.aggregates.entity_wallet_registry',"primary_entity = 'Binance'",'identity/aggregates'],
  ...['cex_deposits_withdrawals','entity_balances_daily','category_balances_daily','geo_balances_exchanges_added_daily'].map(t=>[t,'allium_identity.aggregates.'+t,filter+' AND '+day,'identity/aggregates']),
  ['stablecoin-top-holders','allium_identity.aggregates.stablecoin_top_holders',filter,'identity/aggregates'],
  ['premium-labels','allium_identity.common.address_labels',`chain = 'ethereum' AND LOWER(address) = '${token}'`,'identity/premium'],
  ['dex-trades','ethereum.dex.trades',`(LOWER(token_sold_address) = '${token}' OR LOWER(token_bought_address) = '${token}') AND ${timestamp}`,'supported-blockchains/evm/core-schemas/dex/trades'],
  ['raw-logs','ethereum.raw.logs',`LOWER(address) = '${token}' AND ${timestamp}`,'supported-blockchains/evm/core-schemas/raw/logs'],
 ].map(([id,table,where,source])=>({id:'allium-sql-'+id,provider:'allium',type:'sql',table,sql:`SELECT '${id}' AS probe_id FROM ${table} WHERE ${where} LIMIT 1`,probeId:id,source:docs+'historical-data/'+source}));
 return {version:1,kind:'READ_ONLY_PROVIDER_CAPABILITY_PROBE',slot:capabilitySlot,sample:{coin:'usdc',chain:'ethereum',token,entity:'binance',accountSample:'TOKEN_CONTRACT_NOT_CUSTOMER_WALLET',day:'2026-10-22'},
  leaseMs:900000,maxResponseBytes:2097152,maxTotalBytes:33554432,timeoutMs:20000,retries:0,pages:1,maxRuns:16,maxHttpRequests:125,
  providerLimits:{arkham:{maxRuns:0,maxHttpRequests:20},allium:{maxRuns:16,maxHttpRequests:105}},maxSqlHttpRequests:6,maxStatusReads:3,
  costStatus:'UNCONFIRMED',globalBudgetGuaranteed:false,jobs:[...arkham,...rest,...sql],
  previous:[{id:'allium-geo-balances',state:'PREVIOUS_QUERY_FAILED',table:'allium_identity.aggregates.geo_balances_daily',evidence:'docs/adr/0081-geographic-balance-collection-diagnosis.md'},
   {id:'allium-cex-attributed-flows',state:'PREVIOUS_QUERY_FAILED',table:'allium_identity.aggregates.cex_attributed_flows',evidence:'docs/adr/0082-bounded-country-exchange-flow-query.md'}],
  notTested:[
   ['arkham-swaps','필수 인자 상세 미확보'],['arkham-transfer-histogram','필수 인자 상세 미확보'],['arkham-price-change-and-token-timeseries','필수 인자 상세 미확보; 대표 가격/이력 API와 별개'],
   ['arkham-risk-paths-and-label-update-feeds','위험 점수/기관 정보 표본과 별개인 세부 경로 미검증'],
   ['allium-sanctions','실행 테이블/필수 인자 상세 미확보'],['allium-payments','제품 설명만 확인; 실행 스키마 미확보'],
   ['allium-dex-pools-aggregators','DEX 거래 표본과 별개인 풀/애그리게이터 테이블 미검증'],['allium-bridges','개별 테이블·스테이블코인 필터 고정 미완료'],['allium-decoded','원시 로그 표본과 별개인 해석 이벤트·호출 조건 고정 미완료'],
   ['allium-market-candles-and-perp-metrics','시장 목록 표본과 별개; 고정 시장/필수 인자 미확보'],
   ['allium-wallet-history-and-defi-nav-health','현재 잔액/PnL/포지션 표본과 별개; 상세 인자 고정 미완료'],
   ['streams-alerts-and-custom-entities','연결 유지·상태 변경 기능은 이번 단발 읽기 검사에서 제외'],
  ].map(([id,reason])=>({id,state:'NOT_TESTED',reason}))};
}
