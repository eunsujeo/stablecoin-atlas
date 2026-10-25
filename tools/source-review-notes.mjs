import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {sourceReviewProfiles,sourceReviewNotice,sourceReviewDate,sourceFeaturesFor,sourceFeatureLabels,sourceProfileKey,sourceProfileStatus,sourceScopeSummary} from '../web/source-review-data.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=items=>'<ul>'+items.map(item=>`<li>${escape(item)}</li>`).join('')+'</ul>';
export function sourceReviewNotes(){
  const articles=sourceReviewProfiles.map(p=>`<article id="${escape(p.id)}" class="source-review-detail">
<h2>${escape(p.symbol)} · ${escape(p.network)}</h2>
<p>${p.chainId?`chainId ${escape(p.chainId)} · `:""}${escape(p.identityLabel??"컨트랙트")}: ${escape(p.address)}</p><p>검토 종류: ${escape(sourceProfileStatus(p))}</p>
<h3>항목별 소스·문서 확인</h3><p>있음·없음은 선택 소스 경로 기준이며 자료 부족은 추가 검토입니다.</p>${list(sourceFeaturesFor(p.coinId,sourceProfileKey(p)).map(f=>`${f.group} / ${f.label}: ${sourceFeatureLabels[f.status]} — ${f.detail} 근거: ${f.evidence}`))}
<h3>전송·승인·발행 조건</h3>${list(p.functions)}
<h3>발행사 제어·권한 조건</h3>${list(p.authorities)}
<h3>저장 관측과 소스 연결</h3><p>${escape(p.observation)}</p><p>${escape(p.bindingDetail)}</p>
<p>배포 전체 연결: UNKNOWN</p><h3>검토 한계</h3>${list(p.limitations)}
${p.evidenceRecords?`<h3>저장 근거 식별자·hash</h3>${list(p.evidenceRecords.map(e=>`${e.id} · ${e.state} · SHA-256 ${e.sha256} · 취득 ${e.requestedAt}`))}`:""}
<p>저장 연구 기록: ${p.references.map(escape).join(' / ')}</p></article>`).join('\n');
  return `<!doctype html><html lang="ko" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>토큰 소스 검토 발췌</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/source-review.css"><style>main{max-width:1100px;margin:24px auto;padding:24px}article{padding:24px 0;border-top:1px solid var(--line)}p{overflow-wrap:anywhere}</style></head><body><main><h1>토큰 소스 검토 발췌</h1><p>검토 기준 ${sourceReviewDate,sourceFeaturesFor,sourceFeatureLabels,sourceProfileKey,sourceProfileStatus,sourceScopeSummary} · 5개 토큰 · 8개 배포</p><p>${escape(sourceScopeSummary(sourceReviewProfiles))}</p><p>저장 당시 자료의 발췌이며 현재 공식 주소·소스 진위·배포 대응을 새로 인증하지 않았습니다. 관측 시각과 소스 검토 기준일을 구분합니다. 기존 PASS/FAIL·SOURCE_REVIEWED·PARTIAL·UNKNOWN 판정은 보존합니다.</p><nav aria-label="검토 배포">${sourceReviewProfiles.map(p=>`<a href="#${escape(p.id)}">${escape(p.symbol)} ${escape(p.network)}</a>`).join(' · ')}</nav>${articles}<a href="/#assets">자산 프로필로 돌아가기</a></main></body></html>\n`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  await writeFile(new URL('../web/source-review-notes.html',import.meta.url),sourceReviewNotes());
  console.log(`Reviewed source notes generated locally: ${sourceReviewProfiles.length} profiles.`);
}
