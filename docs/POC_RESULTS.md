# 첫 세션 PoC 실행 결과 (보강 전 기록)

실행일: 2026-10-19. 신규 독립 Git 저장소에서 구현했다. 기존 Kit 코드를 사용하지 않았다. Phase 1의 로컬 ERC-20 PoC 완료. 원격 저장소 생성/배포는 하지 않았다.

## 환경과 선택

TypeScript strict / Node.js 25.2.1 / viem 2.57.7 / solc-js 0.8.37 / Anvil 1.7.1. Shanghai EVM, chain ID 31337. 단일 애플리케이션과 bigint 기반 금액 연산으로 SDK 연계와 개인 개발 생산성을 우선했다. [ADR](adr/0001-stack.md)에 네 언어와 12개 기준 비교를 기록했다.

## 실제 실행

- `npm run check`: strict 타입 검사와 자동 테스트 **8개 통과, 실패 0, 건너뜀 0**. 6개 unit test와 2개 integration test 그룹이며, 그룹 안에서 다수 Fixture·시나리오·입력 오류를 검증한다.
- 자동 통합 테스트: baseline 2회 + exact-receipt 1회에 각각 7개 Fixture. 추가 negative/standard Fixture 4개. 총 25개 로컬 assessment, 별도 read-only 정상/오류 검사. 동일 프로필의 verdict/support/주소/주요 관측 금액·승인 제약을 비교한다.
- 추가 negative 검증: 잘못된 주소, chain ID 불일치, EOA, 잔액 부족, allowance 부족, false, malformed 반환값, 이벤트 누락, metadata revert/잘못된 ABI/상위 RPC 장애, 증거 누락. read-only의 RPC 호출 허용 목록도 확인했다.
- CLI: baseline/exact-receipt 보고서 파일 생성. 도움말 및 잘못된 profile 입력의 종료 코드 1 확인.
- `npm audit`: 취약점 **0건**. tmp 0.2.7 override 적용 후 컴파일 및 전체 테스트 통과.

## 생성 보고서

프로젝트 루트 기준:

- `reports/baseline.json`
- `reports/exact-receipt.json`

각 파일에 전체 raw RPC 증거, receipt/log, 디코딩 결과, 시나리오 증거 참조, identity, capability summary, 관측 시점과 블록, compiler/source hash/bytecode를 저장했다. 생성물은 기본 Git 제외다. 파일을 보관하거나 다른 환경으로 공유할 때는 별도 복사한다.

| Fixture | baseline PASS | FAIL | INCONCLUSIVE | 주요 발견 |
|---|---:|---:|---:|---|
| StandardToken | 7 | 0 | 2 | 정상 transfer/approve/transferFrom |
| NoReturnToken | 7 | 0 | 2 | EMPTY 반환, 상태·이벤트로 실행 확인 |
| FalseReturnToken | 2 | 4 | 3 | 성공 receipt와 FALSE, 잔액·승인 무변경 |
| FeeToken | 7 | 0 | 2 | 10000 요청·차감, 9900 수취, supply 100 감소 |
| ZeroResetToken | 7 | 0 | 2 | nonzero→nonzero 거부, zero→재승인 성공 |
| PausableToken | 8 | 0 | 1 | owner 제어, 전송 차단·복구, 무권한 거부 |
| BlacklistToken | 8 | 0 | 1 | blacklist 전송 차단·복구, 무권한 거부 |
| 합계 | **46** | **4** | **13** | 63개 시나리오 결과 |

exact-receipt에서는 FeeToken의 ERC20-002/004/006만 추가 FAIL이다. 합계 **PASS 43 / FAIL 7 / INCONCLUSIVE 13**. 두 lab 명령은 발견된 FAIL이 있으므로 종료 코드 2다. 자동 테스트는 의도한 판정을 확인했으므로 종료 코드 0이다.

13개 INCONCLUSIVE는 실행 오류가 아니다. 실제 제어를 확인하지 못한 Pause/Blacklist 12개와 성공 전송이 없는 false 토큰의 수수료 검증 1개다. 일반적인 setter 실패로 다른 통제 기능까지 없다고 결론내리지 않는다. false 토큰은 승인 변경을 성공시키지 못했으므로 zero-reset 요구 여부도 UNKNOWN이다.

## 판정의 한계

- PASS는 해당 샘플 조건만 의미한다. 발행사·자산 안전성·규제·준비금·상환·서비스 승인은 평가하지 않았다.
- 로컬 self-contained Fixture만 상태 변경했다. 실제 USDC/USDT, 원격 RPC 자산 분석, fork/테스트넷 거래, Controlled Execution은 미실행이다.
- proxy/implementation 탐지, 범용 관리자 권한 탐지, mint/burn, sweep, 최종성, 인덱싱과 대사는 미구현이다. 관련 capability는 UNKNOWN/NOT_TESTED다.
- 이벤트와 metadata 일부를 확인했지만 운영 수준의 Event/Supply/Decimal capability 전체를 통과 처리하지 않는다.
- 함수 반환값은 거래 전 동일 입력의 eth_call 관측이다. 영수증의 반환값으로 오인하지 않는다. 실행 당시 잔액·이벤트와 교차 확인한다.
- 실행마다 assessment ID와 관측 시간이 달라진다. 재현성은 바이트 단위 보고서 동일성이 아니라 판정·지원·주소·주요 수량/제약의 동일성이다.
- TRON/Solana Adapter, 제품 LLM, 전문 웹 대시보드는 구현하지 않았다.

## 다음 작업

Phase 1을 보강하며 격리된 fork 실행 정책, 실제 USDC/USDT read-only 조사, proxy/authority 증거 수집과 보고서 스키마 호환성을 먼저 검토한다. 이후 TRON 환경을 실증하고 같은 도메인에 TRC-20 시나리오를 추가한다. 현재 코드를 운영 자산 상태 변경에 사용하지 않는다.

이 문서는 첫 세션의 당시 실행 기록이다. Proxy 보강 후 현재 결과/제약은 [PROXY_RESULTS.md](PROXY_RESULTS.md)를 참고한다. reports/baseline.json과 exact-receipt.json은 최신 실행으로 갱신된다.
