# 승인 철회 검증 결과

2026-10-19. ERC20-010 v1.0.0 / ALLOWANCE를 신규 사설 Anvil Fixture에서 실행했다. 유한 승인 10000n 확인 후 approve(spender,0)의 receipt·반환·Approval 0·실제 allowance 0·샘플 잔액/supply 불변을 검사한다. 철회 확인 뒤 기존 spender가 1n을 전송하는 probe로 거부와 상태 무변경을 관측한다. [정확한 판정과 한계](adr/0010-allowance-revocation.md).

## 집중 결과

| Fixture | ERC20-010 | 실제 관측 |
|---|---|---|
| StandardToken / NoReturnToken / FeeToken / ZeroResetToken | 각각 PASS | 승인·철회 확인, probe REVERT+실패 receipt, 샘플 상태 무변경 |
| FalseReturnToken / MalformedReturnToken | 각각 INCONCLUSIVE | 최초 승인 FALSE/MALFORMED, 철회·probe 미시도 |
| ApprovalNoEventToken / ApprovalWrongAllowanceToken | 각각 INCONCLUSIVE | 최초 승인 전제 미확인, 철회·probe 미시도 |
| RevokeFalseToken / RevokeRevertToken / RevokeMalformedToken | 각각 FAIL | 철회 반환 FALSE/REVERT/MALFORMED, probe 미시도 |
| RevokeNoEventToken | FAIL | 철회 Approval 0 누락, probe 미시도 |
| RevokeResidualAllowanceToken | FAIL | 철회 후 allowance 10000 잔존, probe 미시도 |
| RevokeMutatingToken | FAIL | 철회 중 owner→spender 1 unit 이동, probe 미시도 |
| RevokedAllowanceBypassToken | FAIL | allowance 0에도 probe TRUE, owner→recipient 1 이동 |
| RevokedFalseMutatingToken | FAIL | probe FALSE·성공 receipt에도 실제 1 이동 |
| RevokedFalseToken | PASS | probe FALSE·성공 receipt, 상태 무변경·Transfer 없음 |
| RevokedMalformedToken | FAIL | probe 반환 MALFORMED |
| RevokedFalseEventToken | FAIL | probe FALSE·상태 무변경이어도 Transfer 1 발생 |
| RevokedTrueToken | FAIL | probe TRUE·성공 receipt, 거부 조건 미충족 |
| RevokedMalformedEventToken | FAIL | probe FALSE·상태 무변경이어도 Transfer signature의 잘못된 ABI 로그 발생 |

21종의 집중 결과는 PASS 5 / FAIL 12 / INCONCLUSIVE 4다. NoReturnToken의 EMPTY는 기존 호환성 정책이며 bool ABI 준수를 의미하지 않는다. 모든 승인·철회·probe는 별도 transactionHash/receipt와 토큰 로그에 연결한다. Transfer signature의 raw 로그는 디코딩에 실패해도 PASS를 차단한다. requested 1n은 JSON 문자열 "1"이고, 승인·철회 인자의 10000n/0n도 십진 문자열이다.

테스트는 종료 후 owner/recipient/spender 잔액과 allowance·supply 및 다음 양수 시나리오의 시작 상태를 확인한다. 잘못 이동한 상태와 기존 승인까지 snapshot으로 복원한다. 기본 7종 Fixture 구성은 유지했다.

## 오류 및 모순 주입

실제 신규 StandardToken을 자체 Anvil로 전달하는 로컬 HTTP harness에서 8개 오류/모순 경로를 별도로 검증했다. 아래 값은 명시적인 테스트 주입이며 실제 토큰의 반환 특성으로 보고하지 않는다.

- 철회 preflight RPC 실패, probe preflight transport 단절, probe 후 allowance RPC 실패/잘못된 ABI 응답: INCONCLUSIVE/ERROR. 완료한 거래의 증거만 남고 후속 관측을 0으로 채우지 않는다.
- probe 사전 TRUE/EMPTY/FALSE를 주입했으나 실제 receipt는 실패: INCONCLUSIVE/COMPLETED. 실패 receipt만으로 거부 성공을 선언하지 않는다.
- probe 사전 MALFORMED와 실제 실패 receipt: 관측된 반환 호환성 실패로 FAIL이다.

모든 경우 기존 승인/상태가 복원되고 다음 양수 allowance 검사가 PASS함을 확인한다. 외부 read-only의 새 항목은 NOT_TESTED/NOT_EXECUTED/UNKNOWN이며 쓰기 RPC는 없다.

## 관측 범위

PASS는 이번 철회 조건과 후속 거부의 관측이다. 항상 거부하는 토큰도 probe를 거부할 수 있으므로 철회가 거부를 유발했다는 인과 관계는 증명하지 않는다. 다른 입력·계정·대체 권한·모든 상태·일반 안전성과 최종성은 미검증이다. preflight는 채굴 반환 데이터가 아니다.

Lead `3d1670071dff43d4b5e50541db17e288`의 revise_plan 응답을 회수하고 반환/receipt 일치, 새로운 probe 기준 상태, 단계별 미시도 표시 및 인과 주장 제한을 반영했다. 추가 Agent를 생성하지 않았다.

## 최종 회귀와 CLI

`npm run check`는 타입 검사 및 테스트 42개 모두 통과했다(실패/skip 0). 잘못된 ABI의 raw Transfer signature 검증까지 포함한 최종 실행 결과다.

| 실제 실행 프로필 | PASS | FAIL | INCONCLUSIVE | 총 결과 | 종료 코드 |
|---|---:|---:|---:|---:|---:|
| baseline | 64 | 5 | 22 | 91 | 2 |
| exact-receipt | 61 | 8 | 22 | 91 | 2 |

`npm run --silent lab -- --out reports/baseline.json` 및 `--profile exact-receipt --out reports/exact-receipt.json`을 각각 실행했다. FalseReturnToken의 기존 FAIL 5건은 유지되고 새 철회 검사는 최초 승인 전제 미충족으로 INCONCLUSIVE다. exact-receipt는 FeeToken의 기존 양수 검사 3건을 추가 FAIL로 판정한다. 종료 코드 2는 의도한 부정 Fixture의 관측 결과이며 자동 테스트 실패가 아니다.

기본 두 JSON과 `reports/allowance-revocation-local.json`의 보고서 계약·증거 참조·EVM 블록 참조·현재 Fixture 소스 해시·0600 권한을 확인했다. 집중 증거 envelope는 build/배포 receipt/bytecode와 21종의 전체 평가 273건을 담는다. CLI LabReport와 다른 보조 형식이며 생성 JSON은 Git에서 제외한다. 기존 0 transfer/transferFrom 집중 결과는 회귀에서 유지된다.

이전 77/84건 집계는 당시 기록으로 남긴다. 실제 Mainnet USDC/USDT 보고서는 재조회·소급 수정하지 않았다. 이번 상태 변경은 모두 프로그램이 생성한 사설 Anvil의 신규 Fixture에 한정했다.
