// Live Allium collection is retired. Archived sender regressions run only in
// a Node permission sandbox that denies network access, including wrapped fetch.
export function retiredAlliumCollection(){throw Error('ALLIUM_COLLECTION_RETIRED');}
export async function retiredAlliumFetch(){retiredAlliumCollection();}
export function assertAlliumFixtureTransport(fetcher){
 if(!process.permission||process.permission.has('net')||typeof fetcher!=='function'||fetcher===globalThis.fetch||fetcher===retiredAlliumFetch)retiredAlliumCollection();
}
