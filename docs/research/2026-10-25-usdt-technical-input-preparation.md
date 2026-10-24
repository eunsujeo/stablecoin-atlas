# Ethereum USDT 기술 검토 입력 준비

사용자 승인 범위는 **새 외부 호출 없이 로컬 소스·관측·compiler 입력을 점검하는 것**이다. 이 준비를 완료하고 기존 서비스 standard JSON의 소스/설정을 보존한 비공개 후보 입력을 생성했다. 실제 기술 검토 CLI·대상 compiler·RPC는 실행하지 않았다. UNKNOWN·PARTIAL을 줄이려는 목표에 맞춰 확인 가능한 사실과 실행에 부족한 입력을 구체화했으며 기존 판정을 삭제하거나 바꾸지 않았다.

대상은 저장 식별자의 Ethereum chainId1·`0xdAC17F958D2ee523a2206206994597C13D831ec7`이다. 이번에 공식 주소를 새로 조회하지 않았다. 주소 출처·제3자 소스 provenance와 과거 조사 상태는 [기존 소스 조사](../USDT_CONTROL_SOURCE_RESEARCH.md), 소스의 함수/modifier 조건은 [호환성 정본](../STABLECOIN_COMPATIBILITY_MATRIX.md)을 유지한다. 이번 연구는 제품 PASS/지원·발행사 원본 인증이 아니다.

## 확인한 로컬 입력

분석 시각은 `2026-10-24T18:31:03.997Z`(한국2026-10-25)다. Sourcify 원문 취득 시각 `2026-10-20T04:41:44.398Z` 및 원래 RPC 관측 시각과 구분한다. 아래 소스·metadata·ABI·서비스 원문·provenance·기존 보고서2개 총7파일의 hash가 검사 전후 불변임을 확인했다.

| 항목 | 준비 점검 결과 | 범위 |
| --- | --- | --- |
| 서비스 원문 | SHA256 `2e255dcfa76b39884b55c2165b66b5fff2e1607ff8377101908c34fb4e212886` 일치 | 기존 provenance에 고정된232094바이트 사본 |
| 소스 | `TetherToken.sol` 단일14888바이트, import 문0개 | 서비스 sources·stdJsonInput·별도 추출 소스 content 동일. compiler로 확인한 closure는 아니다. |
| 소스 무결성 | SHA256 `36bf0b5747dfe7f79a03c9bc09af63e93e352d3c61199fbf025fd2c962b485f8` 및 metadata Keccak 일치 | 저장된 제3자 자료 내부 연결. 발행사 commit 인증과 별도 |
| ABI·metadata | 기존 provenance SHA256 일치, ABI와 service.abi 구조 동일 | 제품 ABI를 변경하지 않았다. |
| compiler 표기 | `0.4.18+commit.9cf6e910`, 소스 pragma `^0.4.17` | 서비스/metadata 표기다. 해당 compiler를 실행해 얻은 전체 버전이 아니다. |
| 후보 standard JSON | 16011바이트·SHA256 `ca52238c547cbe374fa06f077e568536287ec524fe4107835d14aac67c7dff25` | service.stdJsonInput을 JSON.stringify(indent2)+최종 LF로 저장. 원래 배포 입력의 raw JSON 재현/인증은 아니다. |

후보의 settings는 libraries 빈 객체·optimizer enabled=false/runs0·remappings 빈 배열이다. evmVersion·metadata·viaIR 필드 누락을 그대로 보존했다. 소스 줄바꿈·pragma·경로를 바꾸거나 기본값을 보충하지 않았다. 후보 생성은 컴파일 성공이나 원래 배포 build 재현을 뜻하지 않는다.

## 전체 runtime 차이의 구체화

과거 `reports/usdt-readonly.json`의 e4는 UTC `2026-10-19T00:36:48.854Z`·블록 `26223078`·숫자 tag `0x19021e6`의 eth_getCode다. 서비스 onchainBytecode와 이 과거 관측의 전체 바이트는 동일하며11075바이트·Keccak `0xb44fb4e949d0f78f87f79ee46428f23a2a5713ce6fc6e0beb3dda78c2ac1ea55`다. 이번에 체인에서 다시 관측한 결과가 아니다.

| 비교 | 이번 저장 바이트 검사 결과 |
| --- | --- |
| 서비스 onchain ↔ 과거 e4 전체 | EXACT_MATCH |
| 서비스 recompiled ↔ 과거 e4 전체 | MISMATCH, 길이는 각각11075바이트 |
| 차이 바이트 | 31개 |
| 0부터 시작하는 차이 범위, 양끝 포함 | 11041~11044·11046~11072 |
| 서비스 선언 CBOR 변환 시작 offset | 11032, replace/cborAuxdata |
| offset11032 직전까지 prefix | 저장 두 배열이 같음. 전체 일치 판정으로 사용하지 않음 |
| 변환·metadata 제거·로컬 compiler 재실행 | 모두 미실행 |

차이 위치가 서비스의 보조정보 교체 표시 구간에 놓인다는 사실을 확인했다. **이 사실만으로 원래 metadata·빌드·불일치 원인이 증명되지는 않는다.** 독립 재컴파일이 아닌 서비스가 제공한 두 배열의 차이 분석이다. prefix 일치·서비스 match 표기를 전체 source binding이나 실제 권한/안전성으로 승격하지 않으며 기존 전체 MISMATCH를 보존한다.

## 실행에 부족한 입력 두 가지

