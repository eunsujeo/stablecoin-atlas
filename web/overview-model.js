import { validateIndex, filterItems, VERDICTS } from './evidence-model.js';
import { validateMarket, latest, units } from './market-model.js';
export function overviewSummary(index, scope='STORED_READ_ONLY') {
  validateIndex(index);
  if(!['STORED_READ_ONLY','LOCAL_FIXTURE'].includes(scope))throw new Error('INVALID_SCOPE');
  // A repeated run must not inflate the grade or its denominator.
  const reports=new Map();
  for(const report of index.reports.filter(r=>r.scope===scope)){
    const identified=typeof report.asset==='string'&&report.asset.trim()&&typeof report.identity?.networkId==='string'&&report.identity.networkId;
    const key=identified?JSON.stringify([report.asset,report.chain,report.identity.networkId,...['contractAddress','mintAddress','issuer','issuedCurrency'].map(k=>report.identity?.[k]?.value??null)]):report.id;
    const previous=reports.get(key);
    if(!previous||(report.completedAt??'')>(previous.completedAt??'')||report.completedAt===previous.completedAt&&report.id>previous.id)reports.set(key,report);
  }
  const selected=[...reports.values()],ids=new Set(selected.map(r=>r.id));
  const items=filterItems(index,{scope}).filter(i=>ids.has(i.reportId));
  const counts=Object.fromEntries(VERDICTS.map(v=>[v,items.filter(i=>i.verdict===v).length]));
  const decisive=counts.PASS+counts.FAIL,applicable=items.length-counts.NOT_APPLICABLE;
  const score=decisive?Math.floor(counts.PASS*100/decisive):null;
  const coverage=applicable?Math.floor(decisive*100/applicable):null;
  const grade=score===null?null:[['A',90],['B',80],['C',70],['D',60]].find(([,threshold])=>counts.PASS*100>=decisive*threshold)?.[0]??'F';
  const executionCounts=Object.fromEntries(['COMPLETED','ERROR','NOT_EXECUTED'].map(v=>[v,items.filter(i=>i.executionStatus===v).length]));
  return {policyVersion:'SCENARIO_SUCCESS_V1',scope,counts,executionCounts,total:items.length,decisive,applicable,score,coverage,grade,provisional:decisive<applicable,reports:selected};
}
export function overviewRanking(data, metric) {
  validateMarket(data);
  // Unknown period/unit volume and XRPL obligations never enter these ranks.
  if(!['CIRCULATING','COIN_TOTAL'].includes(metric))throw new Error('INCOMPARABLE_RANKING');
  const newest=new Map();
  for(const row of latest(data,{metric})){
    const previous=newest.get(row.coinId);
    if(!previous||row.observedAt>previous.observedAt||row.observedAt===previous.observedAt&&row.id>previous.id)newest.set(row.coinId,row);
  }
  return [...newest.values()].sort((a,b)=>units(a.amount)>units(b.amount)?-1:units(a.amount)<units(b.amount)?1:a.coinId.localeCompare(b.coinId));
}

// Aggregate item counts across the selected latest identities, never average report percentages.
export function overviewEvidenceRanking(index, { scope = 'STORED_READ_ONLY', groupBy = 'asset', metric = 'score' } = {}) {
  if (!['asset', 'network'].includes(groupBy) || !['score', 'coverage'].includes(metric)) throw Error('INVALID_RANKING');
  const selected = overviewSummary(index, scope).reports, groups = new Map();
  for (const report of selected) {
    const asset = typeof report.asset === 'string' && report.asset.trim() ? report.asset : null;
    const chain = report.chain ?? 'UNKNOWN', networkId = report.identity?.networkId ?? null;
    const key = groupBy === 'asset' ? asset ?? `UNKNOWN:${report.id}` : JSON.stringify([chain, networkId ?? `UNKNOWN:${report.id}`]);
    if (!groups.has(key)) groups.set(key, { key, label: groupBy === 'asset' ? asset ?? `자산 미확보 · ${report.label}` : `${chain} · ${networkId ?? '네트워크 미확보'}`, chain, networkId, reports: [] });
    groups.get(key).reports.push(report);
  }
  const rows = [...groups.values()].map(group => {
    const ids = new Set(group.reports.map(report => report.id));
    const summary = overviewSummary({ ...index, reports: group.reports, items: index.items.filter(item => ids.has(item.reportId)) }, scope);
    return { ...group, ...summary, networkCount: new Set(group.reports.map(r => JSON.stringify([r.chain, r.identity?.networkId ?? r.id]))).size };
  });
  const fraction = row => metric === 'score' ? [row.counts.PASS, row.decisive] : [row.decisive, row.applicable];
  const compare = (a, b) => { const [an, ad] = fraction(a), [bn, bd] = fraction(b); return ad && bd ? bn * ad - an * bd : ad ? -1 : bd ? 1 : 0; };
  rows.sort((a, b) => compare(a, b) || a.label.localeCompare(b.label) || a.key.localeCompare(b.key));
  let rank = null;
  return rows.map((row, i) => {
    if (!fraction(row)[1]) return { ...row, rank: null };
    if (!i || compare(row, rows[i - 1]) !== 0) rank = i + 1;
    return { ...row, rank };
  });
}
