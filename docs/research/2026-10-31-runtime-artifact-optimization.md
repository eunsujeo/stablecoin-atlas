# 운영 런타임 artifact 축소·완성 ZIP 캐시 (2026-10-31)

사용자 실측은 이전37.96MB/158.7초 성공, 이번23.67MB/180초 timeout이며 API/인증/ZIP200 이후 본문이 병목이라는 보고다. 운영 접속·실제 다운로드 재실행 없이 CI/workflow/builder를 조사했다. 기존 빌더는 reports 외 추적 파일 대부분과 production node_modules 전체를 묶는다. 단순 timeout 증가는 하지 않았으며180초/96MiB/SHA256·manifest·host·무재시도/불변 릴리스 경계를 유지했다. 기존 새PC 문서2개·비공개자료·로컬서비스를 보존하고 하위 에이전트는 사용하지 않았다.

## 조사와 구현

Node의 read-only permission/resolve hook으로 운영 진입점8개를 import해 로컬120모듈과 pg의 외부 의존성만 확인했다. 최초 TypeScript7 기반 분석 도구는 ScriptTarget.Latest가 undefined여서 실패했다. compiler/새 의존성을 내려받지 않고 Node 자체의 module hook으로 전환했다. runtime-files.mjs는 운영 assets/tools/data/deploy/package/lock과 Bootstrap의 workflow 원문만 선택하고 pg부터 lock 고정 production/optional/peer closure를 계산한다. 선택 패키지는 license와 native/sidecar를 포함해 전체 보존한다. 신규 외부 런타임 root는 명시 목록/시험 없이 자동 포함하지 않는다.

빌드 통계와 deflate9 추정을 CI summary에 출력하며 upload-artifact 압축6→9로 변경했다. 원래 Linux ARM64/Node24/npm-lock 고정 빌드는 유지한다. 추출한 bundle만 읽는 child에서 운영8진입점을 import하며 CLI main/DB/수집기를 실행하지 않는다. 실제 tree의 외부 checkout 의존성 없는 import 성공을 확인했다. pg만 선택된 현재 표본 nativeFiles는0이며 native 포함 유지/Node ABI binding은 별도 가상 native 파일로 검증했다. 실제 Linux ARM64 native 실행은 이 로컬 macOS/Node25 검사의 관측 범위가 아니다. CI는 Node24/ARM64에서 같은 검사를 upload 전에 실행한다.

캐시·재개·계측의 결정은 [ADR0123](../adr/0123-runtime-artifact-and-verified-cache.md)를 따른다. 보호된 state가 이미 있을 때만 root-only 완성 ZIP 캐시를 사용하며 fresh GitHub 후보와 digest/manifest 검증을 매번 유지한다. 완성 cache hit의 ZIP GET/수신은0이며 후보 API5GET은 유지한다. URL/인증은 저장하지 않는다. 부분/timeout/취소/손상 ZIP은 게시하지 않고 cache 손상은 자동 우회하지 않는다. cache write 실패만 발생하면 이미 전체 검증한 네트워크 릴리스는 유지한다.2개 완성본 보관과 crash 임시 파일 미사용을 구분한다. Range/ETag/새 서명 URL 간 바이트 연속성의 검증 계약이 없어 재개·URL 자동갱신·retry를 추가하지 않았다. 공식 API의 URL1분 만료가 기존 본문180초 실패의 직접 원인이라고 단정하지 않는다.

ARTIFACT_DISCOVERY, ARTIFACT_DOWNLOAD, DEPLOY_OPERATION으로 후보 metadata 시간/크기, 네트워크 바이트/속도·EOF 본문시간·cache/검증을 포함한 총시간, CLI 전체시간을 구분한다. HTTP200/EOF/verified/complete를 별도 단계로 표시한다. 실패 stage와 timeout/abort/HTTP/host/hash/ZIP/manifest/ABI/policy/cache 고정 원인을 남기고 URL·토큰·헤더·본문·원래 오류문은 출력하지 않는다.

## 로컬 정량 비교

