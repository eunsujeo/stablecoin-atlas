# RLUSD・JPYSC・JPYC 독립 배포 근거 취득 계획

이 문서는 [저장 immutable 참조표 인계](../handoff/2026-10-25-stored-immutable-source-map.md)의 다음 행동을 오프라인으로 구체화한 **미실행 제안**이다. 이번 계획 작성의 외부 요청·다운로드·compiler 실행·immutable 제출·runtime 대조는 모두0이다. 아래 URL과 주소는 저장 문서에서 옮긴 후보이며 이번에 최신 공식 출처를 확인하지 않았다.

## 우선순위와 고정 대상

JPYC Ethereum은 이전 hash 고정 관측이 있으므로 독립 build/배포 근거를 먼저 확보하는 대상으로 제안한다. 이어 RLUSD, JPYSC의 자료를 확인한다. JPYC의 다른 체인과 다른 토큰은 제외한다.

| 대상 / chainId | 토큰 프록시 | 저장 구현체 후보 | 필요한 근거 |
| --- | --- | --- | --- |
| JPYC / 1 | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | `0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e` | 실제 build/배포 manifest, ID173 값의 독립 근거 |
| RLUSD / 1 | `0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD` | `0x9747a0d261c2d56eb93f542068e5d1e23170fa9e` | V2 snapshot과 배포의 대응, ID650 근거, 별도 코드 관측 |
| JPYSC / 1 | `0x6781d5631BFe47432b089e64e3EaB3b6eDd26177` | `0xba161409749ae95e9bbc1cf3a2dd3fe3e0af1d5e` | 실제 build/배포 대응, ID1623 근거, 별도 코드 관측 |

주소 근거는 [JPYC/JPYSC 저장 조사](2026-10-25-jpy-public-html-source-review.md), [RLUSD 저장 읽기 정의](../RLUSD_CONTROL_READ_PROBE.md)다. 구현체 후보를 현재 구현체나 발행사가 인증한 주소로 표현하지 않는다.

## A — 먼저 승인받을 공개 자료 취득

아래 순서의 **고정 HTTPS GET8건**만 제안한다. 검색 도구·브라우저·GitHub API·추가 링크 추적은 포함하지 않는다. 공식 페이지의 주소 표기를 먼저 읽고, 해당 자산의 기대 주소가 명확히 확인된 경우에만 그 자산의 구현체 explorer 후보를 취득한다. 확인 실패·주소 변경·새 후보 발견 시 그 자산의 후속 요청은 건너뛰며 새 주소로 전환하지 않는다.

| 순서 | 고정 URL | 확인 목적 |
| ---: | --- | --- |
| 1 | `https://jpyc.co.jp` | 현행 상품과 공식 개발/조직 연결의 표시 여부 |
| 2 | `https://raw.githubusercontent.com/jpycoin/.github/main/profile/README.md` | 공식 조직 후보의 Ethereum 현행 JPYC 주소 표기. 사이트의 조직 연결 확인과 별도로 기록 |
| 3 | `https://etherscan.io/address/0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e` | 저장 구현체 후보의 제출 소스/설정·생성/배포 자료 표시 여부 |
| 4 | `https://docs.ripple.com/products/stablecoin/overview/token-addresses` | RLUSD Ethereum 프록시 주소 재확인 |
| 5 | `https://raw.githubusercontent.com/ripple/RLUSD-Implementation/3632128f690aa8aaf1d23628adb54f4be60303f1/README.md` | 기존 고정 commit의 build/배포 자료 연결. 최신 V2 배포 증거로 가정하지 않음 |
| 6 | `https://etherscan.io/address/0x9747a0d261c2d56eb93f542068e5d1e23170fa9e` | RLUSD 저장 구현체 후보의 자료 표시 여부 |
| 7 | `https://www.startale.com/ja/jpysc` | JPYSC 상품·Ethereum 주소/계약 링크 재확인 |
| 8 | `https://etherscan.io/address/0xba161409749ae95e9bbc1cf3a2dd3fe3e0af1d5e` | JPYSC 저장 구현체 후보의 자료 표시 여부 |

JPYC 사이트에서 조직 연결을 확보하지 못하면 조직 원문은 출처 연결 미확인으로 남긴다. 조직 원문에 기대 주소가 있더라도 단독으로 공식성 재확인 완료라 하지 않는다. 공식 자료가 프록시를 확인해도 구현체 후보의 현재 연결은 확인되지 않는다. explorer는 독립 발행사 build manifest와 구분한다. 이전 JPYC 공식 문서/사이트·explorer 오류를 보존하며, 위 신규 재취득은 사용자 승인 후에만 수행한다.

