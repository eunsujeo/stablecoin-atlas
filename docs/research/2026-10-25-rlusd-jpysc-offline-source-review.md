# RLUSD·JPYSC compiler 취득과 저장 소스 오프라인 분석

사용자가 [고정 계획](2026-10-25-rlusd-jpysc-compiler-plan.md)을 승인했고 두 compiler 취득·사설 검증·저장 입력3개의 컴파일을 완료했다. **3건 모두 컴파일 성공, 실제 배포 연결은 모두 UNKNOWN**이다. 새 RPC·배포 runtime 관측·immutable 값 제출·DB/UI 변경은0이며 기존 보고서와 판정은 보존한다. 구현 경계는 [ADR0099](../adr/0099-pinned-rlusd-jpysc-compilers.md)를 따른다.

## 취득과 검증

solc0.8.29/0.8.34는 버전별 직접 metadata1GET이 HTTP403으로 거절됐다. 새 보이는 임시 Chrome에서 같은 공식 metadata/artifact를 각각1GET씩 받아 네 응답 모두 HTTP200이었다. **총6GET·21,354,214응답 바이트**, 재시도/redirect/다른 host 대체0이다. 각 버전/단계의 독립 plan·wx/fsync 소비·request intent·receipt·거절 원문을 보존했다. 창은 normal 상태였고 소유 프로세스 종료·임시 profile 정리를 확인했다.

SHA256/Keccak·metadata release/path/build/longVersion을 검증한 뒤 두 고정 profile을 추가했고 사설 worker에서 전체 버전을 확인했다. hash·캐시 경로·소스 수35/41 예외는 ADR을 따른다. 기존 세 pin은 유지한다. 독립 진위 인증은 NOT_TESTED다. CLI 자동 취득·임의 compiler 경로는 추가하지 않았다.

취득 원본은 `.state/rlusd-solc-{direct,browser}-20261025/`, `.state/jpysc-solc-{direct,browser}-20261025/`에 비공개 보존했다. 취득 검증은 rc0/PASS이며 네트워크 재호출 없이 총6GET·시간/크기/소비 hash·0700/0600을 확인했다.

## 입력과 결과

소스는 기존 저장 HTML/explorer 후보이며 이번에 공식 주소·원본 배포 build를 새로 인증한 것이 아니다. RLUSD 표시 구현체는 `0x9747a0d261c2d56eb93f542068e5d1e23170fa9e`, JPYSC proxy/표시 구현체는 `0x6781d5631bfe47432b089e64e3eab3b6edd26177` / `0xba161409749ae95e9bbc1cf3a2dd3fe3e0af1d5e`다. 현재 연결을 RPC로 확인하지 않았다.

| 저장 입력 | 전체 compiler | 소스 수 | 함수/정적 진입점 | 생성 runtime | 배포 연결 미확인 사유 |
| --- | --- | ---: | ---: | ---: | --- |
| RLUSD StablecoinUpgradeableV2 | `0.8.29+commit.ab55807c.Emscripten.clang` | 35 | 133/33 | 14055바이트 | IMMUTABLE_VALUES_MISSING_OR_EXTRA, `__self` ID650 미제출·코드 관측 없음 |
| JPYSC ERC1967Proxy | `0.8.34+commit.80d5c536.Emscripten.clang` | 9 | 6/1 | 130바이트 | ADDRESS_NOT_OBSERVED |
| JPYSC StablecoinV1 | 같은0.8.34 | 41 | 164/61 | 17538바이트 | IMMUTABLE_VALUES_MISSING_OR_EXTRA, `__self` ID1623 미제출·코드 관측 없음 |