Git 추적 자료와 실제 설치된 lock상 production 패키지를 별도 소유 격리 저장소로 복사해 기존 포함 범위와 새 포함 범위를 비교했다. 비공개 .env/.state/reports는 입력에 넣지 않았다. old scope ZIP은 deflate6, new scope는 deflate9의 Python 표준 ZIP으로 생성했다. 아래 수치는 로컬 코드 snapshot의 측정이며 실제 GitHub archive size/digest나 Mac mini 전송 시간의 측정이 아니다.

| 측정 | 기존 포함 범위 | 축소 런타임 |
|---|---:|---:|
| 설치 production 패키지 | 85 | 14 |
| 의존성 원시 byte | 94004766 | 469685 |
| TAR byte | 119859200 | 2553856 |
| 포함 파일 수 | 18437 | 397 |
| 로컬 ZIP byte | 29196373 | 544913 |
| 로컬 ZIP 생성초 | 2.013 | 0.065 |

ZIP 감소 98.13%. Collector/Usage 두 정책 hash 동일. 실제 소유 격리 bundle import8개 PASS/외부요청0. 초기 압축 추정과 Python ZIP byte는 ZIP header 차이 때문에 구분한다. 실제 CI/네트워크 속도는 미확인이다. 비공개 재현 자료는 .state/artifact-size-audit.mjs, .state/agent-logs/deploy-artifact-size.json과 그 fixture 경로에 보존한다.

## 실패·수정 및 검증

신규 fixture 검증 중 후보 metadata API 수를6회로 가정한 assertion을 실제5회로 바로잡았고, fixture에 중복된 fx-store entry가 있어 TAR parser가 거부한 것은 fixture 이름을 중복 제거해 수정했다. strict TAR 검증은 완화하지 않았다. macOS /var→/private/var symlink 때문에 permission child의 import가 거부된 문제는 임시 경로를 realpath로 고정해 해결했고 읽기 허용 범위를 넓히지 않았다. progress 시험 변수 이름 중복 SyntaxError도 수정했다.

관련 targeted78pass/0fail/0cancelled/0skip을 확인했다. 신규 시험은 cache hit 후 fresh metadata·서명URL 미호출, timeout·명시/EOF/늦은 취소·부분 EOF·hash/ZIP/manifest 손상과 미게시, cache unsafe·symlink·hardlink·크기·권한·owner·partial·retention, nested/optional/native 그래프·누락/version/lock/dev/symlink 거부, EOF 본문시간 고정/전체시간/진단 redaction·logger실패를 포함한다. 최종 targeted rc0/78pass/0fail/cancelled0/skip0. 전체 npm run check rc0: 주765개757pass/0fail/8skip + 보존74개74pass/0fail/0skip, 합계831pass/0fail/8skip/cancelled0. skip8은 기존 미제공 compiler cache 조건이며 새 skip은 없다. git diff --check rc0. 재현은 source .state/dev-env.sh 후 node --use-env-proxy --test --test-concurrency=2 tests/deploy-automation.test.mjs tests/deploy-runtime.test.mjs tests/deploy-artifact-cache.test.mjs tests/deploy-config.test.mjs 및 npm run check다. 비공개 로그는 .state/agent-logs/deploy-artifact-targeted.log, deploy-artifact-check.log, deploy-artifact-audit.log다.

## 인계·운영 경계

Mac mini/Collector/FX/Supabase/Cloudflare/스케줄·proxy/TLS 설정·DB와 공급자 API/RPC 접근/변경0이다. 실제 GitHub artifact API/키를 사용하지 않았으며 공개 GitHub 문서만 확인했다. 별도 commit/push는 요청 범위다. 새 workflow/control-plane pin과 로컬 캐시 코드의 운영 설치·활성화는 수행하지 않는다. 기존 설치본이 자동으로 새 신뢰 pin을 수용한다고 주장하지 않는다. 운영 실제 다운로드/캐시/건강 확인과 Hosted CI 결과는 NOT_TESTED로 남긴다.

참고: [GitHub artifact API](https://docs.github.com/en/rest/actions/artifacts#download-an-artifact), [upload-artifact 압축](https://github.com/actions/upload-artifact#altering-compressions-level-speed-v-size).
