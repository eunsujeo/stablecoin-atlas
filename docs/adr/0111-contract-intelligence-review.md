# ADR0111: 독립 읽기 전용 Contract Intelligence & Security Review

## 승인과 범위

2026-10-26 사용자 요청은 범용 EVM 분석·자동 소스 수집·Multicall3 실제 읽기 검증·로컬 보고서 대시보드·별도 commit/push를 승인한다. 기존 토큰 검토의 수동 입력 경로와 별도다. Ethereum/Base 기본 공개 RPC 선택과 명시 RPC_URL, Sourcify/Etherscan V2 어댑터를 지원한다. 운영 Mac mini/Supabase/Atlas 웹/Collector/FX는 변경하지 않는다. 제품 LLM/서명/외부 상태 변경/스케줄을 추가하지 않는다.

## 결정

- `src/contract-review`의 독립 CLI. 단발 출력 디렉터리를 배타적으로 생성하고 계획·소비·비공개 snapshot·별도 JSON/Markdown/HTML을 보존한다. 웹은 생성 보고서만 loopback에서 제공하며 조회로 수집을 시작하지 않는다.
- 공급자는 명시 선택하며 자동 fallback/재시도/redirect·metadata/import URL 추적이 없다. 총32RPC/4GET/8MiB/120초, 응답2MiB/요청15초, 최대4주소/깊이3. 소스64파일/1MiB. 키/URL/공급자 오류 원문은 보고서·오류·콘솔에 포함하지 않는다. ETHERSCAN_API_KEY는 명시 환경만 사용한다.
- RPC 허용목록은 chainId·block header·code·storage·gas 제한 eth_call만이다. 모든 코드/슬롯/Beacon/UUPS 관측은 동일 EIP1898 blockHash+requireCanonical에 고정하고 종료 시 원래 높이의 hash를 재확인한다. 미지원/실패는 UNKNOWN이며 number fallback을 하지 않는다.
- EIP1967/Beacon/정확한 EIP1167 runtime과 직접 implementation의 UUPS UUID를 관측한다. 슬롯/UUID 신호와 실제 dispatch·업그레이드 권한을 구분하며 custom proxy 부재를 단정하지 않는다. cycle/depth/부분 실패를 보존한다.
- 소스·ABI는 비신뢰 JSON. 경로를 디스크에 풀지 않고 scripts/import callback/download를 실행하지 않는다. 검토용 사본의 Solidity pragma만 UTF-8 offset을 유지하며 공백화하여 설치 solc AST로 분석한다. 이 사본은 원래 compiler의 재컴파일/배포 검증이 아니다. 호환 실패는 UNKNOWN이다. worker는 비밀 환경 미상속·메모리256MiB·20초·출력8MiB 강제 종료 제한을 둔다. 이는 OS 보안 sandbox가 아닌 프로세스/입력 격리다.
- 제공자 원본 compiler/version/settings·소스 hash·RPC runtime hash를 기록한다. provider 검증 주장과 제공자 runtime artifact의 정확 바이트 일치, 독립 원본 재컴파일을 분리한다. 첫 버전은 독립 원본 재컴파일 NOT_RUN이다. 변경된 pragma의 compiler 출력을 배포 binding에 쓰지 않는다.
- AST의 상속 범위·함수·modifier·직접 상태 쓰기·내부/외부 호출·CALL/DELEGATECALL/STATICCALL/Yul 후보를 위치와 함께 보고한다. 함수 이름/외부 호출 패턴을 실제 취약점이나 완전한 권한/재진입 분석으로 승격하지 않는다. Slither는 설치/안전한 offline runner가 없어 NOT_RUN/UNKNOWN이며 자동 설치하지 않는다. 외부 source에 build/Slither를 자동 실행하지 않는다.
- 보고서 전체는 REVIEW_REQUIRED/UNKNOWN/명시 artifact mismatch FAIL. PASS는 개별 artifact equality에만 쓴다. 코드 패턴과 사용 위험, private 재현과 live 상태를 구분한다. Multicall3의 구체 설명은 검토한 source SHA256 일치에서만 제공한다.

## 첫 실제 검증 계획

Ethereum chainId `1`, 주소 `0xca11bde05977b3631167028862be2a173976ca11` 한 건. Sourcify 최초 GET1/124087바이트의 저장 capture `.state/contract-review-sourcify-initial.json`를 재사용하여 추가 소스 GET0, 공개 RPC를 `--public-rpc`로 명시한다. 위 최대32RPC/120초에서 읽기만 실행하고 실패 후 재시도/endpoint 전환하지 않는다. Source 최초 탐색 GET은 CLI 구현 전 직접 Node fetch로 확보했으며 이후 소비와 구분한다. 이 최초 탐색은 스트리밍 상한이 없는 수동 탐색이었고 받은124087바이트를 저장한 뒤 검증했다. 제품 취득은 스트리밍 상한을 적용한다. 실제 실행 결과와 사설 재현은 연구 기록에 남긴다.

## 검증 조건

Lead `e8e063d18e884f57be1c56e7239cec0d`: proceed. 고정 hash·원본 보존·부분 실패·비밀 제거·경로/HTML 격리·worker 제한·역할/dispatch 미확인·사설 sender/value/storage/잔여 ETH/approval 재현·운영 회귀 조건을 적용한다. 전체 요청이나 응답 원문은 공개하지 않는다.
