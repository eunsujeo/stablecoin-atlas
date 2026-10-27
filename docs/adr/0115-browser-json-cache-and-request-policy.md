# ADR0115: 브라우저 정상 JSON 캐시와 요청 통제

## 승인과 경계

2026-10-27 사용자가 반복 새로고침 시 여러 JSON API의429를 줄이도록 IndexedDB·API별 TTL·캐시 우선 표시/갱신·중복 병합/병렬 제한·Retry-After·last-good/오래됨 표시·손상/용량 안전 처리를 승인했다. 회귀 후 별도 commit/push하며 운영 Mac mini에 직접 배포하지 않는다. 서버 캐시/API·Supabase 스키마·Collector/FX 수집/서비스·Cloudflare Rate Limiting 규칙은 변경하지 않는다. 새 공통 browser JS 정적 경로만 기존 허용목록에 추가한다.

## 데이터와 저장

기존 Safari getReader/2MiB/fatal UTF8·타임아웃 계층 위에 `browser-data` 정책, `browser-cache` 요청 제어, `browser-idb` 저장소와 상태 표시를 둔다. 모든 브라우저 JSON 로더가 같은 정책 계층을 사용한다. API별 모델 검증과 민감값/위험키 검사를 통과한 정상 JSON(현재 API의200 응답)만 저장한다. 429/404/오류 HTML/invalid JSON/schema 실패는 저장하지 않는다. optional404 의미는 보존하되200 null을404 성공으로 취급하지 않는다.

IndexedDB `stablecoin-atlas-response-cache-v1`의 `entries`와 `meta`를 사용한다. 데이터는 원래 JSON을 문자열로 보존하고 schema/version·정규화 URL·credentials 모드·이력의 source/date pin별 key를 분리한다. payload와 metadata(key/version/저장시각/바이트 수)의 SHA256을 검증한다. 저장/복원 시 byte/schema/model/version을 확인하며 소비자에게 별도 JSON 객체를 주어 렌더링 변경이 캐시를 오염시키지 않게 한다. 원본 관측 시각·출처·금액 문자열을 수정/재판정하지 않고 브라우저 저장 시각은 별도 메타데이터다. hit/갱신 실패는 TTL을 연장하지 않는다.

TTL은 시장/등록 목록·이력/활동5분, 기술/컨트랙트/FX/저장 조사·공급량/근거/가상 자료1시간이다. 전역 응답2MiB 및 자산262144·컨트랙트131072·가상64000바이트 상한을 유지한다. 메모리/디스크는 최대32건·payload 합계8MiB로 제한하고 저장 시 오래된 항목을 제거한다. namespace/objectStore는 캐시에만 한정하며 기존 앱 DB를 건드리지 않는다.

IndexedDB getter/open/upgrade/blocked/transaction/quota·지연 실패는 제한시간 안에 메모리로 전환한다(open/operation 각1초). 비동기 IDB callback 예외도 transaction abort/정리로 처리한다. 저장소/crypto를 사용할 수 없으면 정상 응답을 버리지 않고 이번 탭에서 유지하며 이를 표시한다. 손상 자료는 폐기·다시 검증하고, 늦은 읽기/clear 전 작업은 epoch·순서 guard로 새 응답이나 캐시를 되살리지 못한다.

## 요청과429

같은 URL/정책/context의 요청은 한 Promise로 병합한다. 각 구독자의 취소는 해당 구독만 종료하고 마지막 구독이 취소됐을 때 공유 요청을 중단한다. 이미 취소된 queued job은 재사용하지 않는다. 탭당 네트워크 상한2·시작 간격250ms·대기32를 적용하고 초과/성공/실패/취소 모두 슬롯을 회수한다. 타임아웃은 기존 실제 fetch/header/body의15초(기존 시장30초)를 유지하며 queue/storage 작업은 네트워크 요청과 구분한다.

429는 안전한 status/Retry-After/Date metadata만 전달한다. 초 단위/HTTP date를 처리하고 서버 Date가 있으면 장치 시계 오차를 보정한다. 잘못되거나 없는 헤더는60초 보수 대기, 지나치게 큰 값은 Date 최대 범위로 막는다. origin 공통 cooldown을 즉시 설정하고 실제 송신 직전 다시 검사한다. 해당 작업 안에서 자동 재시도는0이며 대기 후 재전송 timer/무한 loop를 만들지 않는다. 기한 후 사용자의 다음 조회/기존 주기 조회가 새1회 요청을 만들 수 있다.

cooldown은 IndexedDB와 작은 sessionStorage scalar 기록으로 reload에도 보존한다. BroadcastChannel이 있으면 같은 origin의 다른 탭에도 알리고 각 송신 직전 저장된 기한을 확인한다. 동시2/중복 병합은 탭 단위이며 조직/IP/모든 탭 합계 한도를 보장하지 않는다. 이미 송신한 다른 요청은 회수할 수 없다. 모든 브라우저 저장소가 금지되면 reload 간 보존은 보장할 수 없고 이번 탭의 메모리 통제/명시 안내로 저하한다. Cloudflare 규칙을 우회하거나 변경하지 않는다.

## 화면

유효 캐시는 HTTP 없이 표시한다. 만료 캐시도 먼저 표시하고 한 번 갱신하며, 검증된 새 응답만 교체한다. 실패/429 시 기존 정상 JSON/시각을 유지하고 오래된 캐시·갱신 실패·요청 제한·다음 조회 가능 시각을 상태 문구로 표시한다. 이력은 현재 selection/coin/metric/source/date pin에 맞는 자료만 허용한다. 화면/구독의 이전 응답이 최신 context를 덮지 않도록 기존 sequence/AbortSignal을 유지한다. source/contract의 실패 Promise를 영구 memoize하지 않고 화면 재진입 시 TTL 정책으로 조회할 수 있게 한다.

HTTP Cache-Control·CSP·원문 공개 경계와 서버 fallback 금지는 유지한다. 표시하는 last-good은 같은 API에서 검증해 보관한 브라우저 응답이며 다른 공급자/정적 자료로 바꾸는 fallback이 아니다. 정상 JSON의 출처·관측/검토일·금액 정밀도와 기존 판정은 그대로다. [운영/시험 기록](../research/2026-10-27-browser-json-cache.md).
