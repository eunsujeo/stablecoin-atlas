# Allium 실제 비용 증거 제공 가능성 — 공개 문서 조사

확인일: 2026-10-23. 사용자 후속 진행 요청에 따라 공개 공식 문서만 읽었다. 인증 계정 화면·CSV·청구서·계약은 확보하지 않았고 인증 API·usage·SQL을 실행하지 않았다. 공급자 연락도 하지 않았다. 아래는 문서 열람 기록이며 계정별 응답이나 원문 바이트 보존 증거가 아니다.

## 결론

조직 사용량 집계 API, 사용량 CSV 내보내기, Explorer EU 한도와 초과 사용 제어는 **공개 문서에 설명되어 있다**. 해당 계정의 지원·설정·적용 상태는 UNCONFIRMED다. [ADR0074](../adr/0074-cost-attribution-evidence-contract.md)가 요구하는 요청별 정확 비용·불변 항목·특정 usage 버전의 포함·정정 계보·반영 최종성은 이번 문서에서 확인하지 못했다. 기능 부재로 단정하지 않는다.

실제 전환은 TRANSITION_BLOCKED·P UNKNOWN·b_i null·c_i=0을 유지한다. 가상 검토의 CONSISTENT_SYNTHETIC_CONTRACT는 실제 증거 확보가 아니다. 기존 [ADR0075](../adr/0075-read-only-synthetic-cost-evidence-review.md)의 UTC 전용 검토는 미국 동부 시간의 실제 기간을 처리한다고 볼 수 없다.

## 공식 출처와 명시 사실

모든 출처의 확인일은 위와 같다. 아래 관련 절의 설명을 요약했으며 개인 계정 화면을 열지 않았다.

