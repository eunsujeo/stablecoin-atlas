# API 인자 오류 후속 조사와 단발 검사 후보

2026-10-24의 공개 공식 문서 조사다. [ADR0083 결과표](provider-api-capabilities-2026-10-24.md)의 인자 오류 4건 중 Allium 잔액은 배열 body 후보를 확보했다. Arkham 3건의 값·단위는 미확인이다. 이번에는 인증 API를 호출하지 않았으며 기존 표본의 판정·원문·소비 상태를 유지한다.

## 공식 요청 형식 확인

| 기존 표본 | 확인한 공식 근거 | 후속 상태 |
| --- | --- | --- |
| Arkham 기관 portfolio | 기존 오류 `time is required`; [공식 상세 경로](https://arkm.com/llms/get-portfolio-entity-entity.md) 열람 실패 | time 형식·단위·허용 범위 UNKNOWN, 호출 후보 제외 |
| Arkham token top_flow | 기존 오류 `timeLast is required`; [공식 상세 경로](https://arkm.com/llms/get-token-top_flow-chain-address.md) 열람 실패 | timeLast 형식·단위·필수 동반 인자 UNKNOWN, 호출 후보 제외 |
| Arkham token volume | 기존 오류 `granularity is required`; [공식 상세 경로](https://arkm.com/llms/get-token-volume-chain-address.md) 열람 실패 | granularity 허용값·기간 조건 UNKNOWN, 호출 후보 제외 |
| Allium 최신 지갑 잔액 | [공식 Body 명세](https://docs.allium.so/api/developer/wallets/latest-token-balances)는 chain/address 항목 배열 1~100개; [공식 CLI](https://github.com/Allium-Science/allium-cli/blob/main/cli/commands/realtime.py)의 balances_latest도 list body 사용 | 단일 객체를 원소 1개의 배열로 바꾼 후속 표본 후보, 실제 응답 NOT_TESTED |

Allium 문서의 cURL·언어별 예제는 단일 객체지만 Body 명세는 배열이다. 공식 CLI의 `balances_latest`는 `list[dict[str, str]]`를 만들고 같은 `/api/v1/developer/wallet/balances`로 POST한다. 배열을 다음 후보로 선택할 근거이며, 이전 HTTP400의 유일한 원인이나 수정 후 성공을 확정하지 않는다. CLI를 설치하거나 실행하지 않았다. CLI 링크는 가변 main 기준의 조사 출처이며 향후 실행 전 검토 근거를 고정해야 한다.

Arkham 상세 URL은 [공식 목록](https://arkm.com/llms.txt)에 있는 경로다. 웹 도구의 `not accessible via this tool` 이후, 기본 프록시 설정을 따르는 인증 없는 직접 GET을 각 1회 수행했다. 세 응답 모두 `HTTP403`, `Server: cloudflare`, `X-Squid-Error` 없음이었다. 접근 거절의 구체적 원인은 미확인이며 관리형 프록시 정책 차단으로 단정할 근거는 없다. 다른 경로·프로토콜·프록시로 우회하지 않았다. 공식 목록의 endpoint 이름만으로 초/밀리초·상대시간·granularity 값을 추정하지 않는다.

## 검토 가능한 후속 표본

이 절은 실행 승인·실행기 구현이 아닌 고정 제안이다. 기존 소비 슬롯을 재실행하지 않으며, 사용자가 이 대상·예산을 확인한 뒤 별도 실행 계획과 영속 소비 보호를 구현·검증한다.

| 항목 | 제안 |
| --- | --- |
| 대상 | Allium REST 최신 잔액 1건만 |
| 요청 | POST `https://api.allium.so/api/v1/developer/wallet/balances` |
| body | `[{"chain":"ethereum","address":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"}]` |
| 표본 의미 | 이전과 같은 Ethereum USDC 토큰 컨트랙트 주소; 고객 지갑 또는 USDC만의 보유량 검증이 아님 |
| 새 상한 | 1HTTP·0SQL run·응답/전체 최대 2MiB·요청 20초·승인 유효시간 5분·첫 응답만 |
| 반복 | 재시도 0·추가 페이지 0·redirect 금지; 오류·429·전송 불명·프록시 오류·크기 초과에서 종료 |
| 보존 | 기존 root/공통 송신 lock, 새 전용 단발 소비; 기존 전체 archive bytes·권한 manifest·receipt·원래 시각 보존 |
| 결합 | 고정 요청 body/상한/승인/키 hash·유효시간을 결합하고 송신 전 intent와 영속 소비를 기록; crash 뒤에도 재소비/재개 금지 |
| 보고 | 200 JSON/빈 결과/오류 body·400 인자 오류·401/403·500·크기 초과·UNKNOWN을 분리; 금융 수량은 원문 보존과 십진 문자열 처리 |
| 제외 | usage·Explorer·미완료 SQL polling/취소·Arkham 재시험·자동 반복·공급자 전환·DB/UI 연결 |

이 제안의 1HTTP는 공개 문서 조사 트래픽과 별개의 인증 표본 상한이다. 가격·실제 비용·조직/타PC 예산은 UNCONFIRMED이며 요청 수·바이트 상한이 금전 상한을 보장하지 않는다. 실제로 실행하면 ADR0083의 관련 실제 누적 19run/116HTTP에 최대 0run/1HTTP가 추가된다. 현재 누적은 변하지 않았다.

## 재개 조건

추천 후보는 Allium 배열 body 단발 표본이다. [ADR0083 재개 조건](../adr/0083-bounded-provider-capability-probe.md)에 따라 새 고정 대상·예산·범위를 사용자에게 확인한 뒤 진행한다. Arkham은 공식 인자 명세가 확보되기 전까지 별도 미해결로 유지한다. 기존 크기 초과·500·미완료 SQL·Identity 거절·NOT_TESTED 항목은 이번 후보에 섞지 않는다.

Lead `f19d539fe74249a494672c017063d471`의 검토 결과는 `proceed`이며 문서 제안 범위에 한정된다. 가변 CLI 근거 고정·별도 영속 소비·기존 원문 보존·사용자의 새 범위/비용 미확인 확인 조건을 유지하며 구현·실제 호출 승인을 뜻하지 않는다.

## 승인 후 단발 결과

사용자가 위 후보를 승인해 [ADR0084](../adr/0084-single-allium-balance-array-probe.md)로 별도 실행했다. 배열 body 요청은 HTTP200 JSON·1HTTP/0run·283389bytes로 종료됐고 기존 원문/판정은 보존했다. 이 절 이전의 미실행/승인 전 서술은 후보 작성 당시의 기록이다. 추가 재호출 없이 [오프라인 활용 검토](provider-data-use-priorities-2026-10-24.md)로 넘어갔다.
