# 스테이블코인 호환성 작업 목록과 완료 기준

2026-10-20 사용자 확정: **서비스를 검증하는 프로젝트가 아니다. 권한은 소스 확인으로 충분하다. 현재 범위의 남은 작업은 추가 확인 없이 진행한다.** [ADR0026](adr/0026-source-based-compatibility-scope.md)이 과거의 서비스 표본·실제 권한 행사 중심 순서를 대체한다.

## 현재 단계의 필수 산출물

| 작업 | 결과와 완료 기준 | 상태 |
|---|---|---|
| 범위 확정 | 서비스 운영·내부 장부·역할 계정 수집·실제 권한 행사를 제외. 실행·소스·공식 문서 근거를 구분 | 완료 |
| 자산별 호환성 표 | [8개 프로필의 근거/공백 및 버전별 조건](STABLECOIN_COMPATIBILITY_MATRIX.md) | 완료 |
| 선택 소스의 권한·전송/승인 검토 | [기존13개 snapshot·21개 findings 및 RLUSD/TRON 보강](research/stablecoin-source-compatibility.json), 함수/조건·hash·줄 범위 연결 | 완료 |
| EVM 엔진·CLI·Fixture·보고서 | [Phase1 완료](PHASE1_COMPLETION.md), 실제 신규 사설 Anvil 테스트 및 오류/상태/반환/이벤트 검증 | 완료 |
| TRON 읽기·사설 TVM 대조 | [읽기](TRON_READONLY.md), [정상·경계·결함 대조](TRON_TVM_RUNTIME.md), [승인/위임 단일 결함10건](TRON_ALLOWANCE_PROBE_EXECUTION.md) | 완료 |
| Solana/XRPL 조사·후속 읽기 | 계정 모델 + [실제 mint](SOLANA_MINT_READONLY.md)·[issuer 설정](XRPL_ISSUER_READONLY.md) 관측. 제품 Adapter는 별도 | 완료 |
| 정합성·회귀 검사 | 출처·줄 범위·기존 보고서 hash·문서 링크 확인, `npm run check` | 완료: 212개 통과, 실패·skip0 |

SOURCE_REVIEWED는 선택 소스의 조건 검토 완료다. 전체 소스/배포 동일성·실제 권한 행사·운영자 인증을 뜻하지 않는다. 지원/판정은 제품 원본 그대로이며 소스 연구 상태로 PASS/SUPPORTED를 만들지 않는다. 관리자·수수료·zero-reset의 존재 자체는 FAIL이 아니다.

## 현재 단계에서 이유를 기록하고 닫는 공백

| 공백 | 현재 처리 | 다시 검토할 조건 |
|---|---|---|
| TRON USDT 제공 소스 보강 | [JSON에서10개 전체 본문·9개 import·10개 findings 검토](TRON_EXPORTED_SOURCE_REVIEW.md), 선택 경로 SOURCE_REVIEWED. 부분 HTML 진단 이력 보존 | 배포 동일성/전달 대상 구현은 별도 공백이며 추가 자료 요구 없음 |
| RLUSD 기존 ZIP의 상속/초기화 차이 | [새 HTML에서35개 Solidity·55개 import 확보 및 선택 상속 검토](RLUSD_EXPLORER_SOURCE_INTAKE.md). 새 V2/ABI 이름 일치, 기존 ZIP 이력 보존 | 배포 동일성·전수 감사는 별도이며 현재 추가 자료 요구 없음 |
| USDC/USDT/RLUSD 배포 bytecode 전체 재현 | source binding UNKNOWN 보존, 선택 소스 검토의 필수 선행조건 아님 | 별도 재현 필요와 자료가 있을 때 |
| TRON 정확한 getter 응답 블록 | UNKNOWN/INCONCLUSIVE 유지; [조사 한계](research/TRON_RESPONSE_BLOCK_BINDING.md) 보존 | snapshot과 실제 상태 블록 연결 근거가 생길 때 |
| 실제 역할 보유자·키 통제·권한 행사 | UNKNOWN/NOT_TESTED 보존, 이번 완료에 불필요 | 본 단계에서 추가 수집·실행하지 않음 |
| USDC 과거 이력 null/4444·RLUSD receipt null | 과거 미확인 이력, 계정 부재로 해석하지 않음 | 새로운 자료 없이 동일 요청·범위·endpoint 변경으로 반복하지 않음 |

