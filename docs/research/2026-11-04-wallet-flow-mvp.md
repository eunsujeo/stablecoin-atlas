# Wallet Flow MVP 구현·실제 관측 검증

## 경로

기존 AGENTS/setup/status/handoff 및 Atlas 읽기 전용 웹/production policy를 조사했다. 기존 DB 수집기를 재사용해 새 스키마를 만들지 않고 ADR0130의 독립 수동 collector/원문/정규화/model/API/UI 구조로 구현했다. 새 의존성·외부 도구 다운로드 없음. 기존 사용자 변경과 디자인 파일은 보존했다. Router Lead 준비는 agent_not_found로 ID 생성 전에 실패했으며 승인이나 검토 완료로 간주하지 않았다. 하위 에이전트 없이 수행했다.

처음에는 Seed/TXID가 없어 가상 fixture로 독립 구현을 검증했다. 이후 제공된 Seed를 Base58Check 검증하고 최근 24시간, 최대10개 입금 후보의 단발 익명 TronGrid GET을 실행했다. HTTP200/418bytes/입금1건. 개인과 주소의 연결 정보는 사설 저장소에만 기록했다. 공개 snapshot의 주소 labels는 모두 비어 있다.

출발 거래를 고정하고 전1시간+후5시간, 최대4확장주소/24거래/80HTTP/16MiB/300초 계획으로 수집했다. 실제56HTTP/236915bytes, 거래24/이벤트23/발견주소22, 자동 재시도0. 거래 본문·receipt와 원문 SHA-256을 보존하고 export에서 이벤트·잔액을 재대조했다. 최초 탐색까지 합하면57HTTP/237333bytes. API키/유료 플랜은 사용하지 않았다. 현재 무료 정책이 모든 사용자·키에 보장된다고 일반화하지 않는다.

## 확보 관측

- UTC2026-11-04 01:37:57, 블록87694216: USDT6 입금.
- 01:41:39: ENERGY 위임(20,000 TRX 상당의 스테이크 원금).
- 01:41:42: BANDWIDTH 위임(1,000 TRX 상당 원금).
- 01:43:33, 블록87694328: USDT6 후속 송금 후보.
- 01:44:51 / 01:44:54: 각각 같은 종류의 자원 회수.
- 후속 전송 receipt의 Energy 사용64285. fee/energy_fee가 미제공된 필드는 null 유지, 임의0/절감액 계산 없음.

이는 시간 관계이며 동일 소유, 위임 자원의 실제 소비 귀속, 비용 절감, 고객 입금의 특정 출금 사용처를 증명하지 않는다. 입금 주소의 해당 기간 공급자 이력 페이지는 끝까지 읽었고, 후속 주소는24거래 한도 때문에 partial이다. 나머지20주소는 미확장. 총18USDT/1TRX/2위임/2회수 이벤트이며 준비금·최종 출금 역할은 미확인이다. 모든 표시 연결은 공개 정규화 snapshot의 실제 TXID에 연결한다. 공급자 원문은 Git/웹에 넣지 않는다.

## 수정·실패 기록

초기 fixture 객체 괄호 누락으로 파싱 실패 → 수정 후 성공. 브라우저 검사 첫 hash-only 이동은 새 문서를 만들지 않아 응답 주입이 적용되지 않음 → about:blank 후 navigation으로 수정. CDP 반복 evaluate의 전역 const 재선언 오류 → 블록 범위로 수정. 운영 API 테스트의 기존 필수 reader fixture 누락 → 실패를 던지는 stub으로 보완하여 기존 reader가 호출되지 않음까지 검사. 이는 실제 공급자 오류가 아니다.

공개 schema는 예상하지 않은 필드를 거부하며 fixture를 production reader에서 거부한다. 손상 로그/receiptID/불안전 정수/위험 라벨 URL/중복 이벤트, 429·timeout·부분 본문·한도·반복 cursor, readonly API/Origin/원문 경로 차단을 검증한다.

## 검증 및 재현

- `node --import tsx --test tests/wallet-flow.test.mjs`: rc0,10pass/0fail.
- `npm run check`: rc0,981pass/0fail/8skip(전체989). 최종 배포 후보는 같은 전체 검사를 다시 실행하고 CI로 확인한다.
- `node --import tsx tools/wallet-flow-browser-check.mjs`: rc0/PASS. 실제 관측본 3해상도×4화면, 가상 fixture 3해상도×2테마×4화면, empty/unknown/invalid TXID/키보드/필터/자원 단위/링크 근거 대조. 가상·실제 데이터 구분, 페이지 가로 넘침0, JS예외0, 외부 요청0.
- 로컬 서버 `http://127.0.0.1:54875/wallet-flow/index.html`; 화면과 검증 JSON은 `.state/wallet-flow-browser/`. 실제 관측본 스크린샷은 로컬에만 보존한다.
- 조회 범위·실행 명령·공식 출처: `docs/WALLET_FLOW.md`. CI/운영 적용 결과는 대응 handoff에 기록한다.

## 한계

현재 웹 검색은 저장 snapshot 안에서만 동작한다. 새 TXID의 자동 실시간 수집, 정기 수집, 전체 거래소 주소 발견, 탐색기 라벨 자동 수집, DB 스키마는 미구현/미활성이다. 후속 고빈도 주소를 완전 탐색하려면 별도 제한 계획이 필요하다. 기존 Collector·FX·DB·보안·스케줄은 변경하지 않았다.
