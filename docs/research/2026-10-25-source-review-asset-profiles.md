# 자산 프로필 최신 소스 검토 반영

사용자 요청으로 [ADR0100](../adr/0100-reviewed-source-asset-profiles.md)을 구현했다. 기존 [소스 검토 요약](2026-10-25-token-review-source-summary.md)·JPYC/JPYSC 함수 조건표·Kaia 전체 취득·JPYSC initialize 보완을 읽어 허용 필드만 발췌했다. 새 취득·RPC·compiler·DB 변경은 없다.

## 수행 경로와 범위

기존 자산 프로필은 Assessment 목록만 선택하여 후속 JPYC/JPYSC 소스 검토를 표시하지 못했다. 기본 `/#assets`와 `/atlas.html#assets`에 같은 데이터·컴포넌트로 5토큰/8배포를 추가했다. 기존 영역은 저장 관측 보고서로 명시하고 항목·선택·집계를 보존한다. 소스 프로필과 관측 보고서는 토큰 이름으로 자동 결합하지 않는다.

저장 주소·chainId, 소스 조건·발행사 권한, 검토 기준2026-10-25와 원본 관측 시점, 각 제한을 표시한다. USDC 전체 runtime 불일치·USDT 신규 코드 INCONCLUSIVE/과거 MISMATCH·RLUSD 코드 미관측·JPYC Ethereum 과거 프록시만 CONFIRMED/구현 UNKNOWN·다른 체인 관측 부재·Kaia 부분 일치·JPYSC 자동 절단을 유지한다. 모든 배포 전체 연결은 UNKNOWN이다. 역할 계정·서비스·상환·실제 권한 행사 검증을 추가하지 않는다.

`web/source-review-notes.html`은 동일 공개 발췌를 오프라인 생성한 문서다. 원문/비공개 경로는 제공하지 않으며 원래 연구/보고서를 덮어쓰지 않는다. 웹 요청은 정적 읽기만 한다. Lead `8b47fa71d1ce4d7d9c78836035f9b3bb` proceed의 범위·판정 분리·시각·정적 제공·동일 표시/누락 검증 조건을 반영했다.

## 검증과 재현

- `node tools/source-review-notes.mjs`: rc0, 공개 발췌8배포 HTML 생성. 네트워크/DB 접근 없음.
- `node --test web/source-review.test.mjs`: rc0, tests2/pass2/fail0. 8개의 chainId+주소, 타체인 오연결 방지, 기존 제한, 발췌 동기화·비공개 경로 부재·고정 정적 허용/POST405/원문404 검증.
- `npm run ui -- --port 4174`, `node .state/source-review-profile-browser.mjs http://127.0.0.1:4174`: rc0/PASS. 두 화면의5토큰/8배포 선택·정확한 주소/chainId·같은 내용·기존 관측 보고서 수 유지·근거 목록503에서도 프로필 선택·다크/라이트·390px overflow 없음·JS 오류0/외부 요청0. `.state/agent-logs/source-review-profile-browser.log`. 정상/누락은 Chrome 실제 렌더링으로 검사했으며 정적 HTML 문자열 검사와 구분한다.
- 화면 캡처: `.state/source-profile-{legacy,atlas}-{dark,light}.png`. 독립 임시 Chrome/profile은 종료·정리했다. 오류/수정 재시도를 요구한 검증 실패는 없었다.
- `npm run check`: 결과는 인계문의 검증 칸과 `.state/agent-logs/source-review-asset-profiles-check.log`에 기록한다.
- `git diff --check`: rc0.

사용자용4173 서버는 새 고정 정적 경로를 반영해 기존 PostgreSQL reader 모드로 재시작했다. 공개 발췌 표시를 위해 DB를 수정하거나 공급자 수집을 실행하지 않았다. 이 프로필 표시는 소스 검토의 읽기 화면이며 배포 검증/공식 지원의 새 인증이 아니다.
