# TRON 읽기 전용 완료 점검

점검일: 2026-10-19. 대상은 현재 작업 디렉터리의 구현, 테스트와 보존된 JSON이다. 기존 Phase 1 기준 커밋 이후 TRON 변경은 아직 커밋되지 않았으므로 이 문서를 특정 릴리스 인증으로 사용하지 않는다.

주소·metadata·선택 잔액·선택 승인량·CLI/JSON이라는 현재 TRON 읽기 전용 범위의 구현과 검증을 완료했다. TRON 전체 호환성이나 실제 전송·승인 동작의 검증 완료를 뜻하지 않는다. 실행 방법은 [TRON 사용 문서](TRON_READONLY.md), 결정 근거는 [ADR 0011](adr/0011-tron-readonly-adapter.md)과 [ADR 0012](adr/0012-tron-allowance-readonly.md)에 있다.

## 구현과 검증 대응

| 항목 | 구현 근거 | 검증 근거 |
|---|---|---|
| Base58Check/41-prefix 주소 | [주소 변환](../src/tron/address.ts) | 공식 주소 벡터, checksum/prefix/길이 오류, Base58/hex 정규화 |
| 네트워크·코드·조회 전후 head | [TRON Adapter](../src/tron/adapter.ts) | chainId 불일치·형식 오류, 빈/잘못된 code, head 형식·높이 prefix·후행 조회 실패 |
| name/symbol/decimals/totalSupply | TRC20-001 | 빈 labels, decimals 0/255/범위 위반, 최대 uint256, ABI/RPC/transport/envelope 오류·복구 |
| 선택 balanceOf(holder) | TRC20-000 | 0/최대 uint256, holder 생략 시 NOT_TESTED, RPC 오류, 동시 요청 증거 격리 |
| 선택 allowance(owner,spender) | TRC20-007 | pair 인자 순서, 같은 주소 pair, 혼합 주소, 0/최대값, 오류 시 값 부재, pair 생략 시 호출 없음 |
| 입력·읽기 전용 경계 | CLI/Adapter | 잘못된 pair는 RPC 0건, --spender의 EVM/lab 사용 거부, 호출된 RPC와 ABI selector 제한 |
| JSON·증거 참조·집계 | [보고서 계약](REPORT_CONTRACT.md) | Report 1.0, Identity 일치, 증거 참조, 금액 숫자/음수/지수 거부, 요청별 관측 격리 |
| CLI 출력·저장 | [CLI](../src/cli.ts) | stdout JSON, stderr 집계, 종료 코드, 저장 파일 0600, 오류 시 기존 파일 보존 |

위 TRON 검증은 [6개 자동 테스트](../tests/tron-readonly.test.ts)와 공통 [보고서 계약 테스트](../tests/report-contract.test.ts)에 있다. HTTP mock이 반환한 값을 사용하는 테스트이며 TVM에서 계약을 배포하거나 실행한 증거는 아니다. `npm run check`의 타입 검사 및 전체 49개 테스트가 통과했다(실패·skip 0). 기존 EVM 43개 테스트에는 신규 사설 Anvil Fixture의 실제 상태 변화 검증이 포함된다.

## 시나리오별 실제 관측

아래 판정은 보존된 USDT self-pair 보고서 기준이다. 모든 결과의 support와 정확한 응답 블록은 UNKNOWN이다. TRC20-003과 TRC20-007은 같은 ALLOWANCE capability의 별도 시나리오이므로 summary만으로 승인 실행을 추론하지 않는다.

| ID | 대상 | self-pair 보고서 판정 | 해석 |
|---|---|---|---|
| TRC20-001 | metadata | INCONCLUSIVE | 조회·디코딩 성공, 정확한 상태 블록 미확정 |
| TRC20-000 | 잔액 조회 | INCONCLUSIVE | USDT 계약 주소의 TRC-20 잔액을 읽음 |
| TRC20-007 | 승인량 조회 | INCONCLUSIVE | owner=spender=USDT 계약, readStatus OK, allowance 문자열 `"0"` |
| TRC20-002 | 전송 실행 | NOT_TESTED | 거래를 보내지 않음 |
| TRC20-003 | approve/transferFrom 실행 | NOT_TESTED | 승인 설정·사용·철회를 실행하지 않음 |
| TRC20-004 | Proxy/업그레이드 | NOT_TESTED | 실제 위임 대상·권한 미검증 |
| TRC20-005 | 자원 소비 | NOT_TESTED | Energy/Bandwidth/feeLimit 미검증 |
| TRC20-006 | 전송 수수료 동작 | NOT_TESTED | 수취량·공제량 미검증 |

## 보존된 증거

