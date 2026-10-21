# 개발 로드맵

## 현재 단계: 소스 중심 스테이블코인 호환성 검토

사용자가 서비스 운영 검증을 제외하고 권한은 소스 확인으로 충분하다고 명시했다. [현재 호환성 표](STABLECOIN_COMPATIBILITY_MATRIX.md)·[작업 목록/완료 기준](STABLECOIN_EVIDENCE_BACKLOG.md)·[ADR0026](adr/0026-source-based-compatibility-scope.md)을 따른다.

1. **범위와 근거 연결 완료**: 8개 프로필의 체인/식별 모델·구현 차이와 실행/소스/문서 근거를 구분한다.
2. **확보 소스 검토 완료**: Ethereum USDC·USDT·RLUSD의 선택 함수·modifier·권한·전송/승인 조건을13개 snapshot·21개 findings로 연결했다. RLUSD explorer 상속 보강8개·TRON 제공 소스10개 findings도 통합했으며 snapshot 차이·제3자 provenance와 남는 공백을 명시한다.
3. **기존 엔진 검증 유지**: EVM/TRON 신규 사설 Fixture와 읽기/보고서·오류 경로의 회귀 검사를 완료한다. 실제 토큰 쓰기는 하지 않는다.
4. **공백을 기록하고 마감**: TRON은 [사용자 제공 전체 소스의 선택 경로 검토](TRON_EXPORTED_SOURCE_REVIEW.md)를 완료했다. getter 블록 UNKNOWN·배포 binding·전달 대상 구현·실제 권한 미검증을 현재 단계의 무기한 대기 조건으로 삼지 않는다. 서비스 주소/역할 계정을 다시 요구하지 않는다.

Solana/XRPL 실행 Adapter, 자원 한도/최종성 실험, UI·서비스 운영 검증은 별도 확장이다. 아래는 구현 이력과 장기 후보이며 현재 필수 backlog가 아니다.

## 구현 이력과 장기 범위

1. ERC-20: 공통 도메인, EVM Fixture, 엔진, CLI, JSON, 실제 로컬 테스트. [Phase 1 구현·로컬 검증 완료 점검](PHASE1_COMPLETION.md). 운영 배포·자산 취급 승인은 별도다.
2. TRON/TRC-20: [주소·metadata·선택 잔액·승인량의 읽기 전용 경로 구현](TRON_READONLY.md). [완료 점검과 후속 순서](TRON_READONLY_COMPLETION.md), [응답 블록 연결 조사](research/TRON_RESPONSE_BLOCK_BINDING.md). 사용자 승인 후 [사설 TVM 기동·격리·정리 실행기](TRON_TVM_RUNTIME.md)를 구현했다. [정상 Fixture 배포·영수증·초기 상태](adr/0015-private-tvm-fixture-deployment.md)도 구현했다. [정상 Fixture 전송·승인·이벤트·철회/미승인 REVERT](adr/0016-private-tvm-token-scenarios.md)도 검증했다. [정상 Fixture의 0 금액·잔액/승인량 부족·rollback 경계](adr/0017-private-tvm-boundary-scenarios.md)도 구현했다. [false/malformed 반환·이벤트 누락 Fixture의 검증기 대조](adr/0018-private-tvm-negative-fixtures.md)를 추가했다. [별도 사설 TVM 보고서 v1 구조·일관성 검사](adr/0019-private-tvm-report-contract.md)도 추가했다. 비표준 approve/transferFrom의 단일 결함 대조는 [별도 사설 실행](TRON_ALLOWANCE_PROBE_EXECUTION.md)을 완료했다. 실제 자산의 추가 오류·Energy/Bandwidth/feeLimit 호환성 평가는 후속 작업이다.
3. Solana Original SPL: mint, token account/ATA, transfer, delegate, authority.
4. Token-2022: 별도 프로그램, 활성 Extension 탐지 후 fee/hook/permanent delegate/default state 검증.
5. 운영 호환성: Custody/Exchange/Payment/Issuer 프로필, sweep, 최종성, 대사.
6. 발행사·서비스 위험: 공식 출처의 법적 실체, 공시, 준비자산, 상환, 규제와 내부 정책. 기술 판정과 독립.
7. AI 보조: 공식 명세·시나리오·코드 생성 보조, 결과 설명, 변경 영향. 결정적 엔진 독립 유지.
8. 전문 웹 대시보드: 높은 정보 밀도, 실행 이력, 비교, Capability Matrix, Evidence Explorer, 상세 보고서, Light/Dark.

EIP-1967/Beacon/canonical ERC-1167 및 ZeppelinOS 슬롯 관측, 공식 USDC/USDT 주소 출처 조사와 실제 mainnet read-only 조회를 완료했다. USDC의 선언 구현 대상은 확인했지만 실제 위임/업그레이드 권한과 범용 Proxy 검증은 미완료다. Report/Lab 1.0 계약, EVM wrapper 호환성과 요청별 증거 격리를 검증했다. 이후 사용자 승인으로 TRON 읽기 전용을 추가했으며 후속 범위는 해당 ADR을 따른다. 재귀 Proxy·기타 legacy·외부/fork 상태 변경·Solana는 이번 범위 밖이다.

사용자 추가 요청에 따른 XRP Ledger 조사는 RLUSD와 USDC를 대상으로 하며 XRP 자체와 구분한다. XRPL trust-line token과 XRPL EVM Sidechain도 합치지 않는다.

