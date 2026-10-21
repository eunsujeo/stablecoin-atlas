# ADR0032: 명시적 Solana Token Account와 XRPL holder trust-line 읽기

- 상태: 사용자 승인 후 채택, 2026-10-21
- 배경: mint/issuer 전역 설정으로 특정 계정의 잔액·동결·인가/위임 상태를 알 수 없다. 사용자가 두 체인의 계정 단위 읽기 확장을 요청했다.

## 결정

기존 ReadOnlyAssessmentRequest.accountAddress를 체인별로 해석한다. Solana는 CLI --token-account의 명시적 Token Account이며 XRPL은 --holder의 checksum 검증된 classic address다. 공통 도메인에 ERC-20 spender나 고정 decimals를 강제하지 않는다. 계정 옵션이 없으면 기존 읽기 경로와 시나리오 구성을 유지한다.

Solana는 genesis 이후 mint+Token Account를 한 finalized batch에서 읽는다. 기존 pinned Original Token state.rs의165바이트 배치와 COption/state/u64를 해석하고 mint 일치/프로그램/인코딩을 검증한다. programOwner와 ownerAuthority를 구분한다. wallet 전체·ATA·multisig 서명 조건을 추정하지 않는다. Token-2022는 제외한다.

XRPL은 기존 validated ledger와 issuer를 확인한 뒤 동일 ledger_hash의 account_lines를 peer=issuer로 제한한다. limit20, 최대3페이지, 최대총6회 RPC와 기존10초/64KiB 요청 한도를 유지한다. ignore_default=false. 완전 탐색 이후에만 line 부재를 말한다. marker 문자열512자 초과/미지원 형식·반복·중복·부분 조회는 INCONCLUSIVE다. 서버 오류·프록시 거부 후 재시도/endpoint 전환은 없다.

XRPL 인가는 DELEGATION이 아니다. BALANCE와 별도 IDENTITY 설정 관측에 holder 관점의 signed balance·한도·auth/freeze/NoRipple을 보존한다. 누락 flag와 명시 false를 구분하고 global/individual/deep freeze를 병합하지 않는다. 읽기만으로 Payment 가능성을 결정하지 않는다. XRPL 금액은 최대100자/지수부2자리의 별도 문자열 형식이며 계산하지 않는다. 이 형식 검사는 STAmount 전수 의미 검증이 아니다.

## 결과와 검증

선택 소스/설정 관측 INCONCLUSIVE, support UNKNOWN을 유지한다. 실제 권한 행사·행동 검증은 NOT_TESTED이고 ERC-20 allowance와 구분한다. 새 금액/상태 필드만 공통 schema에 추가하며 기존 보고서/과거 연구 source hash는 보존한다. 로컬 합성 RPC로 오류·경계·회복·격리·호출 상한·CLI/오프라인 보고서 계약과 전체 npm run check를 검증한다.

사용자 계정 주소 확보나 공개망 조회는 구현 완료 필수조건이 아니다. 이번 실제 계정 관측은 NOT_TESTED다. 서비스/수탁 운영, 거래/서명/SDK·키 수집, 지갑 자동 열거·ATA 생성, XRPL Payment·trust-line 생성/수정, 발행/동결/회수 실행은 포함하지 않는다.

상세 사용법·공식 명세 출처: [계정 읽기 문서](../ACCOUNT_STATE_READONLY.md).

전체 회귀 실행의 파일 병렬 수를2로 고정했다. 호스트 부하가 높은 무제한 병렬 실행에서 기존 EVM/lab/proxy 테스트가60초 제한으로 취소된 결과를 보존하며, 타임아웃·검증 기준은 완화하지 않는다.