이 항목들은 현재 단계의 무기한 대기 작업이 아니다. 신뢰할 자료가 없는 칸은 사실대로 남겨도 정해진 소스 검토를 마감할 수 있다. 검토하지 않은 체인이나 상속 기능을 검토 완료로 표시하지 않는다.

## 보존하는 선택적 도구와 과거 증거

[서비스 문맥 검증기](SERVICE_ACCOUNT_CONTEXT.md), [원본 입력 read-only runner](SERVICE_ACCOUNT_READONLY.md), [8개 입력 템플릿](SERVICE_ACCOUNT_INTAKE.md)은 기존 도구로 남긴다. 이 도구를 사용하기 위해 지갑 주소·운영 목적·spender를 다시 요청하지 않는다. 서비스 내부 장부·입금/출금 대사·실제 수탁 운영 검증은 현재 목표가 아니다.

사용자가 제공한 주소의 [일반 TRON USDT 잔액 관측](TRON_HOLDER_BALANCE_OBSERVATION.md)은 0 USDT 응답·마지막 head HTTP429를 보존한 독립 표본이다. 추가 승인량·계정 조회로 자동 이어가지 않는다.

[정적 증거 인덱스](research/stablecoin-account-evidence.json)는 기존 [카탈로그](research/stablecoin-profiles.json)의14개 보고서·hash와 별도 일반 holder 관측을 보존한다. 사설 Fixture·소스 검토·실제 읽기·프로토콜 조사를 서로의 증거로 바꾸지 않는다.

## 별도 확장 과제

Solana/XRPL 제품 실행 Adapter·SDK·지갑 전체 계정 탐색·delegate 권한 행사·trust-line 변경/Payment 검증, 광범위 Token-2022 확장, 자원 한도/최종성 실험, 서비스 운영 프로필·UI는 현재 단계 완료에 필요하지 않은 별도 확장이다. 새로운 필수 검증 수요가 없는 Fixture/지갑/문서 반복 확장을 하지 않는다.

## 후속 승인: Solana mint 읽기

[별도 연구 도구·실제 관측](SOLANA_MINT_READONLY.md)을 완료했다. genesis 일치 후 단일 finalized context의 두 mint program/설정 관측이며 기존 catalog/보고서 hash를 유지한다. 제품 Adapter·실제 권한 행사·holder/delegate 관측으로 확대하지 않는다. XRPL issuer 설정 읽기는 아래 후속 단계에서 완료했다.

후속 검사: 새4개 테스트 포함188개 통과, 실패·skip0. RPC2회 실제 성공 관측과 로컬 모의 검증을 별도 기록했다.

## 후속 승인: XRPL 발행자 설정 읽기

[별도 연구 도구·실제 관측](XRPL_ISSUER_READONLY.md)을 완료했다. 서버 보고 network_id0 확인 후 동일 validated ledger에서 두 issuer AccountRoot 설정을 RPC4회로 읽었다. 기존 catalog/report 판정과 hash를 보존하며 trust-line·실제 동결/회수·amendment 검증으로 확대하지 않는다.

최신 전체 검사193개 통과, 실패·skip0. 실제 RPC4회 성공 관측, 로컬 오류/경계 검증, 기존 증거 보존을 대조했다.

## 최신 비교표 통합 완료

[8개 프로필 비교표](STABLECOIN_COMPATIBILITY_MATRIX.md)를 현재 소스/관측으로 통합하고 [요약 JSON](research/stablecoin-compatibility-summary.json)에7개 근거 파일의 hash·선택 finding·관측 시점을 연결했다. RLUSD 상속 미확보 시절의 설명은 기존 source JSON 이력으로 보존하며 현재 표에는 새 explorer 검토를 적용했다. 기존 source/보고서/catalog 판정은 바꾸지 않았다. 현재 합의 범위의 필수 미완료 작업은 없다.

통합 검증: 8개 프로필·7개 근거 파일 hash·39개 선택 findings·과거15개 보고서와 최근4개 자산 관측의 일치를 확인했다. 최신 `npm run check`193개 통과, 실패·skip0이며 이번 통합의 새 외부 RPC/거래는0건이다.

## 후속 승인: Solana 공통 체인 연결 모듈

[Solana mint-only ReadOnlyAdapter·공통 assess CLI](SOLANA_ADAPTER.md)를 연결했다. 기존 schema/도메인은 유지하며 선택 mint만 읽는다. USDC·USDT의 새 공통 보고서를 각각 저장했고 기존 연구/과거 보고서와 분리했다. holder/delegate·서명/거래·XRPL 제품 Adapter는 이 단계에 포함하지 않았다.

