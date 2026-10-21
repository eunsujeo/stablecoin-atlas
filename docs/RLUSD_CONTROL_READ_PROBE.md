# RLUSD 제어 후보의 한정 읽기 관측

별도 연구 도구 [rlusd-control-probe.ts](../tools/research/rlusd-control-probe.ts)는 Ethereum mainnet RLUSD proxy에서 무인자 view 후보 7개의 응답만 관측한다. 제품 CLI·AssessmentReport·공통 도메인·등록 ABI의 지원 범위를 바꾸지 않는다. [소스·ABI 조사](research/rlusd-control-abi-study.json)의 사용자 제공 ABI, 초기화 함수명 차이, 상속 dependency 미확보 한계를 유지한다.

## 호출 범위와 전제

고정 chain ID `1`, proxy `0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD`, 선언 구현 `0x9747a0d261c2d56Eb93f542068e5d1E23170fa9e`를 사용한다. 기준은 과거 [RLUSD 읽기 보고서](../reports/rlusd-readonly.json)와 그 파일 SHA-256이다. proxy 전체 runtime Keccak은 `0x23fd38dfee1f350e13b663717d03529920d67bb8f2582203b4b29b1e0bfd06b7`, 구현은 `0x77598e1b7a230cd9034edb3e524d6faf036110e996acd9f24c20c872ca7a1807`이다.

새 번호 블록·헤더를 고정하고 proxy 코드·EIP-1967 implementation 슬롯·구현 코드가 기준과 같은지 확인한다. beacon/legacy implementation 슬롯도 ZERO인지 확인하지만 이 값으로 모든 다른 경로나 권한의 부재를 증명하지 않는다. 전제가 실패하면 getter를 호출하지 않고 PRECONDITION_ERROR를 저장한다. 다른 주소/ABI/endpoint로 재시도하지 않는다.

호출 tuple은 `to=proxy`, `from=zero`, 고정 selector, 같은 번호 block tag다. 인자·state override·다른 caller·implementation 직접 호출·서명/send/setter는 허용하지 않는다. 실제 RPC는 읽기 JSON-RPC POST이며 거래 broadcast가 아니다.

| 조회 | 타입 | 미확인 항목 |
|---|---|---|
| paused() | bool | 전송/승인 차단·허용 동작 |
| DEFAULT_ADMIN_ROLE() | bytes32 | 관리자 보유자·제어 주체 |
| MINTER/BURNER/PAUSER/CLAWBACKER/UPGRADER_ROLE() | 각각 bytes32 | 역할 보유자·서명자·실제 권한 행사 |

정확히 32바이트 word만 디코딩한다. bool은 0/1만 허용하고 bytes32는 zero도 유효하다. role ID는 주소가 아니며 zero ID도 관리자 부재가 아니다. 소스 literal이 있는 5개 상수와의 차이는 candidateConsistency MATCH/MISMATCH로 별도 기록한다. MISMATCH도 정상 bytes32 응답이면 INVALID_RESPONSE로 바꾸지 않는다.

getRoleAdmin(bytes32)은 역할 인자가 있어 무인자 범위 밖이며 NOT_TESTED다. hasRole(bytes32,address)·accountPaused(address)는 선정 근거가 있는 계정 표본이 없어 NOT_TESTED다. proxy의 getImplementation과 별도 MultiSign ABI는 합치지 않는다. proxiableUUID/초기화/업그레이드 함수는 호출하지 않는다.

끝에 같은 block tag의 코드·슬롯을 재확인하고 chain 및 마지막 헤더 hash를 확인한다. 후행 실패·변화는 CONSISTENCY_ERROR이며 남은 응답을 일관된 snapshot으로 사용하지 않는다. 이 검사는 숫자 tag에 대한 provider 관측이며 atomic hash pinning·재조직 부재·최종성의 증명이 아니다.

## 실행과 보고서

```sh
node --env-file=.env.local --use-env-proxy --import tsx \
  tools/research/rlusd-control-probe.ts --out reports/rlusd-controls-readonly.json
```

RPC_URL은 환경변수로만 받고 원본 endpoint/인증 정보를 출력하지 않는다. 관리형 proxy 설정을 유지한다. 도구는 한 endpoint, redirect 미추종, 요청당 10초·1MiB·실행당 최대 24요청으로 제한한다. 허용된 hex·헤더 필드만 저장하고 잘못된 성공 payload는 null로 정제한다. RPC 오류 code/category는 보존하되 upstream 오류 원문은 생략한다.

[별도 v1 schema](../schemas/rlusd-control-probe.v1.schema.json)와 의미 검증은 요청 문맥·번호 블록·원시 word/디코딩 값·증거 참조·전후 확인을 연결한다. 출력은 기존 원자 저장기로 0600 저장하며 초기 설정/소스 검사 실패 시 기존 출력을 보존한다. PRECONDITION_ERROR·CONSISTENCY_ERROR는 보고서를 저장하고 exit 1, OBSERVED·PARTIAL은 exit 0이다. OK는 디코딩 성공이고 전체 verdict는 INCONCLUSIVE, support/source/authority/issuer/native는 UNKNOWN, 실제 행위 실행은 NOT_TESTED다.

## 2026-10-20 실제 읽기

[관측 보고서](../reports/rlusd-controls-readonly.json)는 완료 시각 `2026-10-20T03:17:42.820Z`, 블록 `26231053`, 헤더 `0x6d250264d8df631b4b78bfe35dad2ae04b94b26fb5839c6115b6ea133440b072`에서 OBSERVED·7/7 OK를 기록했다. 한 번 실행해 **22개 RPC 요청·23개 증거**를 남겼으며 서명/거래는 없었다.

- paused() 응답은 false다. 전송·승인 허용을 검증한 결과는 아니다.
- DEFAULT_ADMIN_ROLE()은 32바이트 zero ID였다. 관리자 주소나 권한 부재가 아니다.
- 나머지 role ID 5개는 후보 소스 literal과 MATCH였다. 실제 역할 보유자는 조회하지 않았다.
- proxy/구현 전체 코드·선언 슬롯·마지막 헤더 확인은 일치했다. 전체 소스·ABI 동일성이나 실제 dispatch·권한 인증으로 승격하지 않는다.

다음에 계정 없이 보강할 수 있는 읽기는 관측된 role ID의 getRoleAdmin이다. 그 결과도 역할 간 관리 관계의 응답이며 보유자/권한 행사와 구분해야 한다. 계정별 hasRole/accountPaused는 적절한 공개 표본 선정이 먼저다.

후속 [별도 역할 관리 관계 명령](RLUSD_ROLE_ADMIN_PROBE.md)은 같은 실행에서 새로 읽은 role ID만 getRoleAdmin 인자로 허용했다. 기존 무인자 모드의 allowlist/24요청 제한/보고서 형식은 그대로이며, 과거 보고서는 변경하지 않았다.
