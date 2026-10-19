# 0 transferFrom 검증 결과

2026-10-19, 신규 사설 Anvil Fixture에서 실행했다. ERC20-009 v1.0.0 / ALLOWANCE의 결과이며 외부 자산 거래는 없다. 전체 자산 안전성·취급 승인을 판정하지 않는다. [판정 범위](adr/0009-zero-transfer-from-scenario.md).

아래 전체 집계는 ERC20-009 추가 당시 84건 기록이다. 후속 ERC20-010 및 최신 91건 CLI 집계는 [승인 철회 결과](ALLOWANCE_REVOCATION_RESULTS.md)에 기록했다. 생성 JSON은 최신 회귀 실행으로 갱신되며 ERC20-009 집중 결과는 유지된다.

## 집중 검증

| Fixture | ERC20-009 | 실제 관측 |
|---|---|---|
| StandardToken | PASS | 승인 및 0 전송 TRUE, 이벤트·샘플 상태 일치 |
| NoReturnToken | PASS | EMPTY, 승인·전송 이벤트와 상태로 보완 |
| FeeToken | PASS | 이번 0 전송의 샘플 상태 무변경; 수수료 부재 주장이 아님 |
| FalseReturnToken | INCONCLUSIVE | 승인 FALSE·allowance 0, 0 호출 미시도 |
| MalformedReturnToken | INCONCLUSIVE | 승인 MALFORMED, 0 호출 미시도 |
| ApprovalNoEventToken | INCONCLUSIVE | 승인 이벤트 누락, 0 호출 미시도 |
| ApprovalWrongAllowanceToken | INCONCLUSIVE | 승인량 10001, 전제 10000 불일치, 0 호출 미시도 |
| MissingEventToken / ZeroTransferNoEventToken | 각각 FAIL | 승인 확인 후 0 Transfer 누락 |
| ZeroTransferRevertToken / ZeroDelegationRevertToken | 각각 FAIL | 0 호출 REVERT 및 receipt 실패 |
| ZeroTransferMutatingToken | FAIL | 0 이벤트에도 잔액 1 unit 이동 |
| ZeroDelegationConsumesAllowanceToken | FAIL | 잔액·이벤트는 일치하지만 allowance 10000→9999 |
| ZeroDelegationFalseToken | FAIL | 승인 성공 뒤 0 호출 FALSE |
| ZeroDelegationMalformedToken | FAIL | 승인 성공 뒤 0 호출 MALFORMED |

15종의 집중 결과는 PASS 3 / FAIL 8 / INCONCLUSIVE 4다. ZeroDelegation 계열 네 종류는 ERC20-008의 직접 0 전송과 ERC20-004의 양수 delegated 전송에 PASS하면서 ERC20-009에 FAIL한다. 승인 전제 실패는 0 호출의 기능 부재나 실행 실패로 해석하지 않는다.

테스트는 실제 별도 승인/전송 receipt, 호출자 spender와 owner→recipient/0 인자, 토큰 이벤트, 두 잔액·총공급량·allowance 및 십진 문자열 "0"을 확인한다. 시나리오 종료 후 잘못된 상태 변경과 승인까지 snapshot으로 복원하며 이후 양수 검사도 영향을 받지 않는다.

0 호출 preflight의 RPC/transport 장애, 채굴 뒤 allowance 조회의 RPC/malformed 응답 네 경로는 INCONCLUSIVE/ERROR다. 누락 관측을 0으로 대체하지 않고 승인·전송 영수증 수를 확인한다. 외부 read-only의 ERC20-009는 NOT_TESTED/NOT_EXECUTED/UNKNOWN이며 쓰기 RPC가 없다. 0 allowance의 권한 의미·다른 입력·모든 상태·최종성은 검증하지 않았다.

## 실제 CLI 및 회귀 결과

`npm run check`는 타입 검사와 테스트 40개 모두 통과했다(실패/skip 0). 실제 CLI를 각각 실행해 얻은 집계다.

| 프로필 | PASS | FAIL | INCONCLUSIVE | 합계 | 종료 코드 |
|---|---:|---:|---:|---:|---:|
| baseline | 58 | 5 | 21 | 84 | 2 |
| exact-receipt | 55 | 8 | 21 | 84 | 2 |

FalseReturnToken은 기존 5개 FAIL을 유지하고 ERC20-009는 승인 전제 미충족으로 INCONCLUSIVE다. FeeToken은 exact-receipt의 기존 양수 검사 세 항목에서 FAIL이다. 종료 코드 2는 의도한 Fixture의 관측 FAIL이며 자동 테스트 실패가 아니다.

`reports/baseline.json`, `reports/exact-receipt.json`을 이번 실행으로 교체했다. `reports/zero-transfer-from-local.json`에는 컴파일 정보·배포 receipt·bytecode와 15종의 전체 평가 180건이 들어 있다. 이 파일은 집중 검사 증거 envelope이며 CLI LabReport envelope와 구별한다. 기존 `reports/zero-transfer-local.json`도 회귀 테스트가 9종/전체 108건으로 재생성했고 집중 ERC20-008은 PASS 3 / FAIL 6을 유지했다. 모두 보고서 계약·현재 소스 해시·0600 권한을 확인했다. 생성 JSON은 Git에서 제외한다.

이전 [0 transfer 추가 당시 77건](ZERO_TRANSFER_RESULTS.md) 및 실제 Mainnet USDC/USDT 보고서는 당시 관측 기록이다. 외부 RPC는 재조회하거나 보고서를 소급 수정하지 않았다.
