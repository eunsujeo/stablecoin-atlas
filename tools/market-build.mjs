import { buildMarket } from './market-store.mjs';
const root = new URL('../',import.meta.url);
try {
  const data = await buildMarket({registryPath:new URL('data/asset-registry.json',root),sourcePaths:[
    'arkham-api-smoke.json','arkham-market-additional.json','arkham-chain-supply-research.json','arkham-additional-data-research.json','xrpl-gateway-obligations-readonly.json',
  ].map(name=>new URL('reports/'+name,root))});
  console.log(`Market snapshot saved: ${data.registry.coins.length} coins, ${data.registry.deployments.length} deployments, ${data.observations.length} observations. No network calls.`);
} catch { console.error('Market snapshot build failed; previous snapshot retained. Check fixed input reports and registry.'); process.exitCode = 1; }
