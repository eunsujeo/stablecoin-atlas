# ADR0054: 확장 등록 자료의 Overview 공급량 그래프

2026-10-23 · 사용자는 추가 네트워크 백필 후 다음 구현을 승인했다. 이 단계는 기존 read-only DB 경로를 사용해5코인·선정 최대10네트워크의 일별 자료를 화면에 연결한다. writer/자동수집 전환은 별도 후속이다.

기존 `/market-data.json`·market registry·검증 점수·시세 랭킹은 유지한다. 새 `/registration-index.json`은 검증한 최신 metadata revision의 최신 selection(fetchedAt/ID 순), 코인/통화/상품 주의사항·네트워크 이름·실제 source가 있는 지표/구간/source ID만 제공한다. 새 metadata에 자료가 없다고 이전 selection으로 되돌아가지 않는다. index도 runtime reader 역할·grant·정책·구조 hash·legacy registry를 검사하고 repeatable-read READ ONLY transaction을 사용한다.

`/registration-history.json`은 selection/coin/metric 세 인자만 받으며 중복·미지 인자/미등록 코인/시세 지표를 거부한다. 서버의 index와 selection을 대조하고 index에서 고른 source ID와 해당 코인/지표의 저장 구간을 함께 기존 reader에 고정한다. 두 조회 사이에 새로운 source가 들어와도 이전 기간과 새 source를 섞지 않는다. 실제 source의 immutable coverage를 재구성하는 검사는 ADR0053을 따른다. source hash/ID·원래 REQUEST 업데이트 시각·수량 문자열과 통화/정의 계약을 보존한 별도 공개 DTO를 제공한다. 한 번에 최대10네트워크×366점·2MiB이며 SQL/transaction 한도도 유지한다.

두 endpoint는 기존 loopback/same-origin·GET/HEAD·CSP·경로 제한을 사용한다. 오류는 민감 정보를 포함하지 않는400/503이다. DB 미설정 모드만404로 명시하며 기존 JSON 그래프를 계속 사용할 수 있다. DB 등록 조회 실패를 기존3코인 자료로 바꿔 숨기지 않는다. 서버는1개 연결만 실행하고 서로 다른 대기는 최대4개, 같은 요청은 병합한다. 성공 cache는10초/최대16개이고 실패는 cache하지 않는다. 브라우저 요청이 원문 수입·외부 API·DB 쓰기를 실행하지 않는다.

Overview 공급량 영역은 별도 DTO 검증과 chart-only view를 사용한다. 새 deployment나 Adapter 지원·검증 점수를 만들지 않는다. 토큰을 고르면 해당 지표의 네트워크를 함께 표시하고, 점이 없는 네트워크는 선택지에 넣지 않는다. 날짜·수량·통화·선정 ID·정의·중복/점 수/응답 한도를 검증한다. 토큰/지표 변경은 이전 요청을 취소하고 응답 순서 번호를 검사한다. 가용 지표가 없는 코인으로 전환하는 경우도 이전 로딩 정리를 실행한다. 첫 조회/다른 토큰은 스켈레톤, 같은 선정/토큰/지표의 갱신 실패는 원래 시각의 정상 그래프와 실패 표시를 유지한다. 가용 source가 없으면 미확보로 표시한다.

네트워크10개 색상을 구분하고 일별 날짜 공백을 선으로 연결하지 않는다. 한 점은 marker와 추세 미확보 문구로 표시한다. 범례는 실제 첫/마지막 날짜와 점 수를 보여준다. 공급량 규모/첫 관측 대비 증감률 전환과0 기준 증감률 제외를 유지한다. `NETWORK_MINTED` 표시는 발행 잔액으로 고치며 당일 발행량으로 보이지 않게 한다. JPY peg를 별도 표시하고 다른 통화의 token 수량을 합산하거나 USD로 바꾸지 않는다. 업데이트는 source의 원래 REQUEST 시각이다.

검증은 endpoint origin/method/query/byte 제한·오류 비노출, 요청 병합/queue·연결 종료·오류 복구, DTO 단위/정밀도·날짜 공백·한 점, PG reader 권한/새 metadata의 무자료 상태, 브라우저5코인·10/10/2/4/1네트워크·빠른 전환·스켈레톤·오류 유지/초기 실패·다크/라이트·390px 화면과 기존 랭킹/JSON 모드 회귀를 포함한다. 실제 조회와 기존 수집기의 지속 동작은 최신 인계문에 기록한다.
