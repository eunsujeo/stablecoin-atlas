# ADR0046: 일별 네트워크 유통량 이력

2026-10-22 · 사용자 승인: DeFiLlama 과거 일별 자료를 연결해3개월/1년 추이를 표시한다. 검토 bridge 전달 실패 후 사용자가 이번 작업의 단독 설계·검증·DB 적용·push를 승인했다. bridge 요청을 재전송하거나 다른 Agent를 생성하지 않는다.

## 지표와 자료

공식 문서·식별자·실제 범위와 XRPL 최신값 한계는 [조사 기록](../research/defillama-network-supply-history.md)을 따른다. 고정 USDT/USDC/RLUSD와 등록 네트워크만 가져온다. DeFiLlama NETWORK_CIRCULATING은 coin/network 단위 공급자 집계이며 특정 계약 totalSupply 인증이나 실시간 원장 관측이 아니다. Arkham CHAIN_TOTAL·XRPL obligations·판정 결과와 분리하고 한 선/순위에 섞지 않는다. Overview 시장 순위는 기존 Arkham 자료를 유지한다.

## 수집과 저장

명시 owner CLI `market:history:collect`만 고정3개 GET을 수행한다. 응답당32MiB/깊이32/30초, redirect/error, 자동 재시도·endpoint 전환·주기 실행 없음. UI 요청·서버 시작은 외부 수집하지 않는다. 기존 연구 다운로드를 재사용하는 `import --manifest`는 외부 조회0회다. 모든 응답의 자산 식별자·pegType·일별 timestamp·원본 숫자 lexeme·기간을 검증한 뒤 DB에 한 transaction으로 등록한다. 누락/범위 밖 날짜는0이나 보간으로 만들지 않는다.

원문은 기존 private archive helper의 명시32MiB 한도를 사용해0600 hash 파일로 보존한다. 기존 market archive의 기본2MiB 한도는 바꾸지 않는다. 잘못된 hash/충돌/심볼릭 링크/공개 권한은 거부한다. 원문을 Git/웹/DB에 싣지 않는다.

별도 private atlas_history는 schema_version·reader_grant·snapshot을 가진다. snapshot은 coin FK, 원본 hash, 기간 종료일, 다운로드 완료시각, 최대512KiB의 정규화 JSONB와 내용 hash를 불변 보관한다. 고정3자산/8네트워크/네트워크당366일을 제한하고 coin+fetchedAt 인덱스로 최신3개만 읽는다. JSONB는 PG TOAST 압축 대상이며 일별 전체 응답48MiB 대신 약124KiB 정규화 자료를 보관한다. 현재 수집은 명시 단발용이다. 잦은 갱신·다년 확장은 일별 행/보존 정책으로 별도 설계하며5분마다 전체 원문을 재수집하지 않는다.

동일 coin+sourcehash+종료일은 내용(다운로드 시각 제외)이 같은 경우만 멱등 처리하고 처음 저장한 다운로드 시각을 유지한다. 원본이 변경되면 새 snapshot이며 이전 기록은 보존한다. advisory lock·고유키·transaction으로 동시 중복과 부분 반영을 막는다.

## 접근과 일관성

기존 market/catalog v1 SQL·hash·facts·수집기 권한을 유지한다. owner만 명시 설치/import/grant, reader는 SELECT만 허용한다. FORCE RLS·변경 거부 trigger·자체 migration/structure hash·정확한 policy 집합·PUBLIC/Supabase API역할·함수 EXECUTE·reader 열 변경 권한을 검사한다. Data API에 schema를 공개하지 않는다.

동일 READ ONLY REPEATABLE READ에서 시장 자료·기본정보·이력을 읽는다. source/content hash·coin/기간/다운로드 시각을 원래 필드와 대조하고 DTO를 재검증한다. history schema 부재만 빈 이력이고 설치 후 오류는503이다. 조회 실패는 웹의 이전 성공 자료와 원본 기준일을 보존한다. 웹의 기존2MiB 응답 제한을 유지한다.

## 화면과 검증

`일별 유통량 · DeFiLlama`는1년 기본,3개월/30일 선택과 네트워크별 색상 선을 제공한다. `최근 총공급량 · Arkham`은 기존24시간/7일/30일과 관측된 네트워크만 제공한다. 서로 다른 출처를 자동 fallback으로 연결하지 않는다. 공통 시간축·0 기준 공급량 축·정확한 수량 tooltip·업데이트 시각만 있는 하단을 유지한다. 일별 업데이트는 공급자 날짜이며 다운로드 시각이나 현재 ledger 시각이 아니다.

검증은 PG17 실제 격리 fixture의 owner/reader/writer·RLS·불변성·멱등성·충돌 rollback·동시성·snapshot·원 시장 fingerprint 유지, 수량 lexeme/실패 입력/요청 한도, 실제 Supabase와 Chrome의8개 시계열/정확한 값/3개월·1년/모바일/실패 보존을 포함한다. 실제 결과는 최신 인계문에 기록한다.
