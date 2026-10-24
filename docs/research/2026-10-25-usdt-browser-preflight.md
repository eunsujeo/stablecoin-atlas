# USDT 보이는 브라우저 준비 실패·로컬 회귀 수정

사용자가 [브라우저 가이드](../COMPILER_BROWSER_ACQUISITION.md)의 후속 진행을 요청했다. 같은 공식0.4.18 metadata/artifact 최대2GET의 새 브라우저 단계를 준비했지만, **초기 탭 제어 오류로 공식 Document GET0에서 실패 종료했다.** compiler 취득·고정 profile 추가·0.4.18 사설 컴파일은 미완료다. 보이는 창의 로컬 취득 경로를 수정·검증했으며, 종료된 단계의 소비나 deadline을 초기화해 공식 요청을 재개하지 않았다.

## 실제 준비 실패

새 `.state/usdt-solc-0418-visible-browser/`에 plan·wx/fsync 소비를 보존하고 직접 HTTP403 receipt의 SHA를 연결했다. 원래 계획은 공식 두 URL·metadata2MiB/artifact32MiB·전체34MiB/120초·요청각30초·재시도/redirect/host 전환0이다. 임시 profile의 Chrome을 `--headless` 없이 실행했으며 `Chrome/146.0.7680.165`를 확인했다.

UTC `2026-10-24T18:53:26.896Z`에 시작해 약1.04초 만에 `CDP_OPERATION_FAILED`로 종료했다. 공식 요청0·응답0·compiler 실행0·새 RPC0이다. 소유 PID 종료와 임시 profile 삭제를 확인했다. 보이는 창 정상 상태의 확인 전에 실패했으므로 첫 시도의 창 검증이 성공했다고 표시하지 않는다. Chrome 자체 background 통신 전체가0이었다고 주장하지 않는다.

처음 harness는 CDP 오류의 메서드/코드를 보존하지 않아 해당 실패만으로 정확한 호출 지점을 확인하지 못했다. 이후 외부 탐색 없는 about:blank 진단은 창/Network/Page/Fetch 제어 명령을 모두 통과했다. 첫 loopback 회귀에서는 `Network.enable`의 -32001을 기록했다. 코드와 이벤트 처리에서 **명시적으로 붙인 초기 탭의 attachedToTarget 이벤트까지 추가 target으로 분류해 닫는 오류**를 확인했다. 이로 인해 준비 중인 session을 잃을 수 있었다. 초기 탭 식별자를 등록한 뒤 연결하고, 그 탭은 유지하며 예상 밖 child target만 차단하도록 수정했다. 창 준비 대기와 메서드/코드 기록도 보강했다.

최초 harness 사본·원래 plan/consumed/receipt는 비공개 root에 보존했다. 사전 준비 실패를 원격403이나 compiler 미지원으로 판정하지 않는다. 첫 Lead `ff0271f3935e46ebb8c20b9f111bd595`의 조건과 후속 Lead `0b72495f13b344128e803777a311e21f`의 로컬 진단/수정 범위를 반영했다. 후속 검토는 새 공식 취득을 승인한 것이 아니다. `.state` 경로를 Lead 관련 파일로 제출한 준비 호출1건은 경로 검증에서 거절돼 id/전달 없이 끝났고, 공개 가이드 경로로 수정한 요청만 전달했다.

## 수정과 검증

개발용 [창 제어 helper](../../tools/research/compiler-browser-window.mjs)는 브라우저 실행/HTTP 기능 없이 초기 target 구분과 제한된 창 준비 확인만 제공한다. [회귀 시험](../../tests/compiler-browser-window.test.mjs)은 초기 탭 유지·다른 target 차단·준비 실패 최대20회·정상 창의 불필요한 재설정 생략·최소화 복원·실제 크기 확인을 검사한다. 로컬 harness도 같은 helper를 사용한다.

공식 source/주소를 사용하지 않는 loopback 가상 자료로 실제 보이는 Chrome의 요청 gate/response stream/정리를 검증했다. 가상 artifact는 compiler가 아닌52바이트 시험 문자열이다. 가상 metadata/hash 일치를 실제 공식 compiler 취득으로 사용하지 않는다.