이번 점검은 아래 파일을 로컬에서 검증했다. 새 외부 RPC 조회는 하지 않았으며 두 Mainnet 원본을 수정하지 않았다. Report 1.0 스키마, 증거 참조·Identity·집계, UNKNOWN 블록/지원 상태, 기록된 RPC 종류와 파일 0600을 확인했다. 파일들은 Git 제외 대상이며 새 clone에는 포함되지 않는다.

| 파일 | 증거 종류 | 표본 / 결과 | 판정 집계 |
|---|---|---:|---|
| [tron-usdt-readonly.json](../reports/tron-usdt-readonly.json) | 실제 Mainnet metadata, holder 없음 | 1 / 7 | 1 INCONCLUSIVE, 6 NOT_TESTED |
| [tron-usdt-allowance-readonly.json](../reports/tron-usdt-allowance-readonly.json) | 실제 Mainnet metadata·잔액·self-pair 승인량 | 1 / 8 | 3 INCONCLUSIVE, 5 NOT_TESTED |
| [tron-readonly-mock.json](../reports/tron-readonly-mock.json) | 합성 HTTP Adapter 계약 표본 | 3 / 24 | holder 2개 표본은 각각 2 INCONCLUSIVE/6 NOT_TESTED, 생략 표본은 1/7 |

합성 파일에는 allowance pair를 지정하지 않는다. allowance 정상/오류 검증은 자동 테스트에서 별도로 실행하며 해당 파일을 allowance 실행 증거로 인용하지 않는다. 합성 파일은 테스트마다 갱신된다. 실제 두 파일은 동일 USDT 계약의 다른 시점 관측이며 독립 자산 2종으로 합산하지 않는다.

첫 실제 관측은 2026-10-19T04:27:58.164Z, head 87237018→87237019다. self-pair 관측은 2026-10-19T04:38:48.194Z, head 87237235→87237235다. head가 같아도 응답 상태를 그 블록에 고정했다고 판단하지 않는다. `"0"`은 지정한 pair의 관측값이며 다른 계정의 승인량·향후 위임 전송·자산 안전성을 증명하지 않는다. [공식 주소 출처](research/tron-reference-assets.json)는 DOCUMENTED 근거이고 issuerVerificationStatus는 UNKNOWN이다.

두 실제 원본의 SHA-256(파일 동일성 비교용, 실행 환경·코드 인증용 아님):

```text
tron-usdt-readonly.json
921f85115b92ce5c4e2468e96a7a43c58ed55fd90cf64fd1a304b5acc71d598e
tron-usdt-allowance-readonly.json
7b1cb51b4bbed387ceb1a80161ac81ebe8258bbf2d79a5786ecf822398b92b6f
```

## 남은 작업 순서

1. [읽기 응답 블록 조사 완료](research/TRON_RESPONSE_BLOCK_BINDING.md): 조사한 공식 API·고정 소스에서는 정확한 블록 연결을 확인하지 못했다. UNKNOWN/INCONCLUSIVE를 유지하며, 재검토에 필요한 snapshot·블록 연결 증거와 실험 기준을 기록했다.
2. [다음 실행 단계 준비안 작성](adr/0013-private-tvm-fixture-preparation.md): TVM 후보 도구·로컬 준비 상태·격리 수명과 전송·승인·이벤트·오류·자원 검증 기준을 정리했다. 후속 사용자 승인으로 [기동·격리·정리 실행기](TRON_TVM_RUNTIME.md)를 구현했다. 이후 [정상 Fixture 배포·영수증·초기 상태](adr/0015-private-tvm-fixture-deployment.md)도 구현했다. 이후 [정상 Fixture의 전송·승인·이벤트·철회/미승인 REVERT](adr/0016-private-tvm-token-scenarios.md)도 별도 검증했다. [정상 Fixture의 0 금액·잔액/승인량 경계](adr/0017-private-tvm-boundary-scenarios.md)도 추가했다. [false/malformed 반환·이벤트 누락 transfer Fixture](adr/0018-private-tvm-negative-fixtures.md) 대조를 추가했다. 추가 비표준 approve/transferFrom·자원 평가는 남아 있다. 이 읽기 전용 완료 점검 당시에는 Anvil 전용 경계였으며, 이후 승인된 사설 TVM 예외는 후속 실행기 문서에서 구분한다.
3. 후속 범위: Proxy/권한·최종성·계정 준비·서비스별 운영 프로필은 별도 조사/구현 과제로 남긴다. Solana·제품 내부 LLM·웹 UI는 현재 구현 범위에 포함하지 않는다.

개발용 Router는 이번 문서 점검에서 shadow 추천만 사용했다. 새로운 기술 결정이나 실행 경계 변경이 없어 Lead를 추가 호출하지 않았다. 모델 전환이나 토큰 절감의 측정 결과로 해석하지 않는다.
