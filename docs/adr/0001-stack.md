# ADR 0001 — TypeScript / Node.js 단일 애플리케이션

날짜: 2026-10-19. 상태: 채택.

## 결정

Node.js 24.5+와 strict TypeScript, viem ABI 도구, solc-js, Anvil, Node 내장 테스트 러너를 사용한다. 현재 검증 환경은 Node 25.2.1 / Anvil 1.7.1이다. 런타임/개발 의존성은 package-lock.json으로 고정한다. 애플리케이션은 단일 언어, 검증 대상 Fixture는 Solidity로 작성한다.

## 비교

아래 평가는 이 프로젝트의 개발 생산성에 대한 판단이며 각 언어 SDK의 기능 동일성을 보장하는 점수표가 아니다. 미구현 체인의 SDK는 아직 실증하지 않았다.

| 기준 | TypeScript / Node | Python | Go | Kotlin / Spring |
|---|---|---|---|---|
| EVM | viem, ABI 도구·타입 | web3.py, 빠른 탐색 | Geth, 생성형 바인딩 | web3j, JVM 바인딩 |
| TRON | 공식 문서의 TronWeb 직접 사용 | 별도 SDK 검토 필요 | 별도 SDK 검토 필요 | 별도 SDK 검토 필요 |
| Solana | 공식 문서의 Solana Kit | 별도 SDK 검토 필요 | 별도 SDK 검토 필요 | 별도 SDK 검토 필요 |
| 로컬 체인/테스트넷 | JSON-RPC, Anvil 연계 단순 | 가능 | 가능 | 가능 |
| 컨트랙트 테스트 | solc-js + 실제 Anvil 실행 | 별도 컴파일 연계 | 별도 컴파일/바인딩 연계 | JVM 빌드와 컴파일 연계 |
| 타입 | strict, 런타임 응답은 별도 검증 | 타입 힌트, 런타임 검증 필요 | 정적 타입 | 정적 타입/null 안전성 |
| 정밀 금액 | bigint / JSON 문자열 | int / 문자열 | big.Int | BigInteger |
| 테스트 자동화 | node:test + tsx | pytest 등 | go test | JUnit 등 |
| 로컬/Docker | Node + Anvil | Python + Anvil | 단일 바이너리 강점 | JVM 실행 환경 |
| 향후 대시보드 | 도메인 타입 공유 가능 | API 경계 필요 | API 경계 필요 | API 경계 필요 |
| 유지보수 | SDK 업데이트 검토, 작은 의존성 수 | 체인별 SDK 검토 | 바인딩 생성 관리 | 프레임워크/SDK 통합 관리 |
| 개인 생산성 | 3개 체인 JS 생태계와 일치 | 분석·스크립트 장점 | 안정적 서버 개발 장점 | 업무 서버 개발 장점, 초기 설정 증가 |

JS/TS SDK 문서와 작은 CLI의 요구가 잘 맞아 TypeScript를 선정한다. Python/Go/Kotlin도 가능하지만 초기 세 체인을 하나의 생태계로 연결하는 비용을 우선했다. Spring, 서버 프레임워크, DB, Kafka, Kubernetes, 마이크로서비스는 도입하지 않는다.

## 구현상 선택과 비용

viem의 ABI 인코딩/디코딩을 사용하되 원시 반환값은 직접 보존한다. ABI가 bool이라고 선언되어도 실제 반환값이 없거나 malformed인 경우를 구별하기 위해서다. RPC는 작은 fetch 클라이언트로 구현해 요청·응답·오류를 수집한다. Node의 `--use-env-proxy`를 사용하며 NO_PROXY를 그대로 존중한다.

최신 설치 시 solc 0.8.37의 tmp 0.2.6 의존성에 npm audit 경고가 있어 `overrides.tmp=0.2.7`을 고정했다. 컴파일 통합 테스트와 audit로 확인한다. 향후 solc가 수정 버전을 직접 사용하면 override 제거를 검토한다.

## 공식 근거

2026-10-19 조사. 문서 사이트의 latest 내용은 바뀔 수 있으며 실제 설치 버전은 lockfile이 기준이다.

- [ERC-20](https://eips.ethereum.org/EIPS/eip-20): false 처리, 선택적 metadata, Transfer/Approval 이벤트.
- [viem public actions](https://viem.sh/docs/actions/public/introduction): 조회와 서명 기능의 구분.
- [Solidity Standard JSON](https://docs.soliditylang.org/en/latest/using-the-compiler.html): 컴파일 API와 오류 처리.
- [Anvil](https://www.getfoundry.sh/anvil/index.html): 로컬 EVM 실행 도구.
- [TronWeb](https://tronweb.network/docu/docs/intro/): JavaScript SDK, 별도 TRON 실행 의미.
- [Solana SDK](https://solana.com/docs/frontend), [Token Extensions](https://solana.com/docs/tokens/extensions): JS SDK와 선택적 확장. Original Token과 별도 프로그램으로 다룬다.
- [web3.py](https://web3py.readthedocs.io/en/stable/web3.eth.html), [Geth bindings](https://geth.ethereum.org/docs/developers/dapp-developer/native-bindings-v2), [web3j](https://docs.web3j.io/latest/getting_started/manual_configuration/): 대안 생태계 확인.
- [Node 네트워크 설정](https://nodejs.org/learn/http/enterprise-network-configuration): 환경변수 기반 프록시 지원.
- [tmp advisory](https://github.com/advisories/GHSA-7c78-jf6q-g5cm): 전이 의존성 수정 근거.
