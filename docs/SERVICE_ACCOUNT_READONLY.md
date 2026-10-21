# 서비스 계정 원본 입력과 읽기 전용 Adapter 연결

현재 범위(2026-10-20): 이 도구와 문서는 선택적 기능/과거 구현 이력이다. 서비스 운영 검증·서비스 계정 자료 수집은 현재 완료 조건에서 제외했다. 권한은 [소스 기반 호환성 검토](STABLECOIN_COMPATIBILITY_MATRIX.md)로 정리하며 아래 입력 조건을 사용자에게 필수 자료로 재요청하지 않는다.

[별도 연구 명령](../tools/research/service-account-readonly.ts)은 [로컬 입력 계약](SERVICE_ACCOUNT_CONTEXT.md)의 **원본 bytes**를 검증하고 복사한 뒤, 그 정규 문맥에서만 기존 Adapter 요청을 만든다. 검증 보고서나 과거 owner 표본은 입력을 대신하지 않는다. 이 단계는 합성 로컬 HTTP로 검증했으며 실제 서비스 계정·외부 RPC 조회는 하지 않았다.

## 현재 지원

| 체인·입력 | 전달 내용 | 현재 동작 |
|---|---|---|
| Ethereum USDC/USDT/RLUSD BALANCE | networkId, token, holder | 기존 EVM Adapter의 잔액 조회 |
| Ethereum ALLOWANCE | owner→accountAddress, spender→spenderAddress | 명시 --evm-allowance에서 ERC20-011 getter 조회. 옵션 생략 시 NOT_IMPLEMENTED/0RPC |
| TRON USDT BALANCE | networkId, token, holder | 기존 TRON Adapter 잔액 조회 |
| TRON USDT ALLOWANCE | owner→accountAddress, spender→spenderAddress | 승인량 및 기존 Adapter의 부수 owner 잔액 조회 |

두 Adapter 모두 기존 metadata를 읽으며 EVM은 기존 Proxy 구조 관측도 포함한다. amount는 bigint→십진 문자열로 직렬화한다. owner=spender와 TRON 주소 alias는 원본 문맥의 정규화 정책을 보존한다. Solana/XRPL 실행을 추가하지 않는다.

```sh
node --env-file=.env.local --use-env-proxy --import tsx \
  tools/research/service-account-readonly.ts \
  --input .state/service-account-input.json --out reports/service-account-readonly.json
```

위 명령은 실제 목적·출처를 갖춘 공개 계정 입력이 있을 때의 사용법이다. 이번 검증에서는 실행하지 않았다. Ethereum은 RPC_URL, TRON은 TRON_RPC_URL만 선택하며 다른 체인 endpoint로 fallback하지 않는다. 입력 파일에 endpoint·키·토큰을 넣지 않는다. 기존 합성 Fixture는 실제 서비스 주소 자료가 아니며 mainnet 조회용으로 사용하지 않는다.

이 명령의 명시적인 호출이 읽기 실행 경계다. 로컬 검증 명령은 여전히 자동 네트워크를 시작하지 않고 rpcAdmission NOT_GRANTED를 유지한다. 읽기 실행도 공개망 전송·승인·서명·관리 권한을 부여하지 않는다.

## 요청·파일 경계

원본 입력은 기존16KiB/정규파일/O_NOFOLLOW/fstat/UTF-8/중복 key·경로/inode alias 검사를 거친다. 함수 호출 경계에서도 크기를 확인하고 bytes를 복사한다. await 뒤 파일이나 호출자 객체를 다시 읽어 요청을 바꾸지 않는다.

실행별 transport는32요청, 요청당10초·1MiB, 단일 endpoint, redirect 거부를 적용한다. chain/header/code·EVM 고정 Proxy slot·고정 metadata·선정 계정의 정확한 balance/allowance calldata만 허용한다. EVM 코드 추적은 같은 tag에서 관측된 선언 implementation/beacon 또는 정확한 canonical clone에 한정한다. beacon 함수는 기존 구현의 implementation()과 token/zero caller뿐이며 반환 구현을 함수 대상으로 재귀 탐색하지 않는다. owner·민팅·transfer/approve·state override·snapshot/revert·send는 추가하지 않는다.

Adapter 생성자의 선택적 transport factory만 추가했고 기본 생성자·제품 CLI는 원래 transport를 유지한다. 위32요청/응답 한도를 기존 제품 CLI 전체에 적용했다고 주장하지 않는다. 새 runner만 해당 제한을 사용한다. managed proxy 설정은 변경하지 않는다.

