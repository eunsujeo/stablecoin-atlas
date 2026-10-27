import {cachedJSON,browserData} from './browser-data.js';
import {bindCacheStatus} from './browser-cache-ui.js';
import {beginLoading} from './loading.js';
// Native selects may retain :focus-visible after a pointer opens their picker.
// Keep keyboard focus visible without leaving a ring after mouse/touch selection.
document.addEventListener('pointerdown', () => { document.documentElement.dataset.inputMode = 'pointer'; }, { capture: true });
document.addEventListener('keydown', event => {
  if (!event.metaKey && !event.ctrlKey && !event.altKey) document.documentElement.dataset.inputMode = 'keyboard';
}, { capture: true });

import { ASSETS, validateMock, sumSupply, sortSupply, selectRows, historyFor, percent, exact, compact, coordinate } from './model.js';
const $ = selector => document.querySelector(selector);
const state = { data: null, mode: 'coins', asset: 'all', focusAsset: 'USDT', ascending: false, search: '', loadedAt: null, loading: false };
const symbols = { USDT: '₮', USDC: '$', RLUSD: 'R' };
const assetVar = asset => `var(--${{ USDT: 'teal', USDC: 'blue', RLUSD: 'purple' }[asset]})`;
function el(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function svgNode(tag, attrs = {}) { const node = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value)); return node; }
function setText(selector, value) { $(selector).textContent = value; }
function track(width, className = '') { const node = el('div', undefined, `track ${className}`); const fill = el('span', undefined, 'track-fill'); fill.style.width = `${width}%`; node.append(fill); return node; }
function assetIcon(asset) { return el('span', symbols[asset], `coin ${asset.toLowerCase()}`); }
let dialogTrigger = null;
function showDialog(title, contents, trigger = document.activeElement) {
  dialogTrigger = trigger;
  setText('#dialog-title', title); $('#dialog-content').replaceChildren(...contents);
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}
function paragraph(text, className) { return el('p', text, className); }
function explainScores() {
  showDialog('근거 충족률 · 목데이터 예시', [paragraph('84/B, 92/A, 72/C 등의 점수와 등급은 화면 배치를 위한 수작업 예시입니다. 실제 보고서의 항목을 집계하거나 평가한 결과가 아닙니다.', 'dialog-notice'), paragraph('실제 산정에는 항목·분모·비적용 처리·등급 구간·기준 버전을 먼저 정해야 합니다. 현재는 해당 기준이 확정되지 않았습니다.'), paragraph('근거 충족률은 안전성·상환 능력·투자 등급이 아닙니다. 지원 여부와 개별 시나리오 판정은 별도로 유지합니다.')]);
}
function detail(row, trigger = document.activeElement) {
  state.focusAsset = row.asset; renderMetricScore();
  const dl = el('dl');
  for (const [label, value] of [['자산', row.asset], ['범위', row.chain ? `${row.chain} · 선택 프로필` : '코인 전체 · 전체 체인 합계 예시'], ['원본 수량', `${row.supply} tokens`], ['구분자 표시', `${exact(row.supply)} tokens`], ['자료 기준', '12:00:00 · 가상 시각'], ['화면 읽음', state.loadedAt ?? '—'], ['점수 / 등급', `${row.score}/100 · ${row.grade} · 수작업 예시`], ['출처', '로컬 가상 데이터'], ['실제 보고서', '연결되지 않음']]) {
    dl.append(el('dt', label)); const dd = el('dd', value, label.includes('수량') ? 'exact' : undefined); dl.append(dd);
  }
  showDialog(`${row.asset}${row.chain ? ' · ' + row.chain : ''}`, [paragraph('가상 데이터 상세입니다. 실제 주소·관측 근거·검증 판정으로 사용할 수 없습니다.', 'dialog-notice'), dl, paragraph('코인 전체 합계와 선택한 8개 자산·체인 프로필은 서로 다른 범위입니다. 공개망 데이터와 원본 보고서는 다음 데이터 연결 단계에서 제공할 예정입니다.')], trigger);
}
function renderMetricScore() {
  const coin = state.data?.coins.find(row => row.asset === state.focusAsset);
  if (!coin) return;
  setText('#evidence-label', `${coin.asset} 근거 충족률 · 예시`); setText('#score', String(coin.score)); setText('#grade', coin.grade);
}
function renderHistory() {
  const host = $('#history'); host.replaceChildren();
  if (state.mode === 'profiles') {
    const empty = el('div', undefined, 'empty-state'); empty.append(el('strong', '체인별 추이는 아직 없습니다.'), el('span', '현재 목데이터에는 코인 전체의 6개 시점만 있습니다.'), el('span', '체인별 현재값으로 과거 수량을 만들지 않습니다.')); host.append(empty);
    setText('#history-scope', '선택 프로필 · 시계열 미연결'); return;
  }
  const points = historyFor(state.data, state.asset); const values = points.map(p => BigInt(p.value));
  const min = values.reduce((a, b) => a < b ? a : b), max = values.reduce((a, b) => a > b ? a : b);
  const span = max - min || 100000000n, low = min > span / 5n ? min - span / 5n : 0n, high = max + span / 5n;
  const width = high - low, smallScale = high < 100000000n;
  const svg = svgNode('svg', { viewBox: '0 0 800 280', role: 'img', 'aria-label': `${state.asset === 'all' ? '선택 3개 코인 합계' : state.asset}의 가상 유통량 추이` });
  const defs = svgNode('defs'), gradient = svgNode('linearGradient', { id: 'history-area', x1: '0', y1: '0', x2: '0', y2: '1' });
  gradient.append(svgNode('stop', { offset: '0', 'stop-color': 'var(--teal)', 'stop-opacity': '.24' }), svgNode('stop', { offset: '1', 'stop-color': 'var(--teal)', 'stop-opacity': '0' })); defs.append(gradient); svg.append(defs);
  for (let i = 0; i < 4; i++) {
    const value = low + width * BigInt(i) / 3n; const y = 240 - i * 63;
    svg.append(svgNode('line', { x1: 65, y1: y, x2: 780, y2: y, class: 'grid-line' }));
    const label = svgNode('text', { x: 55, y: y + 4, 'text-anchor': 'end', class: 'axis-text' }); label.textContent = smallScale ? exact(value) : compact(value).replace('억', ''); svg.append(label);
  }
  const coords = points.map((p, i) => [65 + i * 143, 240 - coordinate(BigInt(p.value) - low, width, 10000) * 190 / 10000]);
  let d = `M ${coords[0].join(' ')}`;
  for (let i = 1; i < coords.length; i++) { const [x, y] = coords[i - 1], [nx, ny] = coords[i], mid = (x + nx) / 2; d += ` C ${mid} ${y},${mid} ${ny},${nx} ${ny}`; }
  svg.append(svgNode('path', { d: `${d} L 780 240 L 65 240 Z`, fill: 'url(#history-area)' }), svgNode('path', { d, class: 'trend-line' }));
  const tooltip = el('div', undefined, 'chart-tooltip'); tooltip.hidden = true;
  coords.forEach(([x, y], i) => {
    const point = svgNode('circle', { cx: x, cy: y, r: 4, class: 'data-point', tabindex: 0, role: 'img', 'aria-label': `${points[i].label} ${exact(points[i].value)} tokens · 가상` });
    const title = svgNode('title'); title.textContent = `${points[i].label}: ${exact(points[i].value)} tokens · 가상`; point.append(title);
    const show = () => { tooltip.replaceChildren(el('small', `${points[i].label} · 가상 시점`), el('strong', `${exact(points[i].value)} tokens`)); tooltip.style.left = `${Math.max(5, Math.min(65, x / 8 - 13))}%`; tooltip.hidden = false; };
    point.addEventListener('pointerenter', show); point.addEventListener('click', show); point.addEventListener('focus', show); point.addEventListener('pointerleave', () => { tooltip.hidden = true; }); point.addEventListener('blur', () => { tooltip.hidden = true; });
    const label = svgNode('text', { x, y: 268, 'text-anchor': 'middle', class: 'axis-text' }); label.textContent = points[i].label; svg.append(point, label);
  });
  host.append(svg, tooltip); setText('#history-scope', `${state.asset === 'all' ? '선택 3개 코인 합계' : state.asset + ' 전체'} · 단위: ${smallScale ? '토큰' : '억 토큰'} · 가상 데이터`);
}
function renderRanking(rows, total) {
  const host = $('#ranking'); host.replaceChildren();
  const sorted = sortSupply(rows), max = BigInt(sorted[0]?.supply ?? '0');
  for (const row of sorted) {
    const button = el('button', undefined, `ranking-row asset-${row.asset.toLowerCase()}`), top = el('div', undefined, 'rank-top'), name = el('span', undefined, 'rank-name');
    name.append(el('strong', row.asset + (row.chain ? ` · ${row.chain}` : '')), el('small', `${percent(row.supply, total)} of selected`));
    top.append(assetIcon(row.asset), name, el('span', compact(row.supply), 'rank-value')); button.append(top, track(max === 0n ? 0 : coordinate(row.supply, max, 10000) / 100)); button.addEventListener('click', event => detail(row, event.currentTarget)); host.append(button);
  }
  setText('#rank-scope', state.mode === 'profiles' ? `${rows.length}개 선택 프로필 · 전체 공급량과 별도` : `${rows.length}개 코인 · 전체 체인 합계 예시`);
}
function renderComposition(rows, total) {
  const grouped = ASSETS.map(asset => ({ asset, supply: sumSupply(rows.filter(row => row.asset === asset)).toString() })).filter(row => BigInt(row.supply) > 0n);
  const host = $('#composition'); host.replaceChildren(); if (total === 0n) { host.append(paragraph('확인된 수량은 0입니다. 구성비를 계산할 수 없습니다.', 'muted')); return; } const donut = el('div', undefined, 'donut'), svg = svgNode('svg', { viewBox: '0 0 180 180', role: 'img', 'aria-label': '선택 범위 코인별 구성 · 가상 수량 비율' });
  const circumference = 2 * Math.PI * 73; let offset = 0;
  svg.append(svgNode('circle', { cx: 90, cy: 90, r: 73, fill: 'none', stroke: 'var(--track)', 'stroke-width': 21 }));
  for (const row of grouped) {
    const segment = coordinate(row.supply, total, 10000) * circumference / 10000;
    svg.append(svgNode('circle', { cx: 90, cy: 90, r: 73, fill: 'none', stroke: assetVar(row.asset), 'stroke-width': 21, 'stroke-dasharray': `${Math.max(0, segment - 3)} ${circumference - Math.max(0, segment - 3)}`, 'stroke-dashoffset': -offset })); offset += segment;
  }
  const center = el('div', undefined, 'donut-center'); center.append(el('small', `${grouped.length} COIN${grouped.length > 1 ? 'S' : ''}`), el('strong', compact(total))); donut.append(svg, center);
  const legend = el('div', undefined, 'composition-legend');
  for (const row of grouped) { const line = el('div', undefined, 'legend-row'); line.append(el('span', undefined, `legend-dot ${row.asset.toLowerCase()}`), el('strong', row.asset), el('span', percent(row.supply, total))); legend.append(line); }
  host.append(donut, legend);
}
function renderChains() {
  const profiles = selectRows(state.data, 'profiles', state.asset), total = sumSupply(profiles), groups = new Map();
  for (const row of profiles) groups.set(row.chain, (groups.get(row.chain) ?? 0n) + BigInt(row.supply));
  const sorted = [...groups].sort((a, b) => a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0), max = sorted[0]?.[1] ?? 0n; const host = $('#chains'); host.replaceChildren();
  for (const [chain, amount] of sorted) { const line = el('div', undefined, 'chain-row'); line.append(el('span', chain), track(max === 0n ? 0 : coordinate(amount, max, 10000) / 100), el('span', percent(amount, total))); host.append(line); }
  setText('#chain-scope', `${profiles.length}개 프로필 합계 ${compact(total)} · 전체 공급량과 별도`);
}
function renderScores() {
  const host = $('#evidence-scores'); host.replaceChildren();
  for (const row of state.data.coins) {
    const button = el('button', undefined, 'score-button'), top = el('div'); top.append(el('strong', row.asset), el('span', row.grade, 'grade'), el('span', `${row.score}/100`, 'muted')); button.append(top, track(row.score)); button.addEventListener('click', event => detail(row, event.currentTarget)); host.append(button);
  }
}
function renderTable() {
  if (!state.data) return;
  const all = selectRows(state.data, state.mode, state.asset), total = sumSupply(all), rows = sortSupply(all, state.ascending).filter(row => `${row.asset} ${row.chain ?? ''}`.toLowerCase().includes(state.search.toLowerCase()));
  const host = $('#profile-rows'); host.replaceChildren(); const ranking = sortSupply(all);
  for (const row of rows) {
    const tr = el('tr'); const key = `${row.asset}:${row.chain ?? ''}`; const rank = ranking.findIndex(r => `${r.asset}:${r.chain ?? ''}` === key) + 1;
    tr.append(el('td', String(rank)), el('td', row.asset + (row.chain ? ` · ${row.chain}` : '')), el('td', exact(row.supply), 'exact'), el('td', percent(row.supply, total)), el('td', `${row.score}/100`));
    const grade = el('td'); grade.append(el('span', row.grade, 'grade')); const action = el('td'), button = el('button', '근거 보기 →'); button.setAttribute('aria-label', `${row.asset} ${row.chain ?? '전체'} 가상 자료 상세`); button.addEventListener('click', event => detail(row, event.currentTarget)); action.append(button); tr.append(grade, action); host.append(tr);
  }
  if (!rows.length) { const tr = el('tr'), td = el('td', '일치하는 프로필이 없습니다. 검색어를 바꿔보세요.'); td.colSpan = 7; tr.append(td); host.append(tr); }
  setText('#table-note', `${all.length}개 중 ${rows.length}개 표시 · 점유율 분모는 검색 전 선택 범위 · 요약은 축약 표시 · 표의 원본 수량 단위: tokens`);
  const th = $('#sort').closest('th'); th.setAttribute('aria-sort', state.ascending ? 'ascending' : 'descending'); setText('#sort', `유통량 ${state.ascending ? '↑' : '↓'}`); $('#sort').setAttribute('aria-label', `수량 ${state.ascending ? '내림차순' : '오름차순'}으로 정렬`);
}
function render() {
  if (!state.data) return;
  const rows = selectRows(state.data, state.mode, state.asset), total = sumSupply(rows);
  setText('#supply', compact(total)); $('#supply').title = `${exact(total)} tokens · 가상`;
  setText('#supply-note', state.mode === 'profiles' ? '선택 프로필 합계 · 전체 공급량과 별도' : '전체 체인 합계 예시 · 가상 수량');
  setText('#count', String(rows.length)); setText('#count-unit', state.mode === 'profiles' ? 'profiles' : 'coins'); setText('#count-note', state.mode === 'profiles' ? '선택 8개 프로필 내 필터 결과' : 'USDT · USDC · RLUSD 내 필터 결과');
  if (state.mode === 'coins') { const history = historyFor(state.data, state.asset), first = BigInt(history[0].value), difference = total - first; setText('#change', `${difference >= 0n ? '+' : ''}${compact(difference)}`); setText('#change-pct', first === 0n ? '기준값 0' : `${difference >= 0n ? '+' : '−'}${percent(difference < 0n ? -difference : difference, first)}`); setText('#change-note', 'D-5 대비 D0 · 목데이터 구간'); }
  else { setText('#change', '자료 없음'); setText('#change-pct', '미연결'); setText('#change-note', '체인별 과거 자료는 목데이터에 없음'); }
  for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
  for (const button of document.querySelectorAll('[data-asset]')) button.setAttribute('aria-pressed', String(button.dataset.asset === state.asset));
  setText('#scope-label', state.mode === 'profiles' ? `${rows.length}개 자산 × 체인 · 부분 범위` : `${rows.length}개 코인 · 전체 규모 예시`);
  renderMetricScore(); renderHistory(); renderRanking(rows, total); renderComposition(rows, total); renderChains(); renderScores(); renderTable();
  $('#dashboard').setAttribute('aria-busy', 'false');
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#theme-toggle').setAttribute('aria-pressed', String(theme === 'light'));
  setText('#theme-toggle', theme === 'dark' ? '☀ 라이트' : '☾ 다크'); $('#theme-toggle').setAttribute('aria-label', `${theme === 'dark' ? '라이트' : '다크'} 모드로 전환`);
  try { localStorage.setItem('atlas-theme', theme); } catch { /* Theme still works when browser storage is unavailable. */ }
}
let cacheRefreshPending=false;
bindCacheStatus($('#dashboard'),url=>url==='/mock-data.json');
browserData.subscribe(event=>{if(event.updated&&event.url==='/mock-data.json'){if(state.loading)cacheRefreshPending=true;else load();}});
async function load() {
  if (state.loading) return;
  state.loading = true; $('#reload').disabled = true; $('#error').hidden = true;
  const finish=beginLoading($('#dashboard'),{ready:!!state.data,targets:[['#history','chart'],['#ranking','rows'],['#chains','rows']]});
  try {
    const data = validateMock(await cachedJSON('/mock-data.json',{cache:'no-store',credentials:'omit',timeoutMs:10000,validate:validateMock})); state.data = data; state.loadedAt = new Date().toLocaleTimeString('ko-KR', { hour12: false }); render();
    setText('#status', `목데이터 · 자료 시각 12:00:00 [가상] · 화면 읽음 ${state.loadedAt} · 외부 조회 없음`);
  } catch {
    setText('#error', state.data ? '목데이터를 다시 읽지 못했습니다. 마지막으로 읽은 자료와 시각을 유지합니다.' : '목데이터를 읽지 못했습니다. 로컬 미리보기 서버가 실행 중인지 확인한 뒤 다시 읽기를 눌러주세요.'); $('#error').hidden = false; $('#dashboard').setAttribute('aria-busy', 'false');
    if (!state.data) setText('#status', '자료 없음 · 미확인 수량을 0으로 채우지 않습니다.');
  } finally { finish(); state.loading = false; $('#reload').disabled = false;if(cacheRefreshPending){cacheRefreshPending=false;queueMicrotask(load);} }
}
for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => { state.mode = button.dataset.mode; render(); });
for (const button of document.querySelectorAll('[data-asset]')) button.addEventListener('click', () => { state.asset = button.dataset.asset; if (state.asset !== 'all') state.focusAsset = state.asset; render(); });
for (const button of document.querySelectorAll('[data-action]')) button.addEventListener('click', () => {
  button.focus({ preventScroll: true });
  if (button.dataset.action === 'rubric') { explainScores(); return; }
  if (button.dataset.action === 'compare') { showDialog('코인 비교 · 가상 자료', [paragraph('선택 3개 코인의 전체 체인 합계 예시입니다. 8개 체인 프로필 합계와는 다른 범위입니다.', 'dialog-notice'), ...((state.data?.coins ?? []).map(row => paragraph(`${row.asset} · ${exact(row.supply)} tokens · 근거 충족률 ${row.score}/100 · ${row.grade} [수작업 예시]`)))]); return; }
  showDialog('근거 · 보고서', [paragraph('현재 화면은 로컬 목데이터를 사용합니다. 실제 공개망 관측 보고서와 연결되어 있지 않습니다.', 'dialog-notice'), paragraph('정확한 수량과 자료 범위는 순위 목록의 자산을 눌러 확인할 수 있습니다. 원본 보고서·식별자·관측 시각 연결은 데이터 통합 단계에서 진행합니다.')]);
});
$('#search').addEventListener('input', event => { state.search = event.target.value; renderTable(); });
$('#sort').addEventListener('click', () => { state.ascending = !state.ascending; renderTable(); });
$('#theme-toggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('#reload').addEventListener('click', load); $('#close-dialog').addEventListener('click', () => $('#detail-dialog').close());
$('#detail-dialog').addEventListener('close', () => { const trigger = dialogTrigger; dialogTrigger = null; if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); });
$('#detail-dialog').addEventListener('click', event => { if (event.target === $('#detail-dialog')) { const box = event.target.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.target.close(); } });
let saved; try { saved = localStorage.getItem('atlas-theme'); } catch { /* Use the approved dark default. */ }
applyTheme(saved === 'light' ? 'light' : 'dark');
load();
