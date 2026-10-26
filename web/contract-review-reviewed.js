// Explicitly reviewed public excerpts. No private file discovery or report imports.
import {contractReviews} from './contract-review-data.js';
import {validateContractReviewStore} from './contract-review-model.js';
const v3=structuredClone(contractReviews[0]);
v3.id+='-infura-v3';
v3.observedAt='2026-10-26T08:40:38.561Z';
v3.source='docs/research/2026-10-26-multicall3-infura-runtime-result.md';
v3.runtime={state:'OBSERVED',equality:'PASS',blockNumber:'26275729',blockHash:'0x043690036588b1cbf06047d1962f591732a4f984882790c18f6cf94bf068179e',codeBytes:3808,codeHash:'0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891',endedAt:'2026-10-26T08:40:39.755Z',compiler:'NOT_RUN',sourceAuthenticity:'UNKNOWN',proxy:'NOT_TESTED',permissions:'NOT_TESTED'};
const section=id=>v3.sections.find(s=>s.id===id);
section('overview').facts=[['전체 상태','UNKNOWN · 소스 진위·전체 권한·안전성 미확인'],['소스 분석','REVIEW_REQUIRED · 안전성 인증 아님'],['실제 읽기','OBSERVED · 시도4 / 정상4 / GET0 / 51033바이트 · 소비 완료'],['고정 블록','26275729 · EIP1898 blockHash / requireCanonical:true · 종료 hash 동일'],['개별 바이트 대조','PASS · 공급자 onchain/recompiled 두 artifact 전체 바이트 일치'],['실행 시작/종료 UTC','2026-10-26T08:40:38.561Z / 2026-10-26T08:40:39.755Z · header timestamp 아님'],['원래 실패 시도 시각','2026-10-26T00:33:22.564Z · 블록 관측 시각 아님']];
section('source').facts=section('source').facts.map(([k,v])=>[k,k==='새 RPC runtime hash'?v3.runtime.codeHash:v]);
section('architecture').intro='고정 블록 runtime과 공급자 artifact는 일치했습니다. 실제 Proxy와 권한은 NOT_TESTED입니다.';
section('architecture').notes[0]='EIP1967·Beacon·minimal Proxy·UUPS의 별도 슬롯/호출 검증은 NOT_TESTED입니다. runtime 바이트 일치를 Proxy 부재로 해석하지 않습니다.';
section('evidence').facts=[...section('evidence').facts.filter(([k])=>!['연구 출처','기준 block/hash · 배포 연결','공급자 runtime keccak256'].includes(k)),['최초 연구 출처',contractReviews[0].source],['v2 실패 출처','docs/research/2026-10-26-multicall3-runtime-read-result.md'],['v3 관측 출처',v3.source],['기준 block/hash','26275729 / '+v3.runtime.blockHash],['runtime keccak256',v3.runtime.codeHash],['코드 길이·대조','3808바이트 · 두 artifact 전체 바이트 일치 PASS']];
section('evidence').notes=['원본 compiler 독립 재컴파일 NOT_RUN·소스 진위 UNKNOWN·실제 Proxy/권한 NOT_TESTED·비용 UNKNOWN을 유지합니다.','최초 실패 원인 UNKNOWN과 v2 TLS_FAILURE 및 소비는 보존합니다. v3의 성공으로 과거 실패 원인을 확정하지 않습니다.','세 실제 조회 소비는 모두 완료됐습니다. 새 조회는 별도 고정 계획 승인 후에만 진행합니다.','사설 개별 시험 PASS와 실제 고정 블록 artifact equality PASS를 분리합니다. 자산 안전성·현재 소스 진위 인증이 아닙니다.','unchecked wrapped-total 공격은 NOT_TESTED입니다. 기존 토큰 호환성 PASS/FAIL·SOURCE_REVIEWED 및 지원 판정에 합산하지 않습니다.'];
export const reviewedContractStore=validateContractReviewStore({schemaVersion:1,kind:'REVIEWED_CONTRACT_SUMMARIES',reports:[v3,...contractReviews]});
