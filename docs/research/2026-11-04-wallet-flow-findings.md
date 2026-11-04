# Wallet Flow 분석 결과 보완

사용자가 기존 화면에 분석 내용이 없다고 지적했다. 초기 화면은 수집 건수와
미확장 주소를 강조했으며, 첫 후속 수신 주소의 자료16건이 선택 송금보다 과거라
입금 이후 경로를 설명하기에 부족했다. 해당16건은 입금/출금 혼합이며 전부 입금이 아니다.

## 수정
- 기존 Atlas 디자인을 유지한 분석 결과 기본 탭: 실제 입금/첫 전달 시간,
  자원 준비·송금·회수 순서, 후속 주소 행동과 반대 근거, 후속 송금 TXID 표.
- 의미 있는 KPI로 교체, 미수집 주소는 한데 요약하고 원본 coverage는 보존.
- 관계도는 선택 입금/후속 거래 우선, 역할 근거가 없는 목록의 반복을 줄임.
- 독립적인 bounded outgoing-continuation: 공식 only_from 필터, 수신 시각부터
  원래 기간 끝까지 첫20개 색인 항목. parent hash/원본 재검증/새 불변 run.
- 기존 raw56개/시각/잔액 보존. 새41HTTP/48,316bytes/20거래, 재시도0.
  신규 원본·intent는 사설 .state/private-wallet-flow/after-sweep-20261104에 보존.
  기존 소비는 다시 실행하지 않는다. 키/유료 API/DB/수집기 설정 변경0.

## 관측과 한계
6 USDT 입금 → 336초 뒤6 USDT 후속 송금. ENERGY위임114초 전/회수78초 후,
BANDWIDTH위임111초 전/회수81초 후. 위임 원금20,000/1,000 TRX는 자원 수량이 아니다.
후속 주소에서 수신 이후20건/20주소/39,446.317369 USDT 송금 관측.
전체 기간 자료는7입금/30출금이며 수신 이후 통계와 구별한다.
집금·배분 허브는 후보다. 소유자·고객 자금의 귀속·자동화·수수료 절감은 미확인.
partial coverage, 다음 페이지 미조회, 상대 주소 이력 미확장을 보존한다.

공식 API 필터 근거:
https://developers.tron.network/reference/get-trc20-transaction-info-by-account-address

## 검증 재현
`node --import tsx --test tests/wallet-flow*.test.mjs` — 15 pass.
`npm run check` 및 `WALLET_FLOW_URL=http://127.0.0.1:54876/wallet-flow/index.html node --import tsx tools/wallet-flow-browser-check.mjs`.
브라우저 스크린샷 .state/wallet-flow-browser/; 실제 관측/가상 fixture를 분리한다.
최초 브라우저 검사의 dark KPI 대비 실패는 전역 pastel 카드 글자색 상속이 원인으로,
중립 시간 카드의 ink 토큰을 명시해 수정했다. 운영 반영 결과는 인계문에 기록한다.

로컬 최종 결과: npm run check rc0 / 986 pass / 0 fail / 8 skip.
실제 관측5뷰×3뷰포트, 명시적 fixture5뷰×양테마×3뷰포트 브라우저 PASS.
KPI 대비4.5:1, 가로 넘침0, JS오류0, 로컬 외부 요청0.
실제 관측 모델의6 USDT/336초/후속20건/자원상대시각/과거16건도 별도 오프라인 대조 PASS.
Lead 검토 제출은 Agent identity/repository mismatch로 ID 생성 전 실패했다.
승인으로 간주하지 않고 별도 위임·재시도 없이 직접 검사했다.
