# USDT solc0.4.18 승인 단발 취득 결과

사용자가 [입력 준비의 후속 제안](2026-10-25-usdt-technical-input-preparation.md#후속-범위와-종료-기준)에 동의해 공식 compiler 최대2GET 취득·고정 profile·사설 호환성 검증을 승인했다. [ADR0095](../adr/0095-bounded-usdt-solc0418-acquisition.md)에 따라 실행했지만 **첫 metadata1GET이 HTTP403·응답 코드1010으로 거절돼 실패 종료했다.** 필요한 compiler를 확보하지 못해 고정 profile 추가와0.4.18 사설 호환성 검증은 실행하지 못했다.

## 실제 실행

승인 경로는 `https://binaries.soliditylang.org/bin/list.json` 1GET(2MiB)과 같은 host의 정확한 `soljson-v0.4.18+commit.9cf6e910.js` 1GET(32MiB)이다. metadata의 고정 path/버전/SHA256/Keccak 검증에 성공해야 artifact를 요청한다. 최대34MiB/120초·요청각30초·재시도0·redirect0·다른 경로/host/브라우저 전환0을 적용했다. 관리형 프록시 환경을 유지했다.

첫 송신 전에 새 소유 디렉터리0700에 plan·plan SHA와 연결한 wx/fsync 소비 표식·요청 intent를0600으로 저장하고 디렉터리를 fsync했다. 시작은 `2026-10-24T18:38:10.253241Z`, 종료는 `2026-10-24T18:38:10.873785Z`이며 한국2026-10-25다. HTTP403 응답의17바이트 오류 원문·hash·receipt를 비공개 보존했다. 오류 코드1010을 관측했지만 거절 주체·원래 정책/해결 조건은 확인하지 못했다. metadata JSON을 확보한 것으로 표시하지 않는다.

| 항목 | 실제 결과 |
| --- | --- |
| metadata 요청 | 1GET·HTTP403, 실패 종료 |
| artifact 요청·다운로드 | 0 |
| SHA/Keccak과 compiler 전체 runtime 버전 검증 | artifact 미확보로 NOT_TESTED |
| 고정 profile·제품 코드 변경 | 0 |
| 0.4.18 사설 컴파일/AST/실패 경로 검증 | NOT_TESTED |
| 실제 USDT 재컴파일·기술 검토 CLI·RPC | 0 |
| 재시도·경로 전환·compiler 실행 | 0 |

이번 취득 승인은 소비 완료다. 남은 요청 숫자를 재시도·브라우저/다른 경로의 취득에 사용하지 않는다. 앞선 JPYC 실패나 소비를 재사용하지 않았다. 소스/후보 입력·기존 보고서7파일의 hash는 불변이며 기존 MISMATCH·source binding UNKNOWN을 유지한다. 새 PARTIAL 기술 검토 보고서를 만들지 않았다.

## 검증과 남은 조건

송신 없는 metadata 선택 검사는 정상 선택1건 및 path/version/build/longVersion/SHA/Keccak·중복 key/build 거절8건을 통과했다. 이는 가상 metadata의 선택 경계 검사이며 실제 artifact·구버전 compiler 지원 검증이 아니다.

취득 후 오프라인 검사에서 소비↔plan SHA·단일 요청 intent/receipt·HTTP403/오류 바이트 수/hash·파일 권한·artifact/profile/RPC 미실행과 원본7파일 불변을 확인해 rc0 PASS를 기록했다. `.state/usdt-solc-0418-acquisition-once/`에 plan/consumed/intent/오류 원문/receipt/validation을 보존했다. 원문·인증정보·compiler bytes는 Git/웹에 게시하지 않는다. Lead `0c240694caf946e49249bb6ed4c6d4ee`의 proceed 조건과 거절 시 중단을 반영했다.

`python3 .state/acquire-usdt-solc-0418-once.py`의 harness 종료는 rc0이지만 receipt의 실제 취득 결과는 FAILED다. `npm run check > .state/agent-logs/usdt-solc-acquisition-check.log 2>&1`은 rc0·tests541/pass541/fail0/cancelled0/skipped0이며 `git diff --check`도 rc0이다. 기존 저장소 시험의 성공과 이번 실제 취득 실패·구버전 사설 검증 미실행을 구분한다.

**0.4.18 사설 검증은 미완료다.** 후속에는 확인 가능한 공식 artifact와 hash 자료의 별도 제공 또는 정확한 다른 취득 경로에 대한 새 범위가 필요하다. 현재 승인을 근거로 새 요청을 시작하지 않는다. compiler가 확보된 뒤에도 고정 profile/전체 버전/구버전 호환성 검증이 먼저이며 실제 USDT 재컴파일·고정 hash RPC 관측은 이번 승인에서 제외된다. 저장소 자동 검사 통과와 compiler 확보/실제 자산 검증 성공을 구분한다.

이후 사용자는 거절 시 브라우저를 띄워 진행하는 가이드를 요청했다. [브라우저 후속 경로](../COMPILER_BROWSER_ACQUISITION.md)·[ADR0096](../adr/0096-browser-compiler-acquisition-guidance.md)에 새 단계의 범위/소비와 방식 변경 시 중복 승인 방지를 정리했다. 이는 위 직접 실패 기록의 변경이나 브라우저 취득 실행 결과가 아니며, 이 가이드 작성 중 추가 요청은0이다.
