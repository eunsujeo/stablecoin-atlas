import {CAPABILITY_LABELS, dashboardEvidence, filterItems, comparisonRows, reportLinks} from './evidence-model.js';

const $ = selector => document.querySelector(selector);
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '미수록';
const node = (tag, value, className) => {
  const result = document.createElement(tag);
  if (value !== undefined) result.textContent = text(value);
  if (className) result.className = className;
  return result;
};
const state = {index:null, selected:'', compare:['','',''], loading:false, attempted:false};
const controls = ['#profile-report', '#compare-report-1', '#compare-report-2', '#compare-report-3'];
const active = () => ['#assets', '#compare'].includes(location.hash);
const known = value => value?.status === 'KNOWN'
  ? text(value.value)
  : [text(value?.status), typeof value?.reason === 'string' ? value.reason : ''].filter(Boolean).join(' · ');

function documentLink(report) {
  const link = node('a', '공개용 근거 문서 →');
  link.href = reportLinks(report.id).document;
  return link;
}
function options(select, selected, reports, optional = false) {
  const empty = node('option', optional ? '선택 안 함' : '보고서를 선택하세요');
  empty.value = '';
  select.replaceChildren(empty);
  for (const report of reports) {
    const option = node('option', `${report.label} · ${text(report.chain)} · ${text(report.completedAt)}`);
    option.value = report.id;
    select.append(option);
  }
  select.value = selected;
  select.disabled = !reports.length;
}
function verdict(item) {
  const block = node('div', undefined, 'native-scenario');
  block.append(node('span', item.scenarioId), node('strong', item.verdict, 'native-verdict'));
  block.append(node('small', `지원 ${text(item.support)} · 실행 ${text(item.executionStatus)}`));
  return block;
}
function emptyRow(body, columns, message) {
  const row = node('tr'), cell = node('td', message);
  cell.colSpan = columns;
  row.append(cell);body.append(row);
}
function profile() {
  const report = state.index?.reports.find(report => report.id === state.selected);
  const host = $('#profile-identity'), body = $('#profile-results');
  host.replaceChildren();body.replaceChildren();
  if (!report) {
    host.append(node('p', '보고서를 선택하면 자산 식별과 원래 관측 시각을 확인할 수 있습니다.'));
    emptyRow(body, 4, '선택한 보고서 없음 · 자산 지원 여부를 판정하지 않았습니다.');
    return;
  }
  const identity = report.identity ?? {}, list = node('dl', undefined, 'native-identity');
  for (const [label, value] of [
    ['체인', text(report.chain)], ['네트워크', text(identity.networkId)],
    ['표준', known(identity.assetStandard)], ['컨트랙트', known(identity.contractAddress)],
    ['Mint', known(identity.mintAddress)], ['발행자', known(identity.issuer)],
    ['통화', known(identity.issuedCurrency)], ['원본 관측', text(identity.observedAt)],
    ['보고서 완료', text(report.completedAt)], ['보고서 ID', text(report.assessmentId)],
  ]) {const pair = node('div');pair.append(node('dt', label), node('dd', value));list.append(pair);}
  host.append(node('h3', report.label), list, documentLink(report));
  const items = filterItems(state.index, {reportId:report.id});
  for (const item of items) {
    const row = node('tr'), name = node('th', CAPABILITY_LABELS[item.capability] ?? item.capability);
    name.scope = 'row';name.append(node('small', item.scenarioId));
    row.append(name, node('td', item.verdict), node('td', item.support), node('td', item.executionStatus));
    body.append(row);
  }
  if (!items.length) emptyRow(body, 4, '해당 보고서에 검증 항목이 미수록입니다.');
}
function compare() {
  const head = $('#native-comparison-head'), body = $('#native-comparison-body');
  head.replaceChildren();body.replaceChildren();
  const ids = state.compare.filter(Boolean);
  try {
    const rows = comparisonRows(state.index, ids), header = node('tr');
    const title = node('th', '검증 항목 / 체인별 의미');title.scope = 'col';header.append(title);
    for (const id of ids) {
      const report = state.index.reports.find(report => report.id === id), cell = node('th');
      cell.scope = 'col';cell.append(node('strong', report.label), node('small', report.chain), node('small', `보고서 완료 ${text(report.completedAt)}`), documentLink(report));
      header.append(cell);
    }
    head.append(header);$('#native-comparison-message').textContent = '';
    for (const row of rows) {
      const tr = node('tr'), label = node('th', CAPABILITY_LABELS[row.capability] ?? row.capability);
      label.scope = 'row';tr.append(label);
      for (const items of row.cells) {
        const cell = node('td');
        if (!items.length) cell.append(node('span', '해당 보고서에 미수록'));
        for (const item of items) cell.append(verdict(item));
        tr.append(cell);
      }
      body.append(tr);
    }
    if (!rows.length) emptyRow(body, ids.length + 1, '선택 보고서에 비교할 검증 항목이 미수록입니다.');
  } catch {
    $('#native-comparison-message').textContent = '서로 다른 보고서 2~3개를 선택하세요. 같은 보고서를 중복 비교할 수 없습니다.';
  }
}
function render() {
  const reports = state.index?.reports ?? [];
  options($('#profile-report'), state.selected, reports);
  state.compare.forEach((id, index) => options($(controls[index + 1]), id, reports, index === 2));
  profile();compare();
}
async function readIndex() {
  const response = await fetch('/evidence/index.json', {cache:'no-store', credentials:'omit', signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('READ_FAILED');
  const reader = response.body.getReader(), chunks = [];let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();if (done) break;
      size += value.length;if (size > 2 * 1024 * 1024) throw Error('READ_LIMIT');
      chunks.push(value);
    }
  } catch (error) {await reader.cancel();throw error;}
  const bytes = new Uint8Array(size);let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset);offset += chunk.length;}
  return dashboardEvidence(JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)));
}
function status(message, error = '') {
  for (const target of document.querySelectorAll('.atlas-evidence-status')) target.textContent = message;
  for (const target of document.querySelectorAll('.atlas-evidence-error')) {target.hidden = !error;target.textContent = error;}
}
async function load() {
  if (state.loading) return;
  state.loading = true;state.attempted = true;
  for (const button of document.querySelectorAll('.atlas-evidence-reload')) button.disabled = true;
  status(state.index ? `근거 다시 읽는 중 · 문서 생성 ${text(state.index.generatedAt)} 유지` : '공개용 저장 근거 읽는 중');
  try {
    const index = await readIndex(), ids = new Set(index.reports.map(report => report.id));
    const removed = !!state.index && [state.selected, ...state.compare].some(id => id && !ids.has(id));
    if (!state.index) {
      state.selected = index.reports[0]?.id ?? '';
      state.compare = [index.reports[0]?.id ?? '', index.reports[1]?.id ?? '', ''];
    } else {
      if (!ids.has(state.selected)) state.selected = '';
      state.compare = state.compare.map(id => ids.has(id) ? id : '');
    }
    state.index = index;render();
    const message = index.reports.length ? `저장 근거 조회 완료 · 문서 생성 ${text(index.generatedAt)} · 자산별 관측 시각은 각 보고서 참조` : `저장된 읽기 보고서 없음 · 문서 생성 ${text(index.generatedAt)}`;
    status(message, removed ? '이전 선택 중 새 목록에 없는 보고서가 있습니다. 빈 선택란에서 보고서를 다시 선택하세요.' : index.lastBuild?.state === 'FAILED' ? '최근 문서 생성 실패 · 기존에 게시된 근거를 표시합니다.' : '');
  } catch {
    status(state.index ? `조회 실패 · 마지막 정상 근거 유지 · 문서 생성 ${text(state.index.generatedAt)}` : '근거 조회 실패 · 아직 표시할 정상 목록이 없습니다.', state.index ? '근거 목록을 읽지 못했습니다. 기존 자료·시각·선택을 유지합니다.' : '저장 근거가 없거나 읽을 수 없습니다. 판정·지원 여부를 추정하지 않습니다.');
  } finally {
    state.loading = false;
    for (const button of document.querySelectorAll('.atlas-evidence-reload')) button.disabled = false;
  }
}
$('#profile-report').addEventListener('change', event => {state.selected = event.target.value;profile();});
for (let index = 0; index < 3; index++) $(controls[index + 1]).addEventListener('change', event => {state.compare[index] = event.target.value;compare();});
for (const button of document.querySelectorAll('.atlas-evidence-reload')) button.addEventListener('click', load);
$('#reload').addEventListener('click', () => {if (active()) load();});
window.addEventListener('hashchange', () => {if (active() && !state.attempted) load();});
render();if (active()) load();