| loopback 시나리오 | 검증한 결과 |
| --- | --- |
| 정상 metadata + 가상 artifact | Document GET2, 저장 바이트/hash 일치, 정상 창 확인·소유 자원 정리 |
| metadata302 | GET1 뒤 REDIRECT_REJECTED, 추가 경로/파일 요청 없음 |
| metadata 초과 길이 | GET1 뒤 SIZE_LIMIT, artifact 없음 |
| metadata 무응답 | 가상 harness의 단축 timeout으로 REQUEST_TIMEOUT, GET1·artifact 없음 |

원래 실제 한도30초/120초는 바꾸지 않았다. loopback timeout 시험만 사설 복사본의 요청300ms/전체10초로 실행했다. 이 시험의 브라우저/서버·자료는 모두 분리됐다. 각 시험에서 소유 PID 종료·profile 삭제를 확인했다.

첫 loopback run은 초기 탭 오류로 rc1이었다. 수정 후 정상/redirect는 통과했고, 초과 길이 Fixture가 헤더만 보낸 채 종료하지 않아 SIZE_LIMIT 대신 timeout을 관측해 시험이 rc1이었다. 완전한 초과 응답으로 Fixture를 수정한 뒤 초과/timeout을 통과했다. 먼저 통과한 정상/redirect 근거와 후속 결과를 합쳐4종 PASS를 검증했으며 실패 로그/원문은 보존했다. 저장소의 자동 시험 실패와 가상 취득의 의도된 FAILED receipt를 구분한다.

`node --test tests/compiler-browser-window.test.mjs`는 rc0·tests2/pass2/fail0이다. 최초 loopback 최종 검증은 rc0 PASS이며 `.state/agent-logs/usdt-visible-browser-loopback-validation.json`에 가상 범위와 결과를 보존했다. helper를 공유 모듈로 옮긴 뒤 같은 수정본으로4종을 다시 검사해 rc0 PASS를 확인했다(`.state/agent-logs/usdt-visible-browser-loopback-validation-v4.json`). 소비↔plan·직접 실패 receipt 연결·소유 자원 정리·원본7파일 불변·공식 GET0·새 live root 부재도 rc0 PASS다(`.state/agent-logs/usdt-visible-browser-validation.json`). 기존 source binding/관측·MISMATCH·제품 판정은 변경하지 않았다. 실제 USDT 재컴파일·새 RPC·DB/UI 변경0이다.

`npm run check > .state/agent-logs/usdt-browser-preflight-check.log 2>&1`은 rc0·tests543/pass543/fail0/cancelled0/skipped0이다. `git diff --check`도 rc0이다. 이는 초기 탭 오류의 회귀 수정과 기존 저장소 검사 결과이며 실제0.4.18 compiler 지원 완료가 아니다.

## 남은 실행과 고정 제안

첫 브라우저 단계는 종료·소비됐고 가이드는 브라우저 단계 최대1회를 정했다. 따라서 수정 후 자동으로 새 root/deadline을 발급하지 않는다. 현재 `.state/usdt-solc-0418-visible-browser-v2/`는 생성하지 않았으며 공식 요청은 첫 단계와 로컬 시험을 합쳐0이다.

후속 제안은 **수정본의 새 브라우저 단계1회**다. 고정 두 URL과 metadata1GET/2MiB·검증 성공 후 artifact1GET/32MiB·전체34MiB/120초·요청30초·재시도/redirect/host 전환0을 유지한다. 새 wx/fsync 소비/receipt에 첫 단계의 실패와 수정된 harness/helper hash를 연결한다. metadata의 중복 key·정확한 버전/경로/유일성·SHA/Keccak 확인 후에만 파일을 받고 두 hash 확인 전 실행/profile 추가하지 않는다. 성공하면 이미 요청된 고정 profile·구버전 사설 호환성 검증을 진행하며 실제 USDT 재컴파일/새 RPC는 계속 제외한다. 이 새 취득 단계는 추가 사용자 지시 전 미실행이다.
