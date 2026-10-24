# ADR 0095: USDT 검토용 solc0.4.18 취득·사설 검증 범위

## 승인과 경계

2026-10-25 사용자가 [USDT 입력 준비의 후속 제안](../research/2026-10-25-usdt-technical-input-preparation.md#후속-범위와-종료-기준)을 승인했다. 공식 compiler metadata1GET·고정0.4.18 artifact1GET, 성공 시 명시 고정 profile과 사설 호환성 검증으로 한정한다. 실제 USDT 재컴파일/배포 대조·새 RPC·서명/거래·DB/UI는 제외한다. 자동 다운로드 제외 원칙의 일반 해제가 아니다.

host/path·버전·최대2GET/34MiB/120초·요청각30초·재시도/redirect/공급 경로 전환0은 준비 문서의 제안과 같다. metadata의 releases/path/build/longVersion·SHA256/Keccak을 검증한 뒤에만 두 번째 요청을 허용한다. metadata나 artifact가 거절/미확인/초과이면 해당 승인 실행을 종료하고 남은 요청 수를 다른 취득에 쓰지 않는다.

첫 송신 전에 새 소유0700 디렉터리에 plan·wx/fsync 소비를 보존하고 디렉터리를 fsync한다. 각 요청 intent도 송신 전에 배타적으로 기록·fsync한다. receipt와 제한된 오류 원문은0600으로 비공개 보존한다. 원문/인증정보/compiler bytes는 Git/웹에 게시하지 않는다. 관리형 프록시 환경을 존중하며 다른 브라우저/host로 자동 전환하지 않는다.

## 취득 성공 후에만 가능한 구현

확인한 artifact의 고정 SHA와 전체 runtime 버전을 기존 registry·staging/worker 경계에 명시한다. hash 확인 전 artifact를 실행하거나 사용자 입력으로 임의 compiler 경로/hash를 허용하지 않는다. 기존0.6.12/0.8.11·설치 compiler 동작과 원본 보고서를 보존한다.

구버전의 입력/출력·AST·내장 require/assert/msg·상속·동작 후보·실패/시간/변조 거절은 사설 Fixture로 검증한다. 구버전이 제공하지 않는 정보와 실제 호환성을 구분하며 누락을 지원/안전으로 바꾸지 않는다. 사설 시험 통과는 실제 USDT source binding이 아니다.

## 결과 기록

[실제 단발 결과](../research/2026-10-25-usdt-compiler-acquisition.md)는 첫 metadata1GET의 HTTP403·응답 코드1010으로 실패 종료다. artifact/실행/profile 추가0이며0.4.18 사설 검증은 NOT_TESTED다. 이번 소비를 재사용하거나 다른 취득 경로로 전환하지 않는다. 기존 USDT MISMATCH/UNKNOWN·관측/소비를 보존한다.