## 보고서와 오류

[별도 v1 schema](../schemas/service-account-readonly.v1.schema.json)는 contextValidation과 원래 직렬화된 Assessment를 독립 snapshot으로 담는다. 두 snapshot의 SHA-256은 각각 `JSON.stringify(snapshot)` UTF-8 기준이며 파일 들여쓰기·마지막 newline을 해시하는 규칙은 아니다. contextValidation 안 inputSha256은 별도로 원시 입력 bytes의 해시다.

binding은 정규 요청 tuple, 정확한 scenario ID/capability, `assessment` namespace의 증거 참조, eth_call의 전체 target/calldata/인자, raw 디코딩과 관측 금액을 연결한다. 원문 referenceId·입력 경로·RPC URL은 envelope에 저장하지 않는다. 원래 입력을 함께 받는 의미 검증으로 hash·주소/계정·금액·namespace·다른 요청의 call·중복 ID·지원 상태 변조를 거부한다. snapshot hash는 독립 인증이나 서명이 아니다.

EVM identity와 balance는 기존 executor가 각각 pin하므로 다른 번호 블록일 수 있다. binding.queryBlockOrSlot/queryBlockHash는 **선정 query의 실제 tag/header**에서 얻고 identity의 블록을 복사하지 않는다. 번호 tag/provider 확인은 atomic hash pinning·독립 검증·최종성 증명이 아니다. TRON은 latest이며 head가 같아도 query 블록과 hash는 UNKNOWN/null이다.

nested Assessment의 PASS/SUPPORTED·실패/미실행 판정은 지우거나 root로 합치지 않는다. root는 전체 INCONCLUSIVE, authority/ownership/serviceAccountIdentity/support UNKNOWN, 실제 행위 NOT_TESTED를 유지한다. 0도 특정 표본의 읽기 응답이며 권한·실제 전송 가능·서비스 계정 소유권을 입증하지 않는다.

| 결과 | 저장·종료 |
|---|---|
| OBSERVED | 검증 후0600 원자 저장, exit0 |
| NOT_IMPLEMENTED | 유효 입력과 미구현 이유/0요청을 저장, exit2 |
| 선택 query READ_FAILED/INVALID_RESPONSE | 라이브러리는 증거가 포함된 결과를 반환. CLI는 안전한 오류·exit1, 기존 출력 보존 |
| 입력·network mismatch·기동/transport·저장 오류 | 안전한 오류·exit1. 실행 전/저장 전 오류는 기존 출력과 입력 보존 |

다른 metadata 시나리오의 FAIL과 요청 query 성공은 구분한다. root OBSERVED/exit0은 선택 query 응답 연결 성공이며 모든 nested 시나리오 통과나 자산 취급 승인이 아니다. upstream 오류 원문을 출력하지 않으며 성공 metadata 전체를 범용 비밀 제거/DLP한 결과라고 주장하지 않는다.

## 검증과 다음 조건

테스트8개는4프로필 배선·EVM 두 pin·TRON pair 순서/부수 balance/0·alias·미구현 RPC0건·잘못된 입력·조회/네트워크/redirect/과대 응답 실패·변조·원본 bytes 불변·동시 요청 증거 분리·guard/예산·선언 pointer/clone·CLI env 선택/0600/원본 보존을 확인한다. 기존 입력 검증7개도 함께 통과했다.

[합성 실행 artifact](../reports/service-account-readonly-synthetic.json)는 SYNTHETIC_LOCAL_HTTP_ARTIFACT_NOT_MAINNET_EVIDENCE wrapper로 구분하며 실제 관측 카탈로그에 추가하지 않는다. 테스트 중 생성한 로컬 HTTP 응답이고 실제 스테이블코인 잔액·승인량 증거가 아니다.

현재 연결 구현은 완료했다. 실제 서비스 조회에는 체인·자산·공개 계정·목적·출처가 확보된 원본 입력이 필요하다. USDC controller/minter·RLUSD 역할 표본의 공백과 TRON 정확한 응답 블록 공백은 별도로 남는다. 새 근거 없는 실패 이력 조회 반복이나 공개망 쓰기는 다음 필수 작업이 아니다.

후속 [EVM allowance opt-in](EVM_ALLOWANCE_READONLY.md)을 추가했다. 과거 미구현/0RPC 설명은 옵션 생략 모드에 적용하며, 명시 옵션에서는 pair getter만 조회한다. 기본 제품 CLI와 TRON 동작은 유지한다.
