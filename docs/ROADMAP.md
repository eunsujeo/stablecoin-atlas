# 개발 로드맵

1. ERC-20: 공통 도메인, EVM Fixture, 엔진, CLI, JSON, 실제 로컬 테스트. [Phase 1 구현·로컬 검증 완료 점검](PHASE1_COMPLETION.md). 운영 배포·자산 취급 승인은 별도다.
2. TRON/TRC-20: SDK/TVM 환경 실증, 주소·거래·이벤트, Energy/Bandwidth/feeLimit.
3. Solana Original SPL: mint, token account/ATA, transfer, delegate, authority.
4. Token-2022: 별도 프로그램, 활성 Extension 탐지 후 fee/hook/permanent delegate/default state 검증.
5. 운영 호환성: Custody/Exchange/Payment/Issuer 프로필, sweep, 최종성, 대사.
6. 발행사·서비스 위험: 공식 출처의 법적 실체, 공시, 준비자산, 상환, 규제와 내부 정책. 기술 판정과 독립.
7. AI 보조: 공식 명세·시나리오·코드 생성 보조, 결과 설명, 변경 영향. 결정적 엔진 독립 유지.
8. 전문 웹 대시보드: 높은 정보 밀도, 실행 이력, 비교, Capability Matrix, Evidence Explorer, 상세 보고서, Light/Dark.

EIP-1967/Beacon/canonical ERC-1167 및 ZeppelinOS 슬롯 관측, 공식 USDC/USDT 주소 출처 조사와 실제 mainnet read-only 조회를 완료했다. USDC의 선언 구현 대상은 확인했지만 실제 위임/업그레이드 권한과 범용 Proxy 검증은 미완료다. Report/Lab 1.0 JSON Schema and EVM ReadOnlyAdapter contract tests are implemented; wrapper compatibility and per-request evidence isolation are verified. 재귀 Proxy와 ZeppelinOS 외 legacy 패턴은 별도 범위 결정이 필요하다. Fork 상태 변경은 신규 로컬 Fixture 한정 정책에 따라 제공하지 않는다. TRON 등 후속 체인은 현재 범위에 포함하지 않는다.
