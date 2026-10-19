# 요구사항 및 현재 범위

목표는 금융 서비스의 자산 취급 전 기술·운영 호환성을 실행 증거로 검증하는 독립 도구다. 투자 평가, 보안 감사 보증, 최종 자산 취급 승인은 제공하지 않는다. 기존 Blockchain Integration Test Kit과 코드·저장소·실행 환경을 공유하지 않는다.

## Phase 1 필수 요구사항

각 요구사항의 코드·테스트·증거와 완료 범위는 [Phase 1 완료 점검표](PHASE1_COMPLETION.md)에 연결한다.

| 요구 | 구현/검증 |
|---|---|
| 네트워크와 주소 입력 | assess --network/--token, RPC_URL 환경변수 |
| Identity | 주소·체인 ID·관측 블록·시간, metadata, 불명/비적용 구분 |
| balance | 로컬 Fixture 및 외부 --holder 읽기 전용 |
| transfer | 사전 반환값, 실제 거래·잔액 변화·Transfer 이벤트 |
| 0 transfer | ERC20-008, 0 이벤트·샘플 잔액/supply 무변경, 조회 장애와 관측 실패 구분 |
| approve/allowance | 최초·변경·zero-reset 후 재시도·Approval 이벤트 |
| transferFrom | 승인된 수량·실제 수령량·allowance 차감·한도 초과 |
| 0 transferFrom | ERC20-009, 승인 전제 확인·spender 호출·0 이벤트·샘플 잔액/supply/allowance 무변경 |
| 승인 철회 | ERC20-010, approve 0·Approval·allowance 0 및 기존 spender의 양수 probe 거부/샘플 상태 무변경 |
| 반환값/revert | TRUE/FALSE/EMPTY/MALFORMED/REVERT, RPC 오류 코드·로컬 분류·원문 생략 표식 |
| 수수료 | 요청량·차감량·수취량·supply 차이, 프로필 분리 |
| 관리자 제한 | Fixture owner 확인, 무권한 호출 거부, pause/blacklist 설정·차단·복구 |
| 증거 보고서 | assessment/scenario 버전·시점·블록·증거 참조·제약 |
| 자동 검증 | unit + 실제 Anvil integration + negative/regression |

7개 필수 Fixture: Standard, No Return, False Return, Fee-on-Transfer, Zero-reset, Pausable, Blacklist. 추가 Fixture는 잘못된 metadata, 누락 이벤트, malformed 반환값, 0 전송 거부/잘못된 상태 이동, 승인 전제 불일치·철회 실패·allowance 우회 및 FALSE와 상태 변경을 검증한다. 모든 계약은 이 프로젝트에서 독립 작성한 로컬 검증용이며 운영용 구현이 아니다.

## Identity

chainFamily, networkId, assetStandard, contractAddress, mintAddress, tokenProgramId, symbol, name, decimals, issuer, issuerVerificationStatus, nativeOrBridged, implementationAddress, observedBlockOrSlot, observedAt을 제공한다. 발행사·원산 체인은 UNKNOWN. 구현 주소는 지원 패턴의 1차 선언 대상과 코드가 확인된 경우에만 KNOWN이며 실제 dispatch의 증명은 아니다. EVM의 mint/program 주소는 NOT_APPLICABLE. ERC-20 후보를 조회한 것만으로 완전한 표준 준수를 확정하지 않아 assetStandard도 UNKNOWN이다.

## 판정 규칙

SUPPORTED/NOT_SUPPORTED/UNKNOWN과 PASS/FAIL/INCONCLUSIVE/UNSUPPORTED/NOT_TESTED/NOT_APPLICABLE을 분리한다. provenance는 DOCUMENTED/OBSERVED/INFERRED. 현재 실행 증거는 OBSERVED다. 미구현 capability는 summary에 NOT_TESTED. 관리자 권한의 존재 자체는 FAIL 사유가 아니다.

baseline은 성공한 수수료 차감 전송과 zero-reset 경로를 수용한다. exact-receipt는 수취량이 요청량과 같아야 하므로 수수료 토큰의 해당 시나리오만 FAIL이다. false 반환은 successful receipt만으로 성공 처리하지 않는다. EMPTY는 잔액·이벤트 증거가 일치해야 성공이다. 사전 호출 실패와 전송 장애를 혼동하지 않는다.

## 제외 및 미구현

TRON/Solana Adapter, Fork/테스트넷 상태 변경, Controlled Execution, 실제 USDC/USDT 상태 변경 실행, 범용 Proxy 탐지(ZeppelinOS 슬롯 외 legacy 패턴 포함), arbitrary authority 탐지, mint/burn, 최종성, sweep, 거래 이력 인덱싱, 서비스별 전체 프로필은 이번 구현 범위 밖이다. 발행사 법적 실체·규제·준비자산·공시·상환 조건·내부 정책은 자동 평가하지 않는다.

DeFi, DEX/AMM, yield, NFT, 투자 전략, 가격 예측, 브리지 최적화, 운영 자산 자동 거래는 제품 초기 범위에서 제외한다. 첫 MVP는 내부 LLM 호출·Agent Runtime·모델 라우팅·LLM API 키를 사용하지 않는다. 전문 대시보드와 Light/Dark UI는 후속 단계다.

## Phase 1 Proxy 보강

EVM-PROXY-001에서 EIP-1967/Beacon/ZeppelinOS 슬롯/canonical ERC-1167을 읽기 전용으로 해석한다. 해석 불가·오류·모순은 INCONCLUSIVE. 실제 업그레이드 권한은 UNKNOWN이다. USDC/USDT 공식 주소 출처는 docs/research에 DOCUMENTED로 기록하며 실제 온체인 조회 결과와 분리한다.
