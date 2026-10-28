# Arkham 실제 수집·Supabase 반영 — 2026-10-28

사용자가 고정 최초5GET와 신규 private 스키마·기존 역할 grant·검토 snapshot1건 저장·reader/로컬 화면 확인을 승인했다. [ADR0117](../adr/0117-arkham-network-usage-pipeline.md)·[고정 계획](../../data/arkham-network-usage-20261028-plan.json)·[준비 검증](2026-10-28-network-usage-pipeline.md)을 따른다. **이번 단발은 완료·소비했으며 재사용하지 않는다.** 자동 반복/새 키/운영 Mac mini 배포는 없다.

## 수집·검토

USDT Ethereum/TRON/Solana와 USDC Ethereum/Solana의2026-10-21~27 요청 범위를 기존 키로 각각1회 읽었다. HTTP200 다섯 건·총2535bytes(501/507/510/499/518), 각7버킷으로35관측을 확보했다. 재시도·추가페이지·redirect·endpoint전환·RPC·Allium·FX 조회0이다. 이전 전체 archive manifest는 동일하며 비용은 UNCONFIRMED다.

계획/승인/authorization/intent/receipt·원문hash/바이트·UTF-8/중복 key·숫자 lexeme·시간/버킷·완료/partial 여부를 오프라인으로 검사했다.35개 모두OBSERVED, 누락0·partial0이다. 원 providerTime·실제 요청시각/집계일·숫자 문자열을 보존했고 histogram에 없는 transactions는 전부null이다. 집계 시간대 UNKNOWN·일말 하위 초 포함 미확인을 유지한다.

| 근거 | 값 |
| --- | --- |
| plan 파일 SHA256 | cb0c8a538575fc5ead304b0fc9ba94e21cfe3142c31820ddca0938cf894cd755 |
| 수집 receipt SHA256 | 5fc80be803202bf088797b6e137d404b3753b7ca52b692300c8f0f441cdd80cd |
| 검토 입력 SHA256 | f11fab536f9735354ec15cf401a0cd4919162de778bb91a4cc465e7b8aa75e70 |
| DB canonical payload SHA256 | 72d4bf732a28b063bc03c1ecf265ab24ba9bab276b8f9cfe7279579ce40d2685 |

실행 원본/승인/전체 요청 URL/키는 Git/웹에 게시하지 않는다. 수집 근거는 .state/allium-executor/arkham-network-usage-20261028-v1, 후속 검토·DB receipt는 .state/network-usage-live-20261028에 비공개로 보존했다. 위 hash는 로컬 무결성 연결이며 공급자 서명/데이터 정확성 인증이 아니다.

## 실제 Supabase 반영

기존 admin/writer/reader 설정의 TLS 검증과 같은 DB 대상을 확인했다. 두 기존 definer의 실제 정의/schema hash가 저장 검토본과 같음을 확인했다. 신규 namespace 부재와 기존10개 schema 구조·68개 테이블의 SHA-256 row hash 다중집합을 먼저 기록했다.

별도 atlas_network_usage init·기존writer SELECT/INSERT·reader SELECT grant·유효 Data API 접근 경계 확인 뒤 검토 snapshot1건(35개 일별관측)을 입력했다. 같은 입력 재import는 추가0이다. reader의 전체 payload가 검토본과 canonical 단위로 같았고 기존 production reader는 READER_READY다.

변경 후 기존10개 schema의 구조와68개 테이블 데이터 지문은 전후 동일했다. 네 API 역할/한 BYPASSRLS 역할의 schema/table/column/function·역할 전이/PUBLIC/default ACL·미검토 definer 경계를 차단한 상태를 재검증했다. Supabase Dashboard의 노출 설정 자체는 UNKNOWN이며 이를 변경하지 않았다. Collector/FX·수집 주기·기존 판정/자료는 변경하지 않았다.

## 실제 reader와 로컬 화면

기존 로컬4173 listener가 없는 것을 확인한 뒤 기존 명령 `npm run ui -- --database --database-env .state/market-db-secrets/reader.env`로 loopback 미리보기를 시작했다. 운영 Mac mini/SSH/Tunnel/DNS에는 접근하지 않았다.

새 소유 Chrome 프로필로 실제 로컬 전체 현황을 열었다. reader API의 전체35관측은 검토 입력과 canonical hash가 같았다. 실제 USDC2개/USDT3개 네트워크의2026-10-27 금액·건수와 tx 미지원/평균을 화면에서 확인했다.1440/390px·light/dark의 USD/건 축·가로 넘침 없음·출처 전환·원 집계일을 확인했다. 출처 전환은 추가 API 요청 없이 동작했고 새 snapshot의 HTTP 읽기는 최종 검사에서1회, 공급자 추가 조회0·JS오류0·외부 HTTP요청0이었다.

ReadableStream asyncIterator/AbortSignal.any 부재를 Chrome에서 모사했으며 실제 iPhone/WebKit 검증은 아니다. 로컬 미리보기는 사용자 검토를 위해 유지했고 실제 운영 웹 배포는 하지 않았다.

## 검증 도구 실패와 수정

첫 실제 화면 검사에서 CDP가 반환한 Promise를 await하지 않아 `{}`를 snapshot으로 비교했다. 제품 JSON은 정상이었으며 명시 await와 JSON 직렬화·canonical hash 비교로 고쳤다. 다음 검사는 인라인 data:image 리소스를 외부 네트워크 요청으로 세어 실패했다. 실제 HTTP(S)만 분리하자 외부 요청0임을 확인했다. 이전 실패 로그를 비공개 보존했고 수정 후 전체 실제 화면 검사를 통과했다. 두 과정 모두 API 재수집/DB 재쓰기 없이 reader/로컬 화면만 다시 읽었다.

최종 npm run check는715개 통과/실패0(rc0)이다. 실수집 CLI나 적용 script를 재실행해 재현하지 않는다. 재현은 저장 receipt/원문의 오프라인 검증과 DB reader/소유한 로컬 화면의 읽기 전용 대조로 한다. 새 기간·지표·자동 스케줄은 새 고정 범위다.
