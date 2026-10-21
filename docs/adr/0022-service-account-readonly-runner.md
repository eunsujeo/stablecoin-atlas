# ADR 0022: 서비스 계정 입력과 읽기 전용 Adapter의 명시적 연결

상태: 채택, 2026-10-20.

ADR0021의 로컬 입력 통과를 실행 승인 토큰으로 사용하지 않는다. 별도 연구 명령이 원본 bytes를 다시 검사·복사하고 정규 profile/network/asset/query/account/purpose/provenance에서 기존 Adapter 요청을 구성한다. 제품 CLI·공통 도메인·Adapter 기능과 원래 Assessment 계약은 유지한다.

EVM은 기존 잔액 조회만 연결하며 allowance 입력은 RPC0건 NOT_IMPLEMENTED다. TRON은 기존 owner 잔액과 allowance pair 경로를 연결하고 부수 잔액 조회를 명시한다. 새 체인/서명/거래·권한자 호출은 추가하지 않는다.

선택적 transport factory로 새 runner에만32요청·10초/1MiB·redirect 거부·고정 계정 calldata와 관측된 Proxy 선언 대상 읽기 경계를 적용한다. 기본 Adapter/제품 CLI의 transport를 소급 변경하지 않는다. 입력 URL·다른 체인 env fallback·프록시 변경은 없다.

원본 context/Assessment snapshot hash, 별도 증거 namespace, 정확한 query scenario·calldata·금액과 query tag/header를 envelope에 연결한다. EVM metadata와 query의 pin을 구분하고 TRON exactblock UNKNOWN을 유지한다. root INCONCLUSIVE/권한·소유·서비스 신원 UNKNOWN과 nested 시나리오 판정을 분리한다.

실제 서비스 계정 없이 합성 로컬 HTTP로 연결·오류·격리·저장 경계를 검증한다. 현재 작업의 완료는 연결 코드 검증이며 mainnet 서비스 조회나 실제 자산 취급 검증이 아니다. 상세 계약과 종료 코드는 [사용 문서](../SERVICE_ACCOUNT_READONLY.md)를 따른다.