현재 스테이블코인 후속 순서는 [증거 기반 작업 목록](STABLECOIN_EVIDENCE_BACKLOG.md)을 따른다. [서비스 계정 표본의 로컬 입력·출처 검증](SERVICE_ACCOUNT_CONTEXT.md)과 기존 읽기 전용 Adapter 연결을 구현했다. 새 근거 없는 과거 조회 반복·공개망 권한 행사·Solana/XRPL 실행을 필수 대기 작업으로 취급하지 않는다.

[서비스 계정 read-only runner](SERVICE_ACCOUNT_READONLY.md) 연결 구현도 완료했다. 로컬 합성 검증과 실제 서비스 계정 조회를 구분한다. 도구를 보존하되 서비스 계정 입력 확보·조회는 현재 필수 작업에서 제외했다.

TRON의 비표준 approve/transferFrom은 [단일 결함 프로브 준비](TRON_ALLOWANCE_PROBE_PREPARATION.md)를 완료했다. 고정9종 컴파일·합성 증거와 [후속 사설 TVM 실행](TRON_ALLOWANCE_PROBE_EXECUTION.md)을 구분한다. 별도 실행·보고서 경로는 정상 대조2건과 단일 결함8건, setup 승인·정리 결과를 수집한다. 실제 서비스 계정 인증으로 확대하지 않으며 서비스 자료 수집은 현재 필수가 아니다.

[Solana·XRPL 계정 모델 조사](STABLECOIN_ACCOUNT_MODELS.md)에서 mint/Token Account/delegate와 currency+issuer/trust-line/실수령량의 증거 요구를 정리했다. 당시 공식 프로토콜 조사 이후 아래 연구 단계에서 mint/issuer 설정을 관측했다. holder/delegate·trust-line·거래 관측과 제품 Adapter 구현은 별도다.

후속 승인된 Solana mint 읽기 연구는 [ADR0027](adr/0027-solana-mint-research-reader.md)과 [실제 관측 결과](SOLANA_MINT_READONLY.md)를 따른다. USDC/USDT mint 설정 읽기는 완료했고 제품 Adapter·전송/위임 실행은 별도다. XRPL issuer 설정 읽기도 후속 단계에서 완료했다.

[XRPL 발행자 설정 읽기](XRPL_ISSUER_READONLY.md)도 ADR0028의 별도 연구 도구로 완료했다. 같은 validated ledger의 두 계정 설정을 관측했으며 trust-line·전송·서명·제품 Adapter와 별도로 남긴다.

[현재8개 프로필 비교표](STABLECOIN_COMPATIBILITY_MATRIX.md)와 [근거/hash 요약](research/stablecoin-compatibility-summary.json)을 최신 소스·mint/issuer 관측으로 통합했다. 현재 합의 범위의 필수 작업은 완료이며 위 장기 후보는 별도 수요에 따른 확장이다.

후속 체인 연결 작업으로 [Solana mint-only 공통 Adapter/CLI](SOLANA_ADAPTER.md)를 완료했다. 제품 Adapter 전체와 혼동하지 않고 허용 두 mint의 설정 읽기로 범위를 제한한다. XRPL 공통 Adapter와 holder/delegate/거래는 미구현이다.

[XRPL issuer 공통 Adapter/CLI](XRPL_ADAPTER.md)도 연결했다. EVM/TRON 읽기, Solana mint 읽기, XRPL issuer 설정 읽기의 공통 경로가 있으며 각 체인의 허용 범위는 다르다. trust-line/holder/delegate·행위 실행은 이번 연결에 포함하지 않았다.

[공통 보고서 오프라인 검증](REPORT_VALIDATION.md)을 CLI에 연결했다. 저장된 AssessmentReport의 schema·증거 참조·identity·요약을 재검증하며 외부 체인 조회/거래와 구분한다.

후속 사용자 승인으로 [Solana 명시 Token Account·XRPL holder trust-line 읽기](ACCOUNT_STATE_READONLY.md)를 구현했다. 기존 mint/issuer-only 제외 조건에서 이 설정 읽기만 확장한 것으로, 실제 거래·권한 행사·서비스 운영은 제외한다. 실제 계정 단위 공개망 관측은 NOT_TESTED이며 기존 mint/issuer 보고서와 분리한다.

**현재 마일스톤 마감:** [완료 보고](STABLECOIN_MILESTONE_COMPLETION.md). 새 공개 표본4개를14회 읽기로 확인해 Solana Token Account2개 관측과 XRPL 선택 line2개 부재를 기록했다. HTTP/RPC 오류0, 원본 증거 보존·새 보고서 정합성 검증 통과. 현재 필수 미완료 작업은 없으며 양수 XRPL 보유 line·실제 전송/권한 행사 등 남는 한계를 후속 자동 작업으로 계속 늘리지 않는다.

후속 사용자 승인된 [XRPL 양수 보유 trust-line 연구](XRPL_HELD_TRUSTLINE_OBSERVATION.md)를 완료했다. USDC/RLUSD AMM 표본의 잔액·설정을 동일 ledger의 직접 RippleState로 관측했다. 공통 account_lines Adapter는 해당 표본에서3페이지 미완료였으며 기존 INCONCLUSIVE 보고서와 분리한다. 추가 연구18회 읽기·거래0회, 제품 코드/기존212개 검사 이력은 유지한다.
