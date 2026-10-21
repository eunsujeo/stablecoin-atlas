export const CAPABILITY_LABELS = { IDENTITY:'자산 식별',TRANSFER:'전송',BALANCE:'잔액',ALLOWANCE:'승인량',DELEGATION:'위임',MINT:'발행',BURN:'소각',FREEZE:'동결',UNFREEZE:'동결 해제',BLACKLIST:'블랙리스트',PAUSE:'일시 정지',CLAWBACK:'회수',AUTHORITY_CHANGE:'권한 변경',UPGRADEABILITY:'업그레이드',TRANSFER_FEE:'전송 수수료',DECIMAL_HANDLING:'소수점 처리',EVENT_TRACKING:'이벤트',SUPPLY_TRACKING:'공급량',ACCOUNT_INITIALIZATION:'계정 초기화',FINALITY:'최종성',RESOURCE_CONSUMPTION:'자원 사용',SWEEP_COMPATIBILITY:'수집 전송' };
export const VERDICTS = ['PASS','FAIL','INCONCLUSIVE','NOT_TESTED','NOT_APPLICABLE','UNSUPPORTED'];
export function validateIndex(index) {
  if (index?.kind !== 'LOCAL_EVIDENCE_INDEX' || !Array.isArray(index.reports) || index.reports.length > 64 || !Array.isArray(index.items) || index.items.length > 2000) throw new Error('INVALID_INDEX');
  const ids = new Set(), keys = new Set();
  for (const r of index.reports) { if (!/^[a-f0-9]{64}$/.test(r.id) || ids.has(r.id) || !['LOCAL_FIXTURE','STORED_READ_ONLY'].includes(r.scope) || typeof r.label !== 'string') throw new Error('INVALID_INDEX'); ids.add(r.id); }
  for (const s of index.items) { if (!ids.has(s.reportId) || keys.has(s.key) || !VERDICTS.includes(s.verdict) || !['SUPPORTED','NOT_SUPPORTED','UNKNOWN'].includes(s.support) || !['COMPLETED','ERROR','NOT_EXECUTED'].includes(s.executionStatus)) throw new Error('INVALID_INDEX'); keys.add(s.key); }
  return index;
}
export function filterItems(index, { reportId='', capability='', verdict='', scope='', search='' } = {}) {
  const reports = new Map(index.reports.map(r=>[r.id,r]));
  return index.items.filter(s=>{ const r=reports.get(s.reportId); return (!reportId||r.id===reportId)&&(!capability||s.capability===capability)&&(!verdict||s.verdict===verdict)&&(!scope||r.scope===scope)&&(!search||`${r.label} ${s.scenarioId} ${s.capability} ${CAPABILITY_LABELS[s.capability]??''}`.toLowerCase().includes(search.toLowerCase())); });
}
export function comparisonRows(index, ids) {
  if (ids.length<2||ids.length>3||new Set(ids).size!==ids.length) throw new Error('SELECT_2_OR_3');
  const records=ids.map(id=>index.reports.find(r=>r.id===id)); if(records.some(r=>!r)||new Set(records.map(r=>r.scope)).size!==1) throw new Error('SCOPE_MISMATCH');
  const capabilities=[...new Set(index.items.filter(s=>ids.includes(s.reportId)).map(s=>s.capability))];
  return capabilities.map(capability=>({capability,cells:ids.map(id=>index.items.filter(s=>s.reportId===id&&s.capability===capability))}));
}
export const reportLinks = id => { if(!/^[a-f0-9]{64}$/.test(id))throw new Error('INVALID_ID');return {document:`/evidence/${id}.html`,projection:`/evidence/${id}.json`}; };
