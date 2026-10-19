# Phase 1 — 0 금액 전송 관측 결과

실행일: 2026-10-19. 신규 `ERC20-008 v1.0.0` / TRANSFER를 사설 Anvil Fixture에서 검증했다. 양수 전송과 다른 입력을 별도 snapshot에서 관측한다. 기본 7종 Fixture와 기존 시나리오 의미는 유지한다.

아래 집계는 ERC20-008 추가 당시의 77건 기록이다. 후속 ERC20-009는 [0 transferFrom 결과](ZERO_TRANSFER_FROM_RESULTS.md), 최신 91건 CLI 집계는 [승인 철회 결과](ALLOWANCE_REVOCATION_RESULTS.md)에 기록했다. 생성 JSON은 최신 회귀 실행으로 갱신되며 ERC20-008의 집중 결과는 동일하다.

## 새 판정 조건

`transfer(recipient, 0n)`의 사전 반환값 TRUE/EMPTY, 채굴 성공, 해당 토큰의 엄격히 디코딩된 `Transfer(owner, recipient, 0)`, 두 계정 잔액 및 샘플 totalSupply 무변경이 모두 필요하다. 0 잔액 변화만으로 성공하지 않는다. EMPTY는 기존 호환성 정책이며 엄격한 bool ABI 준수나 채굴된 반환 데이터의 직접 증거는 아니다.

| 추가 검증 샘플 | 0 전송 결과 | 관측 |
|---|---|---|
| StandardToken | PASS | TRUE, receipt 성공, 0 이벤트, 샘플 상태 무변경 |
| NoReturnToken | PASS | EMPTY, receipt 성공·이벤트·샘플 상태로 보완 |
| FeeToken | PASS | 이 샘플에서는 0 이벤트·상태 무변경; 일반적인 수수료 부재 주장은 아님 |
| FalseReturnToken | FAIL | receipt 성공이어도 FALSE·이벤트 없음 |
| MalformedReturnToken | FAIL | 상태/이벤트가 맞아도 MALFORMED |
| MissingEventToken | FAIL | 0 이벤트 없음 |
| ZeroTransferRevertToken | FAIL | 양수 전송 성공과 별개로 0 전송 거부·receipt 실패 |
| ZeroTransferNoEventToken | FAIL | 양수 전송 성공, 0 이벤트만 누락 |
| ZeroTransferMutatingToken | FAIL | 0 이벤트를 내지만 실제 1 unit 이동 |

부정 Fixture는 테스트 전용이며 기본 lab 목록에 추가하지 않았다. 전체 assessment에서 ERC20-008 직후 양수 전송의 시작 잔액이 복구돼 있는지, 종료 후 Fixture 초기 잔액·supply가 유지되는지 확인한다. RPC/transport 오류를 사전 호출에 주입하거나 전송 후 잔액 조회 실패/malformed 응답을 주입하면 `INCONCLUSIVE/ERROR`, support UNKNOWN이다. 이때 관측하지 못한 상태를 0이나 정상으로 채우지 않는다. 다음 시나리오는 정상 상태에서 검증한다.

## 기본 CLI 결과 갱신

| 프로필 | PASS | FAIL | INCONCLUSIVE | 총 결과 |
|---|---:|---:|---:|---:|
| baseline | 52 | 5 | 20 | 77 |
| exact-receipt | 49 | 8 | 20 | 77 |

`npm run lab -- --out reports/baseline.json`과 exact-receipt 명령을 실제 실행했다. 두 종료 코드 2는 의도한 Fixture FAIL 검출이다. 이전 70건에 0 전송의 PASS 6 / FAIL 1이 추가됐다. exact-receipt의 기존 양수 수취량 정책 차이는 유지한다. 두 JSON의 계약·증거 참조·블록 참조 및 POSIX 0600 권한도 검증했다.

추가 로컬 증거는 `reports/zero-transfer-local.json`이다. 테스트용 보조 envelope로 build/source hash, 배포 receipt/bytecode 및 위 9개 Fixture의 전체 baseline assessment를 담는다. 각 assessment는 Report 1.0 계약을 따른다. 기본 lab CLI envelope와 같은 형식이라고 가정하지 않는다. 생성 파일은 Git 제외 대상이다.

## 범위와 제한

PASS는 해당 샘플 0 전송 조건이며 자산 안전성·취급 승인·모든 계정/금액에서의 전송 성공이나 수수료 부재가 아니다. ERC20-008은 transferFrom의 0 전송과 zero address 수취인을 검증하지 않는다. 지원 여부와 시나리오 판정을 구분한다. 관측 실패의 support는 UNKNOWN이지 NOT_SUPPORTED가 아니다.

외부 read-only에는 ERC20-008이 NOT_TESTED/NOT_EXECUTED로 한 건 추가된다. 상태 변경 RPC는 추가하지 않았다. 과거 USDC/USDT 보고서는 당시 결과를 유지하며 이번 로컬 0 전송을 실제 자산 검증으로 대체하지 않는다. [명세와 결정](adr/0008-zero-transfer-scenario.md), [시나리오](TEST_SCENARIOS.md), [보고서 계약](REPORT_CONTRACT.md)을 함께 읽는다.