1. **필요 compiler의 허용 고정 profile이 없다.** 프로젝트 기본 설치 compiler는 조회 시 `0.8.37+commit.f401782d.Emscripten.clang`이고, 별도 허용 profile은0.6.12와0.8.11이다. 요구0.4.18의 artifact/hash/실행 전체 버전은 이번 프로젝트 입력에서 확보하지 못했다. 다른 버전·임의 경로로 실행하지 않았다. 향후 artifact가 확보돼도 해당 버전의 입력/출력·AST와 분석 규칙 호환성을 사설 Fixture에서 검증해야 한다. 새 다운로드/profile 구현은 이번 준비 범위가 아니다.
2. **현재 offline CLI가 받는 고정 hash 관측 archive가 없다.** 점검한 AssessmentReport1.0은 헤더1개·chainId1개·숫자 블록 tag를 사용한다. 별도 control probe의 블록26231540·hash와 전후 코드 관측도 존재하지만 요청 tag는 숫자 `0x19042f4`이며 TokenTechnicalReview archive 형식이 아니다. [archive reader](../../src/token-review/archived-observations.ts)는 기술 검토 schema·HASH_PINNED_RECHECKED·원래 chain/header 재확인·EIP1898 코드 근거를 검사한다. 기존 보고서에 없는 근거를 만들어 변환하거나 서로 다른 블록의 관측을 합치지 않는다.

따라서 이번에 실행 준비가 모두 갖춰졌다고 표시하지 않는다. 기존 source-to-runtime binding UNKNOWN은 유지하고 독립 컴파일·새 기술 검토 실행은 NOT_TESTED다. 새로운 PARTIAL 기술 검토 보고서를 만들려고 충족되지 않은 입력으로 CLI를 실행하지 않았다. 기존1.0 보고서·SOURCE_REVIEWED·제품 판정은 그대로다.

## 후속 범위와 종료 기준

이번 준비의 종료 기준은 입력 hash/content 연결·후보 보존·compiler/관측 부족 항목 식별·검증 완료다. 이를 충족하면 이 단위를 종료하며 같은 입력 점검을 반복하지 않는다.

실제 source/runtime 검토를 요청할 경우 다음을 별도 고정한다.

- 공식 compiler 자료의 출처·정확한 artifact SHA·전체 버전·취득 경로/한도와 profile/구버전 호환성 검증 범위. 이번에 compiler metadata나 artifact URL/hash를 외부에서 새로 확인하지 않았다.
- 정확한 chainId/주소·기존 RPC의 호출/시간 한도·허용 읽기 목록·고정 blockHash와 전후 재확인을 갖춘 관측 계획. 외부 호출 전 사용자 범위를 확인하며 이전 USDC/JPYC 소비를 재사용하지 않는다.
- 변환 전 전체 runtime 비교와 불일치 보존. 누락 compiler나 header 증거를 채우는 것과 실제 전체 일치 결과를 구분한다. 두 입력 공백이 해소돼도 일치 결과를 미리 보장하지 않는다.

권한 행사는 현 범위의 완료조건이 아니며 역할 계정 수집·실제 전송/승인·서명은 추가하지 않는다. 이번 준비 결과를 이유로 새 RPC·compiler 다운로드·추가 조사를 자동 시작하지 않는다.

후속 제안의 첫 단위는 **0.4.18 compiler 취득·고정 profile·사설 호환성 검증**이다. 새 외부 요청이므로 아직 미승인/미실행이다. 제안 한도는 공식 `https://binaries.soliditylang.org/bin/list.json` 1GET(2MiB)과 같은 host의 정확한 `soljson-v0.4.18+commit.9cf6e910.js` 1GET(32MiB), 합계최대34MiB/120초·요청각30초·재시도0·redirect0·다른 host/경로 전환0이다. metadata에서 해당 path/버전/SHA256/Keccak이 확인되지 않으면 artifact를 받지 않고 종료한다. 현재 metadata나 hash를 확보했다고 표시하지 않는다. 취득 바이트는 새 비공개 디렉터리·별도 소비/receipt에 보존하고 원격 스크립트를 바로 실행하지 않는다. 확인된 hash/전체 버전을 고정하는 명시 profile과 worker 경계·구버전 AST/입출력·실패 경로를 사설 Fixture에서 검증하는 구현을 별도 승인 단위로 함께 제안한다. 실제 USDT 재컴파일/배포 대조·새 RPC는 이 첫 단위에서 제외한다. 외부 접근이 거절되면 자동 대체나 반복 취득을 시작하지 않는다.

## 비공개 산출물과 검증

Git 제외 `.state/usdt-technical-inputs-20261025/`에 `source.standard.candidate.json`·`inventory.json`·`validation.json`을 새로0700/0600으로 보존했다. inventory는 준비용 연구 자료이며 제품 AssessmentReport나 TokenTechnicalReview 결과 schema가 아니다. 원문·소스·ABI·보고서 본문·환경변수 값은 게시하지 않는다. 로컬 준비 스크립트는 credential 환경·RPC·compiler·원격 스크립트를 사용하지 않는다.

`node .state/prepare-usdt-technical-inputs.mjs`는 rc0 PASS다. 입력7파일 hash 불변·서비스/추출/후보 content/metadata hash 연결·ABI·전체 코드 차이 범위·산출물 권한을 확인했다. 외부 요청0·대상 compiler 실행0·기술 검토 CLI 실행0이다. Lead `842d5f8978254341b0555aea7700a0e6`의 proceed 조건을 반영했다.

`npm run check > .state/agent-logs/usdt-technical-input-check.log 2>&1`은 rc0·tests541/pass541/fail0/cancelled0/skipped0이다. 별도 오프라인 재확인에서 원본7파일 hash 불변을 확인했고 `git diff --check`도 rc0이다. 준비 검사 통과와 실제 USDT 기술 검토 완료를 구분한다.
