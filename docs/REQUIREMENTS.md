# 요구사항 및 현재 범위

목표는 스테이블코인의 체인·구현별 기술 호환성을 실행 증거와 소스 검토로 확인하는 독립 도구다. 투자 평가, 보안 감사 보증, 최종 자산 취급 승인은 제공하지 않는다. 기존 Blockchain Integration Test Kit과 코드·저장소·실행 환경을 공유하지 않는다.

현재 범위는 [ADR0026](adr/0026-source-based-compatibility-scope.md)과 [호환성 검토표](STABLECOIN_COMPATIBILITY_MATRIX.md)를 따른다. 권한 구조는 소스 확인으로 충분하며 서비스 운영·수탁 장부·실제 권한 행사·역할 계정 수집을 완료 필수조건으로 요구하지 않는다. 과거 기능/미확인 상태는 이력으로 보존한다.

## 현재 우선 대상: 스테이블코인

사용자 요청으로 일반 토큰 기능 확대보다 스테이블코인 취급에 필요한 증거를 우선한다. 현재 [조사 목록](STABLECOIN_PROFILES.md)은 Ethereum USDC·USDT·RLUSD, TRON USDT, Solana USDC·USDT, XRP Ledger USDC·RLUSD다. 공식 문서의 식별 참조와 기존 실제 관측을 분리한다. 공식 주소가 문서에 있다는 것은 온체인 계정/코드·권한 인증이 아니며 관측 시점을 재확인한다. 체인·네트워크·표준·개별 컨트랙트를 구분하고 같은 심볼을 같은 자산/구현으로 합치지 않는다.

우선 산출물은 자산×체인×컨트랙트 프로필과 검사표다. 주소·decimals·native/bridged 출처, Proxy·구현/업그레이드·pause/blacklist 등 제어 신호, 전송·승인·철회·이벤트·수령량·체인 자원을 확인할 근거와 미확인 항목을 연결한다. 관련 기능을 찾지 못하거나 호출이 실패했다고 기능 부재를 단정하지 않는다. 관리자 기능의 존재 자체도 실패가 아니다.

외부 자산은 계속 읽기 전용이다. 실제 외부 전송/승인 미실행은 NOT_TESTED, 확인할 수 없는 상태/권한은 UNKNOWN 또는 INCONCLUSIVE로 남긴다. 사설 Fixture는 특정 동작의 검증 대조군이며 실제 USDC/USDT 계약의 실행·원산·발행사·상환·페그 안정성을 입증하지 않는다. 법적 실체·준비자산·상환·규제 정보는 기술 호환성과 별도 자료로 다루며 자동 취급 승인이나 안정성 점수로 합치지 않는다.

Solana/XRPL의 스테이블코인 공식 식별자·프로필 조사는 이번 범위에 포함한다. Solana USDC/USDT mint의 [별도 연구용 RPC 읽기](SOLANA_MINT_READONLY.md)는 후속 승인으로 포함했다. XRPL USDC/RLUSD도 [발행자 설정의 별도 연구용 RPC 읽기](XRPL_ISSUER_READONLY.md)를 포함했다. 제품 실행 Adapter·SDK·trust-line/Payment 실행과 일반 토큰 변형·UI 확장은 별도 후속 작업이다. 기존 엔진/보고서 검증은 스테이블코인 프로필의 증거 기반으로 재사용한다.

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

사설 TRON TVM의 추가 자원 한도 평가와 Solana/XRPL 실행 Adapter, Fork/테스트넷 상태 변경, Controlled Execution, 실제 USDC/USDT 상태 변경 실행, 범용 Proxy 탐지(ZeppelinOS 슬롯 외 legacy 패턴 포함), arbitrary authority 탐지, mint/burn, 최종성, sweep, 거래 이력 인덱싱, 서비스별 전체 프로필은 이번 구현 범위 밖이다. 발행사 법적 실체·규제·준비자산·공시·상환 조건·내부 정책은 자동 평가하지 않는다.

## 승인된 TRON 확장

Phase 1 이후 사용자 승인으로 TRC-20 주소·metadata·선택 balanceOf·allowance 조회 및 CLI/JSON 읽기 경로를 추가했다. TRON_RPC_URL은 JSON-RPC endpoint이며 EVM RPC_URL과 구분한다. exact response block UNKNOWN과 INCONCLUSIVE를 유지하고 조회 결과를 observations에 기록한다. 이 외부 자산 읽기 경로의 거래·승인·자원·Proxy 권한은 NOT_TESTED다. [현재 범위와 실제 조회](TRON_READONLY.md).

DeFi, DEX/AMM, yield, NFT, 투자 전략, 가격 예측, 브리지 최적화, 운영 자산 자동 거래는 제품 초기 범위에서 제외한다. 첫 MVP는 내부 LLM 호출·Agent Runtime·모델 라우팅·LLM API 키를 사용하지 않는다. 전문 대시보드와 Light/Dark UI는 후속 단계다.

## Phase 1 Proxy 보강

EVM-PROXY-001에서 EIP-1967/Beacon/ZeppelinOS 슬롯/canonical ERC-1167을 읽기 전용으로 해석한다. 해석 불가·오류·모순은 INCONCLUSIVE. 실제 업그레이드 권한은 UNKNOWN이다. USDC/USDT 공식 주소 출처는 docs/research에 DOCUMENTED로 기록하며 실제 온체인 조회 결과와 분리한다.

사용자가 신규 사설 TRON TVM의 로컬 상태 변경을 추가 승인했다. 첫 구현은 [고정 ARM64 런타임 기동·격리·정리](TRON_TVM_RUNTIME.md)이며 외부 RPC는 읽기 전용이다. [정상 TRC-20 Fixture 배포·로컬 서명·receipt/초기 상태 검증](adr/0015-private-tvm-fixture-deployment.md)을 추가했다. [정상 Fixture 전송·승인·이벤트·철회/미승인 REVERT](adr/0016-private-tvm-token-scenarios.md) 실행도 추가했다. [0 금액·잔액/승인량 부족·rollback 경계](adr/0017-private-tvm-boundary-scenarios.md)도 추가했다. [false/malformed 반환·이벤트 누락 transfer Fixture](adr/0018-private-tvm-negative-fixtures.md)의 기대 FAIL과 검증기 회귀 결과를 구분한다. 추가 비표준 동작과 자원·최종성 평가는 후속 작업이다.

후속 승인된 [Solana mint-only 공통 Adapter](SOLANA_ADAPTER.md)는 기존 Adapter 제외의 좁은 읽기 예외다. holder/delegate·거래/서명·SDK와 XRPL 제품 Adapter는 계속 별도 범위다.

[XRPL issuer 설정 공통 Adapter](XRPL_ADAPTER.md)도 ADR0030의 후속 읽기 예외로 포함한다. XRPL에서는 currency+issuer와 프로토콜 금액 의미를 유지하며 trust-line/Payment·잔액/공급량·서명/거래·SDK는 여전히 별도다.
