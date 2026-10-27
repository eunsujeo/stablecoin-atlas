# 브라우저 JSON 캐시/요청 정책

[ADR0115](adr/0115-browser-json-cache-and-request-policy.md). 서버 캐시/수집 정책은 유지하고 브라우저가 검증된 정상 JSON을 IndexedDB에 보관한다. 반복 새로고침은 TTL이 유효한 자료의 API 요청을 만들지 않는다.

| API 자료 | 브라우저 TTL |
| --- | --- |
| 시장·등록 공급량 목록/이력·활동 | 5분 |
| 자산 기술/컨트랙트 검토 | 1시간 |
| 참고 FX·저장 공급량·survey·지리·실행 근거 | 1시간 |
| 기존 로컬 가상 자료 | 1시간, 가상 표시 유지 |

만료 자료는 먼저 표시한 뒤 갱신한다. 상태 문구의 **브라우저 저장 시각**은 원래 관측 시각이 아니다. 갱신 실패/429에서도 원래 정상 데이터/출처/금액 문자열을 유지하고 오래된 자료임을 표시한다. 모델/byte/metadata hash 검증에 실패한 캐시는 표시하지 않는다. 저장소 금지/지연/용량 초과 시 이번 탭 메모리로 저하한다.

요청은 탭당 최대2개, 시작 간격250ms, 대기 최대32개다. 동일 URL/정책/credentials/context는 병합한다.429는 origin 공통으로 멈추고 Retry-After까지 재전송하지 않는다. 자동 재시도0이며 기한 후 다음 사용자/기존 주기 조회에서만 새 요청을 만들 수 있다. IndexedDB/sessionStorage/BroadcastChannel로 reload/다른 탭에도 기한을 공유하지만 IP/여러 탭 전체의 물리적 동시2를 보장하지 않는다. 저장소 전체를 사용할 수 없으면 reload 간 보존은 불가능하다.

캐시 DB는 `stablecoin-atlas-response-cache-v1`이고 최대32건/payload8MiB다. API별 model/정규화 URL·version·이력 pin·SHA256과 기존2MiB/Safari getReader/fatal UTF8/취소/timeout을 적용한다. 유효기간은 정상 응답을 받은 시점부터 계산하고 cache hit/오류로 연장하지 않는다. 새 빌드의 모델/version이 기존 cache와 맞지 않으면 검증 후 다시 읽는다.

일반 새로고침과 기존 다시 읽기 버튼도 TTL을 따른다. 즉시 캐시 제거가 꼭 필요한 로컬 진단에서는 브라우저 개발자 도구의 해당 origin 저장소를 지우거나 `import('/browser-data.js').then(m=>m.browserData.clear())`로 정상 JSON 캐시만 지울 수 있다. 이 함수는 진행 중 요청을 중단하고 JSON cache를 비우지만429 cooldown을 지우지 않는다. 운영 rate limit을 회피하려고 저장소를 반복 삭제하지 않는다.

보존하는 JSON은 기존 화면용 API에 한정한다. 원문 source/snapshot/report·키/접속값/인증 header·임의 URL은 캐시하지 않는다. 서버/API/Collector/FX/Supabase 스키마·Cloudflare Rate Limiting·운영 배포는 변경하지 않는다. [검증/실패/재현 기록](research/2026-10-27-browser-json-cache.md).