연결 모듈 단계 최종 검사196개 통과, 실패·skip0. 새 공통 CLI 두 보고서의 schema/identity/evidence/summary 계약과4회 실제 읽기, 기존 증거 보존을 확인했다.

## 후속 승인: XRPL 공통 체인 연결 모듈

[XRPL issuer ReadOnlyAdapter·공통 assess CLI](XRPL_ADAPTER.md)를 연결했다. currency+issuer와 조건부 identity schema를 추가하고 이전 보고서 검증은 유지한다. USDC/RLUSD 새 공통 보고서는 별도 ledger/hash로 저장했다. 구버전 고정 schema 소비자는 XRPL 확장을 수용하도록 갱신해야 한다. trust-line/Payment·잔액/공급량·실제 권한 행사는 추가하지 않았다.

XRPL 연결 단계 최종 검사200개 통과·실패/skip0. 실제 두 공통 보고서(6회 읽기)의 schema/identity/evidence/summary와 독립 ledger, 기존 증거 보존을 확인했다.

## 후속 작업: 공통 보고서 오프라인 검증

[validate CLI](REPORT_VALIDATION.md)를 추가해 저장된8개 프로필의 공통 보고서 schema/내부 정합성을 재검증한다. 기존 test helper의 의미 검사를 production과 공유하며 새 RPC·파일 수정·자산 판정 변경은 없다. 검증 성공을 출처/온체인 사실 인증으로 해석하지 않는다.

오프라인 검증 단계 최종 검사205개 통과·실패/skip0. 저장된8개 공통 보고서가 정합성 검증을 통과했고 입력 bytes/hash를 보존했다.

후속 금액 계약 보정: Solana `observations.supplyRaw`의 누락된 schema 규칙을 추가했다. 선택 필드로 유지하며 값이 있으면 기존 비음수 십진 정수 문자열 규칙을 적용한다. 합성 회귀 표본으로 숫자형·지수·앞자리0·음수·부호·공백·소수·null을 거부하는지 확인하고, schema와 production/오프라인 CLI의 결과를 대조한다. u64 범위·원시 증거 일치 검증이나 새로운 RPC 조회를 추가한 것은 아니다. 이전의 잘못된 문서가 이제 거부되는 계약 보정이다.

금액 계약 보정 후 전체 `npm run check`206개 통과·실패/skip0. 기존8개 공통 보고서 재검증 통과·원본 hash 보존, 과거15개 보고서·39개 소스 findings와 기존 관측 근거의 보존을 확인했다. 이번 수정의 외부 RPC는0회다.

후속 사용자 승인으로 [Solana 명시 Token Account·XRPL holder trust-line 읽기](ACCOUNT_STATE_READONLY.md)를 구현했다. 기존 mint/issuer-only 제외 조건에서 이 설정 읽기만 확장한 것으로, 실제 거래·권한 행사·서비스 운영은 제외한다. 실제 계정 단위 공개망 관측은 NOT_TESTED이며 기존 mint/issuer 보고서와 분리한다.

계정 읽기 확장 최종 검사: `npm run check`212개 통과, 실패·취소·skip0(파일 병렬2). 기존8개 공통 보고서 재검증/원본 hash와 과거15개 보고서·39개 소스 findings를 보존했다. [구현/검증 근거](research/account-state-read-integration.json)에 모의 검증과 실제 계정 관측 NOT_TESTED를 구분한다.

**현재 마일스톤 마감:** [완료 보고](STABLECOIN_MILESTONE_COMPLETION.md). 새 공개 표본4개를14회 읽기로 확인해 Solana Token Account2개 관측과 XRPL 선택 line2개 부재를 기록했다. HTTP/RPC 오류0, 원본 증거 보존·새 보고서 정합성 검증 통과. 현재 필수 미완료 작업은 없으며 양수 XRPL 보유 line·실제 전송/권한 행사 등 남는 한계를 후속 자동 작업으로 계속 늘리지 않는다.

후속 사용자 승인된 [XRPL 양수 보유 trust-line 연구](XRPL_HELD_TRUSTLINE_OBSERVATION.md)를 완료했다. USDC/RLUSD AMM 표본의 잔액·설정을 동일 ledger의 직접 RippleState로 관측했다. 공통 account_lines Adapter는 해당 표본에서3페이지 미완료였으며 기존 INCONCLUSIVE 보고서와 분리한다. 추가 연구18회 읽기·거래0회, 제품 코드/기존212개 검사 이력은 유지한다.
