import {CAPABILITY_LABELS, dashboardEvidence, comparisonRows, reportLinks} from './evidence-model.js';
import {beginLoading} from './loading.js';

const $ = selector => document.querySelector(selector);
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '미수록';
const node = (tag, value, className) => {
  const result = document.createElement(tag);
  if (value !== undefined) result.textContent = text(value);
  if (className) result.className = className;
  return result;
};
const state = {index:null, compare:['','',''], loading:false, attempted:false};
const controls = ['#compare-report-1', '#compare-report-2', '#compare-report-3'];
const active = () => location.hash === '#compare';
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
function compare() {
  const head = $('#native-comparison-head'), body = $('#native-comparison-body');
  head.replaceChildren();body.replaceChildren();
  const ids = state.compare.filter(Boolean);
  for(const selector of controls){const select=$(selector);for(const option of select.options)option.disabled=!!option.value&&option.value!==select.value&&ids.includes(option.value);}
  try {
    const rows = comparisonRows(state.index, ids), header = node('tr');
    const title = node('th', '검증 항목 / 체인별 의미');title.scope = 'col';header.append(title);
    for (const id of ids) {
      const report = state.index.reports.find(report => report.id === id), cell = node('th');
      cell.scope = 'col';cell.append(node('strong', report.label), node('small', report.chain), node('small', `보고서 완료 ${text(report.completedAt)}`), documentLink(report));
      header.append(cell);
    }
    head.append(header);$('#native-comparison-message').textContent = `${ids.length}개 저장 보고서 · ${rows.length}개 검증 항목 · 판정 / 지원 / 실행은 별도 상태입니다.`;
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
    $('#native-comparison-message').textContent = state.index?.reports.length?'서로 다른 저장 보고서 2~3개를 선택하세요.':'저장된 읽기 보고서가 없습니다. 자산 비교에서 소스 검토 자료를 확인할 수 있습니다.';
  }
}
function render() {
  const reports = state.index?.reports ?? [];
  state.compare.forEach((id, index) => options($(controls[index]), id, reports, index === 2));
  compare();
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
  const finishes=[
    beginLoading($('#compare'),{ready:!!state.index,targets:[['#native-comparison-body','rows']]}),
  ];
  for (const button of document.querySelectorAll('.atlas-evidence-reload')) button.disabled = true;
  status(state.index ? `근거 다시 읽는 중 · 문서 생성 ${text(state.index.generatedAt)} 유지` : '공개용 저장 근거 읽는 중');
  try {
    const index = await readIndex(), ids = new Set(index.reports.map(report => report.id));
    const removed = !!state.index && state.compare.some(id => id && !ids.has(id));
    if (!state.index) {
      state.compare = [index.reports[0]?.id ?? '', index.reports[1]?.id ?? '', ''];
    } else {
      state.compare = state.compare.map(id => ids.has(id) ? id : '');
    }
    state.index = index;render();
    const message = index.reports.length ? `저장 근거 조회 완료 · 문서 생성 ${text(index.generatedAt)} · 자산별 관측 시각은 각 보고서 참조` : `저장된 읽기 보고서 없음 · 문서 생성 ${text(index.generatedAt)}`;
    status(message, removed ? '이전 선택 중 새 목록에 없는 보고서가 있습니다. 빈 선택란에서 보고서를 다시 선택하세요.' : index.lastBuild?.state === 'FAILED' ? '최근 문서 생성 실패 · 기존에 게시된 근거를 표시합니다.' : '');
  } catch {
    status(state.index ? `조회 실패 · 마지막 정상 근거 유지 · 문서 생성 ${text(state.index.generatedAt)}` : '근거 조회 실패 · 아직 표시할 정상 목록이 없습니다.', state.index ? '근거 목록을 읽지 못했습니다. 기존 자료·시각·선택을 유지합니다.' : '저장 근거가 없거나 읽을 수 없습니다. 판정·지원 여부를 추정하지 않습니다.');
  } finally {
    for(const finish of finishes)finish();
    state.loading = false;
    for (const button of document.querySelectorAll('.atlas-evidence-reload')) button.disabled = false;
  }
}
for (let index = 0; index < 3; index++) $(controls[index]).addEventListener('change', event => {state.compare[index] = event.target.value;compare();});
for (const button of document.querySelectorAll('.atlas-evidence-reload')) button.addEventListener('click', load);
$('#reload').addEventListener('click', () => {if (active()) load();});
window.addEventListener('hashchange', () => {if (active() && !state.attempted) load();});
render();if (active()) load();
