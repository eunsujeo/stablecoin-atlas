# ADR 0093: JPYC Ethereum compiler의 승인된 단발 취득

## 결정과 경계

2026-10-25 사용자가 [고정 계획](../research/2026-10-25-jpyc-compiler-plan.md)의 실제 실행을 승인했다. ADR0092의 자동 다운로드 제외를 일반적으로 해제하지 않는다. 이번 예외는 solc0.8.11의 고정 metadata/artifact 최대2GET·재시도0과 검증 후 명시 profile 추가·JPYC Ethereum 저장2입력 오프라인 분석으로 한정한다. host/path·크기·시간·검증 경계는 계획 정본을 따른다.

첫 송신 전에 새 전용 로컬 디렉터리와 소비 기록을 배타적으로 생성하고 fsync했다. 실패 후에도 기록을 유지하며 같은 실행의 재호출·다른 endpoint 전환을 하지 않는다. metadata 선택과 artifact hash 검증이 끝나기 전에는 compiler를 실행하거나 profile을 등록하지 않는다. 새 profile을 추가할 경우 기존0.6.12 pin/cache·검증/staging·child hash/전체 버전·정리 경계를 유지한다. 실행 가능한 pin은 코드 registry에 고정하고 런타임 manifest나 사용자 입력에서 받지 않는다.

RPC·서명/거래·DB/UI·다른 체인·JPYSC0.8.34는 제외한다. 오프라인 분석 성공도 현재 배포 binding을 인증하지 않는다.

## 실제 결과

[실행 기록](../research/2026-10-25-jpyc-compiler-acquisition.md): 첫 metadata 요청이 HTTPError로 실패하여 추가 요청 없이 종료했다. artifact0·compiler 실행0·profile 변경0·대상 분석0이다. 새0.8.11 지원은 구현 완료가 아니다. 기존0.6.12와 설치 compiler 동작을 변경하지 않았다.

승인된 두 요청 중 metadata 성공을 조건으로 하는 artifact 요청은 수행하지 않았다. 남은 숫자를 다른 진단/재시도에 사용할 수 없다. 새 시도는 별도 승인된 계획이 필요하다. 실패의 HTTP 상태 코드와 응답 본문은 확보하지 못했으므로 원인은 UNKNOWN으로 보존한다.