- 단발 최대8GET, 요청당10초, 전체120초, 응답당2MiB·전체12MiB. 압축 해제 후 바이트도 한도를 적용한다. redirect·재시도·동시 송신·추가페이지·로그인·키·비공개 API는0이다. 관리형 proxy 설정을 유지한다.
- 첫 요청 전에 고정 URL/순서/예산/기존 입력 hash를 비밀 없는 plan으로 pin하고 새 `.state/independent-deployment-evidence-<run>/`에 `wx` 소비 marker를 남긴다. URL별 미실행/시도/결과와 시작 UTC·상태·원문 hash·크기를 기록한다. 전체 root0700·파일0600, 원문은 Git/웹에 게시하지 않는다.
- HTTP 오류·redirect·응답/시간 초과·전송 오류이면 **A 전체를 즉시 실패 종료**한다. 정상 응답에 원하는 근거가 없는 경우는 자료 미확보로 기록하고 위 조건에 맞는 다음 고정 요청만 진행한다. unused 예산은 재실행 권리가 아니다.
- HTML/JavaScript·저장소 빌드 스크립트는 실행하지 않는다. 제공된 본문을 비실행 데이터로 읽고 build-info/metadata/commit/manifest/생성 거래 식별자 등 표시된 근거 경로만 정리한다. 새 링크 다운로드·compiler 취득·재컴파일·값 제출은 없다.
- 고정 목록에서 독립 자료가 없으면 UNKNOWN을 유지하고 **발행사 제공물 또는 정확한 새 URL 목록**이 필요한 것으로 보고한다. 없다는 이유로 탐색 범위를 자동 확장하지 않는다. 비용은 UNKNOWN이며 신규 과금 계정/사용량 조회는 없다.

JPYC의 경우 사이트→조직 연결이 미확보이면 raw README에 기대 주소가 있어도 순서3의 explorer 진입 조건을 충족하지 않는다. 실제 wire 수신 바이트와 압축 해제 바이트 각각에 위 응답/합계 크기 상한을 적용한다.

취득 가능성과 독립 근거 확보 성공은 다르다. 일반 README·explorer의 소스 유사성·주소 표기만으로 원래 build를 인증하지 않는다. A 완료 후 별도 오프라인 receipt/본문 검토 보고서를 만들고, 필요 추가 취득 URL을 구체화해 다시 제시한다.

## 독립 제출자료의 진입 조건

아래 항목은 A에서 찾거나 사용자가 별도로 제공할 자료의 검토 기준이다. 제공 자료가 있다고 실행 승인이 생기지는 않는다.

1. chainId·프록시·구현체·원래 배포 식별자와 자료의 출처/취득 UTC/hash를 연결한다. 공식 발행사 자료, explorer 제출본, 과거/가변 저장소를 구분한다.
2. 전체 standard JSON의 가상 경로/content·compiler 전체 버전·settings·library·원래 생성/배포 자료를 연결한다. settings 누락을 추정하거나 다른 snapshot으로 교체하지 않는다.
3. immutable 값은 고정 입력의 AST ID650/1623/173에 대응하는 정확한32바이트와 그 값의 독립 근거를 동반해야 한다. 주소/관측 runtime에서 자동 추출·자동 채움하지 않는다. `address(this)` 식의 조건부 해석은 실제 생성 코드 실행 증거와 별도로 기록한다.
4. 저장 입력/출력과 새 제출물은 각각 hash로 pin한다. ID는 입력에 귀속하므로 다른 build에서 같은 ID를 가정하지 않는다. 다른 입력이면 새 분석 계획이 필요하다.

## B — 후속 RPC 계획 후보, A 승인에 포함하지 않음

**A의 결과와 사용자의 별도 B 승인 전에는 구현·송신·소비를 시작하지 않는다.** 독립 자료가 없으면 RPC만으로 immutable 근거를 대신하지 않는다. JPYC는 [이전 블록26264212와 hash](2026-10-25-jpyc-token-review-live.md)의 저장 관측을 재사용하는 후속 오프라인 계획 대상으로 두며 신규 RPC는0이다. 새 관측의 의미가 필요한 RLUSD/JPYSC만 아래 각8회·합계16회 후보를 제시한다.

기존 workspace `RPC_URL` 한 개만 사용한다. 미설정 시 송신 전 종료하며 새 키/endpoint 탐색·전환·usage 조회는 없다. 자산 순서는 RLUSD 다음 JPYSC, 각 자산의 프록시/구현체는 위 표의 고정 후보다.

