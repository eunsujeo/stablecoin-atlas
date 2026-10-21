# 저장된 공통 보고서 검증

`validate`는 AssessmentReport1.0 JSON의 schema와 내부 정합성을 오프라인 검사한다. RPC나 키 없이 실행하며 입력 파일을 수정하지 않는다.

```sh
npm run validate -- --file reports/usdc-readonly.json
npm run validate -- --file reports/solana-usdc-assessment-readonly.json
npm run validate -- --file reports/xrpl-rlusd-assessment-readonly.json
```

통과 결과는 `valid:true`, 고정 scope `SCHEMA_AND_INTERNAL_CONSISTENCY_ONLY`, 빈 issues 배열이다. 실패 시 고정 오류 코드와 위치를 JSON으로 반환한다. 입력 값·동적 key·파일 경로·RPC URL·서버 오류문은 출력하지 않는다.

| 종료 코드 | 의미 |
|---|---|
| 0 | 보고서 형식과 내부 계약이 유효함. 시나리오 FAIL이 있어도 유효한 보고서라면0 |
| 2 | JSON/UTF-8/schema/내부 계약 오류 또는 크기·깊이 제한 초과 |
| 1 | 옵션/파일 접근/입력 종류/인프라 오류 |

**valid는 보고서 정합성만 뜻한다. 자산 PASS·출처 진위·온체인 사실·증거 위조 탐지·안전성·취급 승인이 아니다.** 기존 assess의0/1/2와 의미를 구분한다.

## 검사 내용

공통 schema의 XRPL 통화 식별/NA 필드 조건을 포함해 다음을 검사한다.

- evidence ID와 시나리오+capability 쌍의 유일성
- 루트/시나리오의 assessment ID·자산 identity 일치
- 증거 참조 존재, PASS/FAIL의 OBSERVED 근거 존재
- 유한 timestamp와 시작/종료 순서
- 실제 결과에서 계산한 capabilitySummary 일치

금액 표현은 schema의 십진 문자열 조건을 적용한다. Solana 공급량 관측의 선택 필드 `observations.supplyRaw`도 값이 있으면 `0` 또는 앞자리0 없는 비음수 십진 정수 문자열이어야 한다. 숫자형·지수·부호·공백·소수·null은 거부하며 자동 변환이나 기본0 삽입은 하지 않는다. 필드가 없는 미관측 보고서는 허용한다. 이 공통 형식 검사는 u64 범위나 raw mint/evidence와 값의 일치를 검사하지 않는다. 정의된 additive 필드·배열 순서 차이는 허용한다. 시간 검사만으로 체인 시점·finality를 인증하지 않는다.

schemaVersion은1.0을 유지한다. 이전 검증기에서 누락된 `supplyRaw` 규칙 때문에 통과했던 잘못된 문서는 이제 거부된다. 소비자도 갱신된 schema를 사용해야 하며, 모든 기존 문서의 하위 호환을 보장한다는 뜻은 아니다.

입력은 엄격한 UTF-8, 최대10MiB, 최대128단계다. 문자열 내부 괄호와 escape를 구분하고 같은 object의 decoded JSON key 중복을 거부한다. 문법은 JSON.parse로 판정한다. schema는 로컬 고정 파일만 사용한다.

파일은 nonblocking/no-follow로 열고 같은 FD에서 regular file을 확인해 읽는다. 마지막 경로 요소 symlink·디렉터리·FIFO는 입력 오류다. 부모 경로 전체의 symlink를 차단하는 기능은 아니다. 읽기 중 파일이 커져도10MiB+1까지만 받아 상한을 검사한다. 오류는 최대32개이며 더 있으면 issueLimitReached로 표시한다.

file 또는 help만 받으며 중복/빈 file·위치 인자·out 등 다른 옵션은 거부한다. LabReport wrapper·별도 research JSON은 공통 AssessmentReport가 아니므로 자동 변환하지 않는다. 사설 TVM 보고서는 기존 `tvm:validate`를 사용한다.

## 실제 저장 파일 확인

[오프라인 검증 기록](research/common-report-validation.json)에 Ethereum USDC/USDT/RLUSD, TRON USDT, Solana USDC/USDT, XRPL USDC/RLUSD의8개 공통 보고서 입력 hash·검증 결과를 연결했다. 외부 RPC0회이며 입력 bytes가 그대로임을 확인한다. 예전과 새 보고서를 모두 현재 schema로 검사하므로 이전 고정 schema 소비자는 XRPL 확장을 수용하도록 갱신해야 한다.

근거 참조·identity·summary가 잘못된 보고서와 정상 FAIL, JSON/UTF-8/중복 key/크기/깊이/특수 파일, 오류문 비밀 비노출·오류 개수 상한·입력 보존·네트워크 미접속을 검증한다. [ADR0031](adr/0031-offline-assessment-report-validator.md)에 구현 경계를 기록했다.

검증 완료: 저장된8개 자산 보고서 모두 통과·입력 hash 보존, 검증 테스트6개 포함 전체 `npm run check`206개 통과·실패/skip0. 검증 과정의 외부 RPC는0회였다.