| 공식 문서·관련 절 | 문서에 명시된 사실 |
| --- | --- |
| [Get organization usage](https://docs.allium.so/api/account/get-organization-usage) — Billing period vs. allocation period / Trial organizations / Legacy credits plans / Response | 현재 할당기간의 조직 집계다. 청구는 월별이고 할당은 월별 또는 연별일 수 있다. 연별 소비는 연간 누계다. 주기 할당 없는 trial은 소비가 현재 청구기간 기준이며 할당 필드를 무시할 수 있다. 응답에는 청구/할당 시작·끝과 할당/소비 수량이 있고 할당기간·cadence는 null 가능하다. 이전 플랜은 EU/DU 대신 credits를 사용한다. |
| [Usage and billing](https://docs.allium.so/app/organization-management/usage-and-billing) — Usage / Billing / Overage settings | 사용량을 일별/합계로 보고 CSV로 내보낼 수 있다. Explorer는 사용자·compute profile·상태·출처별 분류를 제공한다. 날짜는 미국 동부 시간이며 반올림으로 청구서와 차이 날 수 있고 청구서가 최종 금액이다. Subscription의 Explorer 초과 사용은 차단/무제한/비율 제한을 선택할 수 있으며 고정 EU 초과 한도는 support가 설정한다. |
| [Usage limits](https://docs.allium.so/app/organization-management/usage-limits) — Add a cap / How caps count | 관리자가 조직/기본 구성원/개별 구성원 EU 한도를 일·주·청구기간별로 설정할 수 있다. 도달하면 reset까지 Explorer 조회가 차단된다. reset은 미국 동부 시간의 일 자정·월요일·월별 청구기간 경계다. 새 한도는 설정 이후 사용량부터 세며 편집은 누계를 유지한다. |
| [Run query](https://docs.allium.so/api/explorer/run-query) — Key Parameters / Data Export Limit / Response | 실행 응답은 run_id를 제공한다. 행 제한과 compute profile을 지정할 수 있다. 문서의 데이터 export 행 제한은 비용 상한을 설명하는 항목이 아니다. |
| [Fetch query run status](https://docs.allium.so/api/explorer/fetch-query-run-status) — Query Run Statuses / Response | created·queued·running·success·failed·canceled는 실행 상태다. success는 조회 실행 성공을 뜻한다. |
| [Fetch query run results](https://docs.allium.so/api/explorer/fetch-query-run-results) — Response Fields | sql·data·meta.columns·queried_at을 설명한다. queried_at은 실행 시각이며 결과 metadata는 열 이름과 타입을 설명한다. |
| [Compute Profiles](https://docs.allium.so/app/query-management/compute-profiles) — Profile Sizes | profile 크기는 속도와 비용에 영향을 준다. 크기별 credits 배수를 설명하며 실행 속도는 보장하지 않는다. 이 설명을 계정의 EU 절대 단가나 실행별 상한으로 환산하지 않는다. |

탐색에는 [공식 문서 목록](https://docs.allium.so/llms.txt)을 사용했다. Programmatic query workflow의 HTML과 목록에 있는 Markdown URL은 도구에서 `Internal Error`로 열람하지 못했다. 상세 오류는 각각 `URL https://docs.allium.so/api/explorer/query-workflow is not accessible via this tool.`와 `URL https://docs.allium.so/api/explorer/query-workflow.md is not accessible via this tool.`였다. HTTP 상태·프록시 차단 증거는 제공되지 않았으므로 정책 차단이나 문서 삭제로 단정하지 않는다. 해당 본문은 결론의 근거에서 제외했다.

## 내부 계약과의 대조 — 조사자의 해석

다음 판정은 위 공개 문서를 ADR0074에 대조한 해석이다. ADR0074의 필드가 공급자 응답 스키마라는 뜻은 아니다.

| 내부 요구 | 이번에 확인한 범위와 남은 증거 |
| --- | --- |
| 안정 조직 identity·키 소속/유효기간 | 조직 집계라는 설명만으로 키 교체 전후의 동일 조직과 유효기간을 입증할 수 없다. 계정별 근거 UNCONFIRMED. |
| 청구·할당·한도기간 각각의 identity와 경계 | 서로 다른 기간·trial·연별 누계를 구별할 근거는 있다. 한도 생성 시점과 지역 시간 규칙을 포함하는 실제 설정 이력은 미확보다. |
| 원래 시간대·DST·기간 연결 | 미국 동부 시간이라는 설명을 고정 UTC offset으로 바꾸지 않는다. 정확한 zone 식별자·DST 처리·경계 포함 규칙은 미확인이다. UTC로 이름만 바꿔 ADR0075에 넣지 않는다. |
| 정확 EU와 단위/정밀도 | credits와 EU를 혼용하지 않는다. 사용량 화면과 청구서의 반올림 차이가 가능하므로 CSV 수치만으로 정확 EU를 인증할 수 없다. 원래 정밀도·반올림 정책은 미확인이다. |
| 요청별 과금 항목·예약/송신 연결 | run_id는 실행 식별의 후보일 뿐 과금 항목 identity가 아니다. create/run/status/results/usage별 과금 범위·상한·실패/취소 비용과 예약 연결은 미확인이다. |
| usage 항목 포함 집합·조직 전체 범위 | 사용자/출처별 집계와 CSV 경로는 자료 확보 후보이다. CSV 열·run_id·항목별 EU·다른 소비자/과거 배분 범위는 실제 파일 없이 확정하지 않는다. 집계 증분으로 귀속시키지 않는다. |
| 불변 버전·갱신 지연·최종성 | 집계의 갱신 주기·최대 지연·진행 중 비용 포함 시점·항목별 확정 버전은 미확인이다. 청구서 최종 금액이라는 설명은 각 항목이 특정 usage에 최종 포함됐다는 보증으로 확대하지 않는다. |
| 중복 식별·정정/취소·이전 버전 | 조직 공통 항목 identity·버전 계보·정정/취소 정책과 기존 배분 이력은 미확인이다. 별도 CSV/hash·새 기간이 새 과금 항목을 뜻하지 않는다. |
| 실제 공급자 한도 강제 | 공개 기능 설명은 확인했으나 계정의 플랜·활성 값·적용 시작·다중 실행 중 경합/초과 허용 폭은 미확인이다. 공급자 강제 통제는 계속 UNCONFIRMED다. |

## 후속 자료 요청 초안과 승인 경계

다음은 보낼 수 있는 질문의 초안이며 발송하지 않았다. 계정 관리자/공급자가 제공할 수 있는 기존 자료의 범위를 먼저 확인하는 것이 권고다.

1. 조직과 키의 소속/유효기간, 실제 플랜 및 청구·할당·한도 설정 이력을 어떤 자료로 제공할 수 있는가? 미국 동부 시간의 zone·DST·경계와 한도 생성 시점은 무엇인가?
2. 기존 사용량 CSV/명세에 불변 과금 항목 ID·run_id·operation·정확 EU·비용시각·원래 정밀도·다른 소비자 범위가 있는가? 각 HTTP operation과 실패/취소 비용의 포함 범위는 무엇인가?
3. 항목이 특정 usage 버전에 포함됐음을 어떻게 확인하는가? 갱신 지연·확정 시점·불변 버전·정정/취소 및 청구서와 집계의 연결 근거는 제공되는가?
4. 한도와 초과 사용 차단이 해당 계정에 언제부터 적용되는가? 이미 진행 중인 조회와 동시 요청이 상한을 넘길 수 있는가?

다음 권고 단위는 **사용자가 제공한 기존 CSV/명세/설정 근거의 비공개 오프라인 사전 목록 검토**다. 아직 원문 import·parser·실제 증거 판정 기능은 구현하지 않는다. 자료 제공 가능성이 확인되면 파일 종류·민감정보·허용 저장 위치·검토 범위를 사용자와 정한다. 원문·키·계정 식별값은 Git/웹에 게시하지 않는다. 이 조사만으로 새 인증 호출·계정 설정 변경·공급자 연락·실제 claim/배분/차감·운영 전환을 시작하지 않는다. 후속 Fixture 구현도 별도 사용자 확인 대상이다.

Lead `6b6fe9dee5ff40a6ab441a592f01abc1`의 proceed 조건에 따라 공개 명시 사실과 내부 해석·미확인을 구분했다. 문서만 변경했으며 검증 명령과 결과는 이번 인계문에 기록한다.
