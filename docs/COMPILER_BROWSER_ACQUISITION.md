# 공식 compiler 취득 거절 시 브라우저 진행 가이드

사용자 지시(2026-10-25)에 따라 **승인된 공식 compiler 취득이 일반 HTTPS 요청에서 거절되면 Codex가 새 브라우저 창을 열어 같은 공식 자료를 확인하는 경로를 사용한다.** 같은 버전·host·파일·아래 한도 안에서 브라우저 방식으로 바꾸는 것만으로 재승인을 반복 요청하지 않는다. 제품 CLI의 자동 다운로드나 공급자 API/RPC의 호출 확대 권한은 아니다. 결정은 [ADR0096](adr/0096-browser-compiler-acquisition-guidance.md)을 따른다.

이번 변경은 가이드 반영이다. 이 문서를 작성하면서 브라우저를 열거나 추가 자료를 취득하지 않았다. 앞선 [USDT 직접 취득 실패](research/2026-10-25-usdt-compiler-acquisition.md)는 그대로 보존한다. 후속 취득 진행 요청을 받으면 이 가이드를 적용한다.

이후 실제 후속 요청으로 [보이는 Chrome 준비 단계](research/2026-10-25-usdt-browser-preflight.md)를 실행했으나 초기 탭 제어 오류로 공식 Document GET0에서 종료했다. 초기 탭 유지·창 준비 helper와 loopback4종 검증을 보강했으며 종료된 소비/deadline을 재개하지 않았다. 아래는 흐름의 정본이고, 해당 새 취득 단계의 실행 여부는 연구 기록을 따른다.

## 사용자가 보게 될 진행

1. Codex가 직접 요청의 거절 결과를 기록하고, 브라우저 경로로 진행한다고 알린다.
2. 사용자가 볼 수 있는 **새 임시 Chrome 창**을 연다. 개인 로그인 profile이나 이미 열려 있는 사용자 창은 사용하지 않는다.
3. 같은 공식 host의 metadata를 확인한다. 요청한 버전·정확한 파일명·SHA256·Keccak을 확인할 수 있을 때만 해당 compiler 파일을 받는다.
4. 받은 원본 바이트와 두 hash를 대조한다. 일치한 파일만 기존 고정 profile·staging·worker 경계에서 전체 버전을 확인하고, 승인된 사설 검증으로 이어간다.
5. 결과를 회수한 뒤 이번 작업에서 생성한 창/프로세스만 닫고 임시 profile을 정리한다. 브라우저도 거절하거나 검증에 실패하면 실패 근거를 보존하고 종료한다.

보이는 창을 열지 못한 환경에서는 그 상태를 알린다. 이전 headless Chrome 실행을 보이는 창의 성공 사례로 표현하거나 사용자 요청 없이 headless로 대체하지 않는다. 로그인·쿠키 제공·challenge 해결이 필요한 경우 현재 단계의 미확보 상태를 알린다.

## 현재 USDT 대상과 유한 한도

대상은 solc `0.4.18+commit.9cf6e910`이다. 허용 공식 주소는 아래 두 개다.

- metadata: `https://binaries.soliditylang.org/bin/list.json`
- artifact: `https://binaries.soliditylang.org/bin/soljson-v0.4.18+commit.9cf6e910.js`

| 단계 | 취득 대상 GET | 응답 한도 | 시간 한도 |
| --- | --- | --- | --- |
| 직접 HTTPS | 최대2: metadata1·검증 성공 후 artifact1 | 2MiB + 32MiB, 합계34MiB | 단계120초·요청각30초 |
| 거절 후 브라우저 | 별도 새 단계 최대2: metadata1·검증 성공 후 artifact1 | 2MiB + 32MiB, 합계34MiB | 단계120초·요청각30초 |
| 전체 상한 | 최대4GET | 합계68MiB | 두 단계 합계240초 |

현재 직접 단계는 이미1GET 실패·소비 완료다. 이를 재개하거나 한도를 초기화하지 않는다. 브라우저 단계는 독립된 새 소비 root에서 최대1회만 진행하며 단계 안 재시도·새로고침·redirect 추종·host/버전/파일 변경은0이다. 브라우저도 거절되면 세 번째 시도나 다른 공급 경로를 자동으로 만들지 않는다. 향후 다른 compiler의 취득에는 승인된 정확한 버전·파일을 먼저 고정하고 같은 단계 구분을 적용한다. 기존 명시 한도가 더 작으면 그 한도를 우선한다.

## 실행과 근거 보존

Codex는 첫 브라우저 송신 전에 새 소유 디렉터리0700에 plan·wx/fsync 소비·직접 실패 기록과의 연결을 남기고 디렉터리를 fsync한다. 원문/receipt는0600이다. 기존 소비·오류·보고서를 덮어쓰지 않는다.

창은 임시 profile·로컬 디버깅 pipe·about:blank로 시작한다. 로그인 profile 재사용·확장·동기화·background networking을 사용하지 않고, 관리형 프록시 정책을 유지한다. 탐색 전에 요청 gate를 설치해 고정 URL의 Document GET만 단계당 각1회 허용하고 favicon/추가 페이지/하위 자원·예상 밖 target/redirect를 차단한다. artifact 탐색 전 페이지 script 실행을 끄고 response stream으로 바이트를 저장한다. 받은 compiler 파일을 페이지 script로 실행하지 않는다. 임의 URL/JS를 Console에 붙여 실행하는 절차도 사용하지 않는다.

브라우저 제어/대상 gate·시간/크기 제한을 설치하지 못하면 송신하지 않는다. 승인 한도에 포함되는 통신을 계측·강제할 수 없어도 송신 전에 중단한다. 취득 대상의 요청/응답과 브라우저 자체 background 통신의 계측 범위를 구분하며, 일부 target의 기록만으로 전체 프로세스의 통신 한도를 검증했다고 주장하지 않는다. headless와 보이는 창의 실제 실행 여부·browser version·UTC·상태·문서 요청 수·바이트 수·SHA256/Keccak·허용/차단 범위·정리 결과를 receipt에 기록한다.

metadata의 release/path/build/longVersion·유일성·두 hash를 확인하고, 저장 원본과 대조한 뒤에만 실행 pin을 코드 registry에 추가한다. hash 미확인/불일치 파일은 보존하되 실행/profile 등록하지 않는다. 전체 runtime 버전과 구버전 AST/입출력은 사설 Fixture에서 별도 검증한다. 같은 출처의 hash 일치와 독립 진위 인증을 구분한다.

실제 USDT 재컴파일·새 고정 hash RPC 관측·서명/거래·DB/UI 변경은 이 브라우저 절차의 범위에 포함하지 않는다. 브라우저 취득 성공을 실제 토큰의 source binding·지원·안전성으로 확대하지 않는다.

## 가이드 변경 검증

`npm run check > .state/agent-logs/compiler-browser-guide-check.log 2>&1`은 rc0·tests541/pass541/fail0/cancelled0/skipped0이다. 관련 문서의 로컬 링크25개·기존 취득 기록5파일·원본 입력7파일의 불변성을 검사해 rc0 PASS를 확인했고 `git diff --check`도 rc0이다. Lead `90cfcb4f035546e18f5148d23fcca6d5`의 proceed 조건을 반영했다. 이번 검사는 문서 변경 검증이며 보이는 브라우저 실행·취득 성공의 증거가 아니다.
