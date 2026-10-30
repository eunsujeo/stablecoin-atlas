# ADR0122: 키 없는 Frankfurter 일별 USD/KRW

2026-10-30 사용자가 Frankfurter 변경·고정 USD/KRW URL 최대1GET/64KiB/20초/재시도0 표본 확인 후 DB·웹 반영을 승인했다. 운영 자동수집 활성화는 제외했다. 기존 ECB 자료/실패/claim과 ADR0121은 보존한다.

기본 Frankfurter v2는 여러 공급자를 혼합한 참고환율이다. 한국수출입은행 고시환율이나 특정 중앙은행의 공식 환율로 표시하지 않는다. 공식 문서의 무료/키 불필요/일별/DB 캐시 허용 설명을 근거로 선택했다. 실제 요청의 네트워크 비용·이용 가능성은 별도이며 무료라는 설명을 접속 성공 보장으로 바꾸지 않는다.

- 요청은 `https://api.frankfurter.dev/v2/rate/usd/krw` 하나만 사용한다. 별도 `.state/frankfurter-fx-store`는 사용자 승인 새 공급자의 root이며 기존 ECB 미확정 claim을 우회하는 재시도 root로 사용하지 않는다. 공급자별 당일 exclusive claim/fsync 후 최대1회, redirect/재시도/공급자 fallback은 없다. 실패 claim은 재사용하지 않는다. 스케줄 설치/기동은 하지 않는다.
- 기존의 엄격한 숫자 lexeme/중복 키 검사기를 재사용한다. JSON 숫자를 Number로 계산하지 않고 `krwPerUSD` 십진 문자열과 bigint로 변환한다. schemaVersion2/FRANKFURTER_REFERENCE_FX/FRANKFURTER/BLENDED_REFERENCE/USD/KRW로 출처와 의미를 명시하며 EUR 환율을 임의 생성하지 않는다. 제공 date와 fetchedAt/hash를 보존하고 원문을 재파싱해 대조한다.
- 별도 private `atlas_fx_frankfurter`의 새 DDL과 구조 pin을 사설 PG17에서 검증한다. 기존 FX 스키마를 수정하지 않는다. 기존 writer는 snapshot INSERT/SELECT, 기존 reader는 SELECT만 사용하고 PUBLIC/API/상속·SET ROLE/view/definer/default ACL 경계를 재검사한다. DB 저장 시각과 제공일자/원 수집시각은 구분한다. 중복 입력0·ID충돌거절·동시입력/rollback·원문손상거절을 검증한다.
- 개발 DB/production/preflight는 명시 Frankfurter reader를 사용하며 ECB 자동 fallback은 하지 않는다. 기본 JSON 모드의 과거 오프라인 자료 읽기는 유지한다. 두 형식의 표시 모델은 분리된 출처를 검증하고 웹에는 검토한 projection만 제공한다. 표시는 `Frankfurter 일별 참고환율 · 기준일 …`이다. 기존 USD 금액은 바꾸지 않고 KRW 참고값만 bigint로 계산한다.
- 최신 선택은 기준일→수집시각 내림차순이다. 부재/미래 수집시각/손상/7일 초과 만료는 FX_UNAVAILABLE/503이다. 관측 date를 새 날짜로 바꾸거나 누락을0으로 대체하지 않는다. HTTP 오류/잘못된 정상응답의 bounded 원문과 고정 실패 코드를 보존하며 timeout 등 본문이 없는 실패는 원문 수신 성공으로 표시하지 않는다.

최초1회 조회는 UND_ERR_CONNECT_TIMEOUT/HTTP응답0으로 실패·소비했고 당시 실제 DB/웹 전환을 보류했다. 이후 사용자가 기존실패보존 추가1회를 명시승인해 기존root의 별도불변additional authorization/claim으로 HTTP200/63bytes를 확보했다. 기존실패claim/원문은 보존하고 새 실제 수집시각·기준일·십진값을 검증해 실제 Supabase init/grant/import1/재입력0·기존12schema77table지문보존·reader/API200·로컬웹 재시작/브라우저 원화 표시를 완료했다. 추가승인은 이번1회만 소비했고 정상 일별 한도나 운영 스케줄로 전용하지 않는다. 상세 결과는 [완료 기록](../research/2026-10-30-frankfurter-live-completion.md)을 따른다.

최초 실행·실패·준비 기록은 [연구 기록](../research/2026-10-30-frankfurter-fx.md)에 보존한다. 운영 적용은 최초 bootstrap/제어면 검토와 별개이며 자동 배포 preflight는 유효 자료가 없으면 준비 완료로 통과하지 않는다. 코드 push와 실제 DB/로컬 웹 성공을 운영 서버 적용 성공으로 확대하지 않는다.
