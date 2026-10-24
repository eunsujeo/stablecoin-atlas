# JPYC Ethereum 기술 검토 단발 읽기

사용자가 정확한 두 주소·기존 workspace RPC·최대128회/120초·비용 미확인 조건을 확인하고 실제 읽기를 승인했다. 실행은 **RPC13회로 종료·소비 완료**했다. 고정 블록에서 제출 프록시 소스의 전체 runtime 일치를 확인했으며, 구현체는 immutable 값 미제공으로 **UNKNOWN**, 전체 보고서는 **PARTIAL**이다. 기존 [오프라인 분석](2026-10-25-jpyc-offline-source-review.md)의 결과와 원문은 보존했다.

## 실행 범위와 통제

- Ethereum chainId `1`, 프록시 `0xe7c3d8c9a439fede00d2600032d5db0be71c3c29`, 구현체 후보 `0xafac17fc3936a29ca2d2787ced3c5d1c52007d2e`.
- 기존 `RPC_URL`만 사용했다. 최대128RPC/120초·요청10초·응답 각2MiB/합계8MiB, 재시도0·redirect0·endpoint 전환0이다. getter·eth_call·새 다운로드는0이다.
- 별도 사설 디렉터리의 plan/config·두 입력·원본 hash 목록을 저장하고 fsync한 뒤, wx 소비 표식과 디렉터리 fsync를 완료한 후 첫 요청을 보냈다. 남은 한도로 재실행하지 않는다.
- 송신 직전 별도 wrapper가 고정 endpoint·두 승인주소·허용 메서드·고정 proxy 슬롯·동일 hash pin·호출 수/시간을 검사했다. 예상 밖 implementation/beacon/clone 주소의 코드 조회와 eth_call은 차단 대상이다. 실제 경계 거절은0건이다.
- 외부 송신 없는 mock에서 다른 주소·메서드·슬롯·endpoint·redirect·hash 변경·latest·시간 초과·129번째 호출의 거절을 확인했다. 기존 CLI의 자동 대상 확장이 두 주소 제한을 넓히지 않도록 했다.

대상은 저장 식별자이며 공식 주소 목록을 이번에 새로 조사하지 않았다. 기준은 [기술 검토 실행 문서](../TOKEN_TECHNICAL_REVIEW.md)와 ADR0090~0092·[고정 compiler ADR0094](../adr/0094-pinned-solc-0811-browser-artifact.md)다. 제품 CLI/Adapter·DB/UI·원래 판정은 변경하지 않았다.

## 실제 관측

시작 `2026-10-24T18:10:32.964Z`, 종료 `2026-10-24T18:10:36.188Z`이며 한국 시각으로2026-10-25다. 소스 HTML의 원래 취득 시각·앞선 오프라인 분석 시각과 이번 관측 시각을 구분한다.

기준 블록 `26264212`, hash `0xc97488e9c325f4256e78cb2d686be7eb1b2b7f16fdcd1c40b6d624e7acb169b5`. 코드·슬롯 요청은 EIP-1898 blockHash/requireCanonical을 사용했고, 종료 chainId·같은 높이의 헤더 재확인이 일치했다(`HASH_PINNED_RECHECKED`). 응답 진실성·합의·최종성이나 이후 블록의 상태를 인증하지 않는다.

| 메서드 | 실제 요청 수 |
| --- | ---: |
| eth_chainId | 2 |
| eth_blockNumber | 1 |
| eth_getBlockByNumber | 2 |
| eth_getCode | 3 |
| eth_getStorageAt | 5 |

13건 모두 HTTP 응답이 반환됐으며 보고서의 검증된 RPC 근거도13건이다. 구현체 코드는 포인터 해석과 의존 코드 수집에서 각각 관측됐다. EIP-1967 implementation 슬롯은 저장 후보와 같은 `0xafAC17FC3936A29CA2D2787cEd3c5d1c52007d2e`를 가리켰고 대상 코드가 있었다. beacon/admin/legacy implementation/legacy admin 슬롯은0이었다. 슬롯0으로 관리자·업그레이드 기능 부재를 단정하지 않으며, 포인터와 코드 관측은 실제 delegatecall 실행의 증명이 아니다.

## 소스 대조와 해석

두 저장 입력은 원래 SHA256과 같았다. 설치된 고정 캐시의 `0.8.11+commit.d7f03943.Emscripten.clang`으로 각각1회 컴파일에 성공했다. optimizer enabled/runs3000·libraries 빈 객체 및 evmVersion/metadata/viaIR 누락을 보존했고, outputSelection만 기존 도구 규칙으로 교체했다. 외부 빌드 스크립트·설정 추정·compiler 다운로드는 없었다.

| 제출 소스 | 이번 결과 | 범위 |
| --- | --- | --- |
| ERC1967Proxy | CONFIRMED / EXACT_RUNTIME_AT_PINNED_BLOCK | 제출 설정으로 컴파일한 전체 runtime과 해당 프록시 주소의 고정 블록 runtime hash 일치 |
| FiatTokenV1 | UNKNOWN / IMMUTABLE_VALUES_MISSING_OR_EXTRA | AST ID173 `__self` 값 미제공, 전체 재구성 대조 미확정 |

프록시 runtime hash는 양쪽 모두 `0xed040fe509076fecc53768e957b9b52a3b3fba907d9d0ed4dc029c86ec3e904e`였다. metadata를 제거하거나 부분 일치로 판정하지 않았다. 이 결과는 프록시 소스의 해당 블록 연결이며 구현체 소스·발행사 권한·안전성·공식 지원 인증으로 확대하지 않는다.

구현체의 주소나 배포 bytes에서 immutable 값을 자동 추출·입력하지 않았다. 제출 값 없는 placeholder runtime의 hash와 관측 hash의 차이를 immutable 반영 후 전체 코드 불일치로 단정하지 않는다. 생성자/배포 경위·누락 빌드 설정의 원래 값은 미확인이다. 전체 findings222는 관측·검토 항목이며 취약점222개라는 뜻이 아니다. 실패 기록1건은 immutable 입력 누락이며 자동 테스트 실패와 구분한다. 감사 입력0은 미감사 판정이 아니다. 비용 대사는 **UNKNOWN**이다.

## 비공개 근거와 검증

로컬 `.state/token-review-live-jpyc-20261025/`에 plan/config/consumed·두 입력·원본 hash 목록·execution-summary와 별도 TokenTechnicalReview1.2 READ_ONLY output을 보존했다. 원문·RPC URL·인증정보·compiler bytes를 Git/웹에 게시하지 않는다. 기존 오프라인 디렉터리15파일의 hash가 불변이며, 새 bundle8파일의 hash/길이·보고서 schema/근거·13요청의 대상/hash pin·파일0600/디렉터리0700·endpoint/인증정보 비노출을 검증했다. 결과는 `.state/agent-logs/jpyc-live-validation.json`이다.

`npm run check`는 rc0·tests541/pass541/fail0/cancelled0/skipped0이었다(`.state/agent-logs/jpyc-live-check.log`). 외부 송신 없는 boundary mock과 실제 보고서/묶음 검증도 각각 rc0이다. 사설 Fixture 자동 시험의 성공과 실제 보고서 PARTIAL을 구분한다.

Lead `a3551f4264d84323801562ae730a34c9`의 proceed 조건을 반영했다. 이번 승인 범위는 완료·소비됐다. 후속은 근거 있는 immutable 제출값·정확한 빌드 입력을 확보한 뒤 저장 관측과 별도 오프라인 대조하는 것이다. 새 RPC·공식 자료 취득·다른 대상은 이번 소비를 재사용하지 않는다.
