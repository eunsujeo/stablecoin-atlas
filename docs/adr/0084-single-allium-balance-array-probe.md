# ADR0084 Allium 잔액 배열 요청 단발 확인

## 승인과 고정 범위

2026-10-24 사용자는 [인자 후속 조사](../research/provider-api-argument-followup-2026-10-24.md)의 Allium 잔액 1건·최대1HTTP/0run·2MiB·재시도0·비용미확인 실행을 승인했고, 안 되는 항목은 빨리 종료하고 다음 단계로 진행하라고 지시했다. 실패 원인 탐색·인자 변형 재호출·공급자 전환을 추가하지 않는다.

POST `/api/v1/developer/wallet/balances`, body는 기존 Ethereum USDC 컨트랙트 주소를 원소1개로 담은 배열이다. 실제 고객 지갑/USDC만의 잔액을 인증하지 않는다. 요청20초·유효시간5분·추가페이지0·redirect금지·2MiB 응답/전체 상한이며 SQL·usage·DB/UI 변경은 없다. 요청 수 상한은 금전 상한이 아니며 비용과 조직/타PC 통제는 미확인이다.

## 구현과 보존

기존 표본 실행기의 고정 프로필 선택을 재사용하되 기본 ADR0083 계획과 해시는 바꾸지 않는다. 신규 프로필만 새 `balance-array-20261024` 소비 슬롯과 Allium 키를 사용한다. 공통 root/송신 lock, 승인/키/고정계획/기존 archive manifest·유효시간 결합, 송신 전 intent/fsync·영속소비·crash 후 재실행 금지를 유지한다. 기존 표본 슬롯도 새 manifest에 포함하고 새 슬롯만 제외한다. 원문은 비공개 저장소에만 보존한다.

배열 근거는 [공식 CLI 고정 commit](https://github.com/Allium-Science/allium-cli/blob/3eae75066fbccd379d82d0429943593fe5c66076/cli/commands/realtime.py)의 `balances_latest`와 공식 Body 명세다. 코드를 설치/실행하지 않는다. 성공/빈 응답/요청거절/인증·서버오류/응답초과/UNKNOWN을 분리한다. 실패하면 소비를 유지하고 즉시 종료하며 추가 호출하지 않는다.

## 검증과 다음 단계

가상 transport로 정확한 요청·원문/숫자 lexeme 보존·기존 전체 archive 보존·fresh authorization 재소비 차단·동시 lock·만료·키/승인/계획/이전 archive 변경·timeout/응답유실·오류·2MiB 경계를 검증한다. 실제 호출 전 `npm run check`를 통과한다. 실행 후에는 성공한 기존 표본의 목적별 사용 가능성·누락을 오프라인으로 정리한다. 추가 인증 호출·DB/UI 전환은 이 승인에 포함하지 않는다.

Lead `fbddee9c36e94afd9b51768d6384d860`의 `proceed` 조건을 반영했다. 고정 프로필·프로필별 slot/key/report·manifest 제외 allowlist·기본 plan 해시 불변과 중복/유실/경계 검사를 유지한다.

## 실제 결과

실행 완료는 UTC `2026-10-23T23:42:03.995Z`(한국 날짜2026-10-24)다. **HTTP200 JSON, 실제1HTTP/0run·283389bytes·재시도0·추가페이지0**이며 기존 전체 archive manifest를 보존했다. 새 슬롯은 소비됐고 재실행하지 않는다. 승인 계획 SHA-256은 `1c99cd59dc8273b62567dfcd81ec604f260a0448147fa45b44e886157fdb5b00`이다. 이전 관련 실제 누적19run/116HTTP에서19run/117HTTP가 됐으며 조직/다른 작업의 전체 사용량은 아니다. 비용은 계속 UNCONFIRMED다.

원문의 items는543개였고 비어 있지 않은 cursor는 관측하지 않았다. USDC 토큰 컨트랙트 주소의 자산 항목 표본이며 USDC543개·고객 지갑·완전한 보유자 목록을 뜻하지 않는다. 기존 단일객체 HTTP400은 그대로 두고 배열 요청 성공을 별도 근거로 보존한다. 원문·승인·키 hash·개별 증거는 비공개 `.state`에만 있다. 추가 인증 호출 없이 [성공 표본 활용 순서](../research/provider-data-use-priorities-2026-10-24.md)와 가격3종의 오프라인 필드 관측으로 넘어갔다.
