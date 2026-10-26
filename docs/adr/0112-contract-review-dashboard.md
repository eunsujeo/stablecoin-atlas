# ADR0112: 로컬 대시보드의 컨트랙트 분석 연결

## 승인과 결정

2026-10-26 사용자가 기존 웹 대시보드 안으로 컨트랙트 분석을 연결하도록 승인했다. `/#contracts`에 저장 보고서 선택·11개 검토 항목·16함수 표·위험과 사용 조건·근거를 기존 다크/라이트 테마로 표시한다. 새 화면을 별도 디자인으로 만들지 않는다.

독립 CLI·저장 보고서·기존 호환성 판정은 유지한다. 초기 자료는 검토된 [Multicall3 연구 기록](../research/2026-10-26-contract-review-multicall3.md)의 수동 발췌만 `web/contract-review-data.js`에 고정한다. 웹에서 비공개 snapshot/report 원문을 읽거나 공개하지 않고, 분석·RPC·공급자 호출을 실행하지 않는다. 새 보고서는 자동 탐색/게시하지 않으며 검토된 요약을 명시적으로 추가한다.

## 경계와 검증

실제 runtime/기준 블록/Proxy는 UNKNOWN, 소스 정적 분석은 REVIEW_REQUIRED, 사설 10항목은 개별 PASS로 구분한다. 원본 compiler/Slither NOT_RUN과 wrapped-total 공격 NOT_TESTED를 보존한다. 연구 출처·원래 실패 시각·분석 기준일·chain/address·hash와 한계를 표시한다. 분석 기준일은 일 단위이며 정확한 분석 시각을 새로 만들지 않는다.

연결은 로컬 Preview에 한정한다. production HTML 생성에서 명시적 시작/끝 표식을 검사해 메뉴·화면·전용 script/style을 제거한다. 표식이 없으면 실패한다. 새 자산은 publicAssets에 추가하지 않으며 GET/HEAD는 404다. 운영 웹·DB·Collector·FX·배포 변경은 없다.

로컬/운영 응답 경계 시험, 실제 Chrome의 메뉴·직접 링크·탭/키보드·검색·테마·모바일·기존 근거 API 장애 독립성과 외부/비공개 요청 0을 확인한다. 실행 결과와 재현 경로는 [연결 기록](../research/2026-10-26-contract-review-dashboard.md)에 남긴다.
