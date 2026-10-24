# USDT 검토용 solc0.4.18 브라우저 취득·사설 호환성 검증

**이번 승인 범위의 compiler 취득·고정 profile·사설 호환성 검증을 완료했다.** 실제 USDT의 컴파일/배포 대조·새 RPC는 실행하지 않았다. [직접403](2026-10-25-usdt-compiler-acquisition.md)·[첫 브라우저 준비 오류/GET0](2026-10-25-usdt-browser-preflight.md)를 보존하고, 사용자가 추가 승인한 수정본의 새 최대2GET 단계를 별도로 실행했다. 결정은 [ADR0097](../adr/0097-pinned-solc0418-visible-browser-profile.md)을 따른다.

## 실제 취득

UTC `2026-10-24T19:08:05.970Z`~`19:08:13.035Z`(한국2026-10-25)에 약7.07초 동안 보이는 임시 Chrome146.0.7680.165를 사용했다. 창은 normal/1000×760으로 확인됐고 headless flag는 없다. 새 소유 root의 wx/fsync plan/소비에 이번 추가 승인·직접403/첫 브라우저 실패 receipt·수정 harness/helper SHA를 연결했다. 기존 단계를 재개하지 않았다.

| 요청 | 결과 |
| --- | --- |
| 같은 공식 host의 `bin/list.json` | 1GET·HTTP200·1077540바이트 |
| `soljson-v0.4.18+commit.9cf6e910.js` | 1GET·HTTP200·7139666바이트 |
| 합계 | 2GET·8217206바이트, 재시도/redirect/host 전환0 |

metadata2MiB/artifact32MiB·전체34MiB/120초·요청각30초를 지켰다. metadata의 중복 key·release/path/build/longVersion·유일성·두 hash 검증 후 artifact를 요청했다. script를 비활성화하고 response stream으로 원본을 저장했으며 다운로드 중 compiler를 실행하지 않았다. 소유 프로세스 종료와 임시 profile 삭제를 확인했다. 계측 범위는 고정 Document GET과 읽은 response stream이며 Chrome 전체 background 통신0으로 확대하지 않는다.

artifact SHA256은 `905e3d253406973f545666d79cd64c5c85985992f68fa35935f60249e311d74f`, Keccak은 `0x0478b43de978b1af1d6d6d8c09e84cdb2cc8ed76218d38f17b841b6e539742f0`로 공식 metadata와 같았다. 이는 취득 무결성 확인이며 독립 출처 인증이 아니다.

## 고정 profile과 사설 Fixture

`solc-0.4.18-pinned` profile을 코드 registry에 고정했다. 파일은 `.state/usdt-solc-0418-visible-browser-v2/soljson.js`이고 worker가 확인한 전체 버전은 **0.4.18+commit.9cf6e910.Emscripten.clang**이다. 기존 cache 검사/staging/worker/정리 경계를 유지하며 CLI 자동 취득·임의 경로/hash를 추가하지 않았다.

사설 Legacy/Base·Shadow·FakeMsg 소스를 사용해 다음을 확인했다.

- ABI·전체 runtime·compact AST 컴파일과 source inventory. 해당 버전 AST의 생성자·이름·fallback을 구분한다.
- 생성자 진입 제외, overload 각각 보존, selector 없는 상속 override 선언의 ID별 보존. AST selector를 추정하지 않고 미확정 상태를 유지한다.
- 작은 양수 builtin 참조의 이름/type·source 선언 부재를 확인하고 실제 require/assert/msg를 인식한다. fake require/msg·OR 우회·미등록 버전·ID 충돌/범위 밖·잘못된 type은 권한 조건으로 승격하지 않는다.
- 오류/미해결 외부 import·timeout 정리·pin 일치에도 전체 버전 mismatch 거절. 기존 profile의 missing/변조/symlink/초과·미검증 실행 거절도 유지한다.

첫 대상 시험13개 중1개는 assert에 REQUIRE 전용 callerEqualityState까지 기대해 실패했다. 기존 정책을 유지하도록 시험 기대를 수정했고 해당5개가 모두 통과했다. 원래 실패 로그는 보존했다. assert의 source 조건/저장값 참조와 REQUIRE 직접 caller 조건을 구분한다. 기존 소스/권한 판정을 지워 시험을 통과시키지 않았다.

## 근거와 범위

새 비공개 root에 plan/consumed·두 request intent·metadata·selected build·artifact·receipt8파일을0700/0600으로 보존했다. 원문·compiler bytes·인증정보는 Git/웹에 게시하지 않는다. `.state/agent-logs/usdt-solc0418-success-validation.json`에서 소비/plan·이전 receipt·수정본 hash 연결, 요청/시간/바이트·두 hash·창/정리·권한·원본7파일과 기존 두 compiler cache 불변을 검증해 rc0 PASS를 확인했다.

실제 version/컴파일 witness는 사설 Fixture다. 실제 USDT standard JSON 후보나 과거 bytecode를 이번 compiler로 분석하지 않았다. [이전 입력 준비](2026-10-25-usdt-technical-input-preparation.md)의 compiler 미확보 조건은 해소됐지만, 정확한 배포 입력·현재 reader가 받는 고정 hash 관측 archive·실제 source/runtime 연결은 별도다. 기존 MISMATCH/UNKNOWN·과거 관측 시각/판정은 유지한다. 새 PARTIAL 기술 검토 보고서를 만들지 않았다.

Lead `30e4348d092f4ddfad5db3dd6b9472d5`와 AST 보완 검토 `83f31aa51fd84507b2df83fe1bb14ca2`의 proceed 조건을 반영했다. 실제 USDT 재컴파일·새 RPC·서명/거래·DB/UI 변경0이다.

## 최종 검사

`node --use-env-proxy --import tsx --test tests/token-review-solc0418.test.mjs`는 rc0·tests5/pass5/fail0이다(`.state/agent-logs/usdt-solc0418-targeted-v2.log`). 최초13개 대상 시험의12pass/1fail 로그도 보존한다. 병렬 파일의 timeout 정리 시험이 서로의 stage를 집계하지 않도록 새 시험 파일의 temp root를 격리했다.

`npm run check > .state/agent-logs/usdt-solc0418-final-check.log 2>&1`은 rc0·tests548/pass548/fail0/cancelled0/skipped0이다. 기존0.6.12/0.8.11 회귀와 새0.4.18 경계를 함께 통과했다. `node .state/validate-usdt-solc0418-success.mjs`도 rc0 PASS(새 root8파일/두 hash·이전 기록/원본7/기존 cache2/소유 정리)이며 `git diff --check` rc0이다. 이번 승인 범위는 완료했고 실제 자산 검토와 구분한다.