| 순서(자산별) | 메서드 | 고정 인자/조건 |
| ---: | --- | --- |
| 1 | `eth_chainId` | `[]`, `0x1` 확인 |
| 2 | `eth_blockNumber` | `[]`, 높이 한 번 확보 |
| 3 | `eth_getBlockByNumber` | `[확보 높이, false]`, number/hash 검증 |
| 4 | `eth_getStorageAt` | `[프록시, 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc, hashTag]` |
| 5 | `eth_getCode` | `[프록시, hashTag]` |
| 6 | `eth_getCode` | `[고정 구현체 후보, hashTag]` |
| 7 | `eth_chainId` | `[]`, 종료 chain 재확인 |
| 8 | `eth_getBlockByNumber` | `[같은 높이, false]`, 종료 number/hash 재확인 |

`hashTag`는 `{blockHash: 확보 hash, requireCanonical: true}`다. 슬롯은 상위12바이트0·하위20바이트가 해당 고정 구현체 후보와 정확히 같아야 한다. 다르면 전체 B를 즉시 종료하고 새 구현체를 따라가지 않는다. 프록시/구현체 코드가 비어도 종료한다. getter·역할 계정·다른 슬롯·배포 거래 조회는 없다.

제안 한도는 자산별8RPC/120초·합계16HTTP/RPC/240초, 각 요청10초·응답2MiB·자산별8MiB/전체16MiB다. 자산별 독립 시작 블록을 사용하므로 같은 블록 관측으로 표현하지 않는다. 재시도·batch·redirect·endpoint 전환0이며 첫 실패 시 남은 자산도 실행하지 않는다. EIP-1898 거절에 숫자 tag로 대체하지 않는다. 종료 재확인 실패면 앞선 코드가 있더라도 전체 관측 INCONCLUSIVE다.

실제 B 전에는 고정 메서드/인자/순서·합계 budget을 wrapper가 독립 강제하고, 가상 transport로 다른 주소/체인·슬롯 변경·hash 변경·크기/시간·동시 소비/재사용 거절을 검증해야 한다. 이는 아직 NOT_TESTED다. 새 B root와 자산별 소비 marker를 첫 송신 전에 생성하고 하나의 B 실행 lock으로 전체 budget을 보호한다. 미송신 자산도 실패 뒤 자동 재개하지 않는다. RPC URL/인증정보/원시 오류는 기록하지 않으며 비용 UNKNOWN을 유지한다.

## 후속 대조와 보존

A와 B 어느 쪽도 compiler 실행·immutable 제출·재컴파일·runtime 대조 실행을 자동 허용하지 않는다. 정확한 제출물·사용 compiler pin·입력/출력·저장 관측 hash와 실행 횟수를 고정한 오프라인 후속 계획을 먼저 제시한다. metadata 포함 전체 runtime 비교를 유지하며 부분 일치/조건부 일치를 배포 인증으로 승격하지 않는다. 기존 compiler 취득·USDC/USDT/JPYC 읽기와 RLUSD/JPYSC 컴파일 소비는 모두 별개로 보존한다.

새 자료 시각·새 분석 시각과 원래 관측 시각을 구분하고 별도 JSON/Markdown으로 남긴다. 전체 배포 연결 UNKNOWN5/5·추가체인 포함8/8, 기존 PARTIAL·MISMATCH·JPYC 프록시의 과거 CONFIRMED·JPYSC 경로 절단을 보존한다. 기존 PASS/FAIL·SOURCE_REVIEWED를 재판정하지 않는다. DB/UI·운영 데이터·서명/거래·실제 권한 행사는 없다.

이번에는 **A의 GET8건만 승인받는 것을 권고**한다. 독립 근거 확보 경로를 확인한 뒤 B나 추가 취득/오프라인 대조의 필요성을 판단한다. 공식 출처 재확인과 독립 배포 증거 확보는 각기 확인/미확인으로 보고한다.

Lead `29a9fe1500e54a87a2a6160f4bf29ccb`: proceed. 고정 URL/주소 gate·새 소비·wire/해제 바이트 상한·실패 전체 종료를 실행 전 검증하며 JPYC 조직 연결 미확보 시 explorer를 건너뛰는 조건을 명시했다. 이 검토는 외부 실행 승인이 아니다.

계획 문서 검증: 로컬 링크/고정GET8/Lead 참조 검사 rc0/PASS. `npm run check`: rc0·tests564/pass564/fail0/cancelled0/skipped0 (`.state/agent-logs/independent-deployment-evidence-plan-check.log`). `git diff --check`: rc0. 실제 A/B transport와 소비 wrapper 검증/외부 실행은 NOT_TESTED다.
