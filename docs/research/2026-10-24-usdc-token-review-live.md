# Ethereum USDC 기술 검토 CLI 최초 단발 관측

2026-10-24 사용자가 RPC 읽기 최대128회·재시도0의 실제 검증에 동의했다. 기존 등록 목록의 첫 대상 Ethereum USDC를 선택하고 [Circle 공식 주소 목록](https://developers.circle.com/stablecoins/usdc-contract-addresses)의 Ethereum 행과 정확히 대조했다. 기존 workspace RPC 설정만 사용했다. 이는 기술 검토 CLI의 실제 읽기 관측이며 보안 감사·지원/안전 승인·권한 행사가 아니다.

## 고정 실행 범위

- chainId1, USDC proxy `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`.
- getter7개: owner, paused, masterMinter, pauser, blacklister, totalSupply, decimals.
- 최대128 RPC/120초, 각 요청10초, 각 응답2MiB/합계8MiB, gas500,000/value0, 재시도0·redirect0·endpoint 전환0.
- 실행 전에 새 사설 디렉터리의 config/plan과 wx 소비 표식을 작성했다. 실행은 종료·소비 완료했으며 남은 한도로 재실행하지 않는다.
- 서버 시작/웹/DB/수집기 연결, 상태 변경·서명·거래·권한자 열거, 사용량/과금 API, 새 compiler 실행·다운로드는 하지 않았다. 비용 대사는 UNKNOWN이다.

## 실제 관측과 한계

시작 `2026-10-24T09:07:15.545Z`, 종료 `2026-10-24T09:07:19.548Z`. 기준 블록 `26261502`, hash `0xac036a606388ff09952db7fe50ed6810ec63be1ddecbd2f067158870a12990a2`. EIP-1898 blockHash/requireCanonical 조회와 종료 chainId·헤더 재확인이 일치했다. 동적 현재값이나 최종성 보장은 아니다.

실제 RPC20회가 모두 반환됐다.

| 메서드 | 횟수 |
|---|---:|
| eth_chainId | 2 |
| eth_blockNumber | 1 |
| eth_getBlockByNumber | 2 |
| eth_getCode | 3 |
| eth_getStorageAt | 5 |
| eth_call | 7 |

getter7개의 응답을 검증·디코딩했다. 해당 블록에서 paused=false, decimals=6이었다. owner/관리 getter의 값은 응답 관측이며 실제 역할 행사·키 보유 구조의 증명이 아니다.

프록시는 `ZEPPELINOS_IMPLEMENTATION_SLOT` 포인터와 대상 코드가 관측됐다. 구현체 주소와 runtime hash는 기존 [USDC 소스 연결 연구](usdc-source-binding.json)의 과거 관측과 같았다. 이는 관측 코드/포인터의 일치이며 실제 dispatch·업그레이드 권한·공식 소스의 배포 대응을 인증하지 않는다.

전체 보고서는 **PARTIAL**이다. 저장된23개 소스의 원본 content hash를 기존 sourceClosure와 대조했지만, 요구 compiler `0.6.12+commit.27d51765.Emscripten.clang`이 제품의 설치 compiler 경로에 연결되지 않아 소스 컴파일/정적 분석은 **NOT_RUN**, 배포 소스 연결은 **UNKNOWN**이다. 0.8.37로 버전/pragma를 바꾸거나 metadata를 제거해 일치시켰다고 표시하지 않았다. 과거의 전체 runtime 불일치·UNKNOWN도 보존했다.

기존 로컬 solc0.6.12 캐시 파일은 이전 기록의 SHA256 pin과 일치함을 읽기만으로 확인했다. 이번 실행에서 그 파일을 실행하거나 제품 compiler 지원으로 승격하지 않았다. 후속은 이 캐시를 신뢰된 bounded worker profile에 연결하고 저장된 이번 관측과 오프라인으로 대조하는 작업이다. 새 RPC 반복이나 새 다운로드를 완료조건으로 요구하지 않는다.

## 비공개 근거와 검증

로컬 `.state/token-review-live-usdc-20261024/`의 plan/config/consumed/result와 output의 report.json/report.md/bundle.json을 보존했다. 원문·RPC URL·키·응답 본문은 Git/웹에 게시하지 않는다. 보고서 schema/근거 참조·묶음3파일 SHA256/길이·파일0600/디렉터리0700을 확인했고, 계획·소비·결과·보고서의 endpoint/인증정보 비노출 검사도 통과했다. 원본 소스 입력·과거 보고서·기존 DB/UI는 변경하지 않았다.

Lead `dac169e8c28542fdadf8db0fd53cd455`의 proceed 조건을 반영했다. 도구와 결과 의미는 [실행 문서](../TOKEN_TECHNICAL_REVIEW.md)와 [ADR0090](../adr/0090-readonly-token-technical-review.md), [ADR0091](../adr/0091-offline-token-static-path-analysis.md)을 따른다.