RLUSD 분석 UTC `2026-10-25T01:25:44.597Z`~`01:25:48.561Z`, JPYSC는 `01:25:48.640Z`~`01:25:53.017Z`다. 원래 HTML/소스 취득 시각은 [RLUSD intake](../RLUSD_EXPLORER_SOURCE_INTAKE.md)와 [JPYSC 저장 소스 기록](2026-10-25-jpy-public-html-source-review.md)을 그대로 따른다. 새 분석 시각을 원래 관측 시각으로 쓰지 않는다.

입력당 컴파일은 각각1회, 합계3회이며 compiler diagnostics의 error는 모두0이다. outputSelection 외 content/settings는 그대로다. RLUSD cancun/viaIR·JPYSC osaka/viaIR·optimizer/remappings/metadata 설정을 보존했다. 이름/주소·생성 runtime hash만으로 배포 대응을 확정하지 않았다. immutable ID는 이 입력/출력에 귀속하며 다른 버전의 ID와 일반화하지 않는다. 주소/코드에서 immutable 값을 추출해 채우지 않았다.

두 별도 TokenTechnicalReview1.2 보고서는 모두 PARTIAL이다. JPYSC `initialize` 정적 경로에 CALL_LIMIT·DECLARATION_LIMIT이 남아 source-graph STATIC_GRAPH_TRUNCATED를 기록했다. entry/stateVariable 전체 상한의 false와 경로 내부 절단을 구분하고, 한도를 높이거나 입력을 바꿔 재컴파일하지 않았다. 정적 관계의 semantics는 전부 NOT_PROVEN이다. finding275/415는 검토 항목 수이며 취약점 수가 아니다. 감사 입력0은 미감사 판정이 아니다.

## 보존과 검사

`.state/dual-token-offline-20261025/`에 새 config/입력·영속 소비·두 report.json/report.md·각 입력/실효요청/컴파일 artifact·요약/validation을 root0700·파일0600으로 보존했다. 기존 USDC/USDT/JPYC 보고서와 저장 입력을 포함한107파일의 SHA256이 실행 전후 같았다. fetch 거절 guard 호출0·새 RPC0·archive null·block hash null·관측 contracts0을 확인했다. 원문/compiler bytes/키/URL은 Git·웹에 게시하지 않는다.

- `.state/validate-dual-compiler-acquisition-20261025.mjs`: rc0/PASS, 취득6GET·두 hash/metadata·소비/권한·기존 cache 검사, 추가 네트워크0.
- 사설 modern profile 시험: 초기7개 중 builtin 인코딩 인식 부재2개 실패를 보존, 보완 후 rc0·tests7/pass7/fail0. 축약/유사 version·shadow require·import/timeout/cleanup·감사 snapshot 경로도 검증했다.
- 첫 전체 검사는 새 profile의 TypeScript 선언 누락으로 build rc1이었다. 선언 추가 후 자산 실행 전에 `npm run check`는 rc0·tests564/pass564/fail0/cancelled0/skipped0 (`.state/agent-logs/dual-compiler-preanalysis-check-v2.log`).
- `node --use-env-proxy --import tsx .state/run-dual-token-offline-20261025.mjs`: rc0/PASS, 컴파일3건·기존107파일 불변·0700/0600·입력 설정·report 구조 검증.
- 별도 Python 재독: rc0/PASS, 원본107파일·컴파일 artifact9개·소비 config hash·0700/0600 재확인. 최신 상태 집계 스크립트도 rc0/PASS(자산5개/선택 소스7개).
- 최종 `npm run check`: rc0·tests564/pass564/fail0/cancelled0/skipped0 (`.state/agent-logs/dual-compiler-final-check.log`). `git diff --check`: rc0.

이번 승인 단위는 완료다. 전체 배포 연결 UNKNOWN 수는 줄지 않았고 [잔여 작업 집계](2026-10-25-token-review-remaining-work.md)를 갱신했다. 다음에는 immutable 독립 근거·원래 build·정확한 별도 고정 블록 관측이 필요하며 이번 취득/오프라인 승인을 새 RPC나 추가 자료 취득에 재사용하지 않는다.
