# RLUSD 역할별 관리자 역할 응답

[별도 연구 명령](../tools/research/rlusd-role-admin-probe.ts)은 같은 실행의 새 [무인자 probe](RLUSD_CONTROL_READ_PROBE.md)에서 읽은 role ID 6개만 `getRoleAdmin(bytes32)`의 인자로 사용한다. 역할 간 관리 관계의 응답 관측이며 보유자·서명자·키 통제·실제 권한 행사의 인증이 아니다. 제품 Assessment/ABI와 구분한다.

## 전제와 실행 경계

기본 probe의 chain1·proxy·구현·전체 runtime hash와 source-study hash를 유지한다. coherent OBSERVED/PARTIAL과 6개 역할 getter의 canonical OK가 모두 있어야 관계 읽기를 시작한다. paused 실패와 역할 ID 실패는 구분하며, 실패한 ID를 과거 보고서나 소스 상수로 채우지 않는다. CLI는 저장된 base 보고서를 입력받지 않고 같은 실행에서 새 probe를 실행한다.

새 명령은 base가 고정한 번호 블록·헤더를 그대로 사용하며 blockNumber/latest를 다시 선택하지 않는다. 호출은 동일 proxy, zero caller, selector `0x248a9ca3` + 정확한 32바이트 observed role ID, 같은 block tag만 허용한다. 반환된 새로운 ID를 따라 재귀 조회하거나 계정·주소를 추정하지 않는다. 6개 getter의 이름과 증거 연결을 유지하므로 입력 ID가 같은 별칭도 별도 행으로 남긴다.

관계 호출 전 chain/header/code/슬롯을 확인한다. 호출 후 역할 ID 6개·code/슬롯·chain을 재확인하고 마지막 header hash를 검사한다. 변화·실패는 CONSISTENCY_ERROR로 기록한다. 정상 bytes32 zero와 self 관계도 유효한 응답이다. zero를 관리자 부재나 zero address로, self 관계를 실제 자기 관리 서명 권한으로 해석하지 않는다.

기본 모드 allowlist/24요청 제한은 그대로다. 공유 부분은 보호된 전송 함수의 envelope·stream 크기·timeout·sanitization·증거 처리이며 공개 arbitrary-send API를 추가하지 않는다. 관계 모드는 별도 validator/최대32요청 제한이다. 정상 실행은 base22 + 관계26 = **48개 RPC 요청**, 사전 예산 상한은 24+32=56개다. 요청당10초/1MiB·단일 endpoint·redirect 미추종을 유지하며 실패 시 endpoint·예산을 바꾸어 재시도하지 않는다.

```sh
node --env-file=.env.local --use-env-proxy --import tsx \
  tools/research/rlusd-role-admin-probe.ts --out reports/rlusd-role-admin-readonly.json
```

RPC_URL은 환경변수로만 받는다. 설치/컴파일·sign/send/setter·membership/계정 동결 조회는 하지 않는다. 사용자 제공 ABI와 소스의 초기화 함수명 차이 및 상속 dependency 공백은 그대로다. 관리형 proxy 설정을 유지한다.

## 보고서와 증거 연결

[별도 v1 schema](../schemas/rlusd-role-admin-probe.v1.schema.json)와 의미 검증이 base→raw role word→decoded ID→calldata→admin word/ID→후행 role 재검사·마지막 헤더를 연결한다. source-study hash 및 getRoleAdmin의 canonical signature/selector/view/입출력 bytes32를 확인한다.

- `baseProbe`와 관계 증거의 `e1`은 서로 다른 namespace다. 행의 참조는 `{namespace,id}`다.
- `baseProbeSha256`은 `JSON.stringify(baseProbe)`의 UTF-8 SHA-256이며 base snapshot 변형을 검출한다.
- base의 skipped.getRoleAdmin NOT_TESTED는 **무인자 단계**의 기록이다. 관계 단계 실행 상태는 `rows`에서 별도로 기록한다.
- READ_FAILED/INVALID_RESPONSE는 값을 만들어 채우지 않는다. PARTIAL은 일부 관계 응답 실패, CONSISTENCY_ERROR는 후행 snapshot 미확립이다.
- adminRoleMatches는 이번에 읽은 6개 ID 중 같은 값을 가진 getter 이름의 목록이다. 실제 계정·권한·전역 역할 목록이 아니다.

schema/의미 검증 뒤 0600 원자 저장한다. 초기 설정/소스 검사 실패 시 기존 출력은 보존한다. 전제/일관성 오류는 보고서를 저장하고 exit1, OBSERVED/PARTIAL은 exit0이다. 모든 경우 verdict INCONCLUSIVE, source/authority/support/issuer/native UNKNOWN, membership/behavior NOT_TESTED다. 숫자 block tag와 provider의 전후 응답은 atomic hash pinning·최종성·재조직 부재의 증명이 아니다.

## 2026-10-20 관측

[새 읽기 보고서](../reports/rlusd-role-admin-readonly.json)는 완료 시각 `2026-10-20T03:39:56.253Z`, 블록 `26231164`, 헤더 `0xf0c931bb543e2926b8547d49a5bd23714e7fc6d2f41f9f80f4be746ae336b7ec`에서 OBSERVED 6/6 OK다. base22개 + 관계26개 =48개 요청이며 base23개 + 관계26개 =49개 증거다.

| 입력 역할 getter | adminRoleMatches | 입력 ID와 반환 ID가 같음 |
|---|---|---|
| DEFAULT_ADMIN_ROLE() | DEFAULT_ADMIN_ROLE() | true |
| MINTER_ROLE() | DEFAULT_ADMIN_ROLE() | false |
| BURNER_ROLE() | DEFAULT_ADMIN_ROLE() | false |
| PAUSER_ROLE() | DEFAULT_ADMIN_ROLE() | false |
| CLAWBACKER_ROLE() | DEFAULT_ADMIN_ROLE() | false |
| UPGRADER_ROLE() | DEFAULT_ADMIN_ROLE() | false |

반환 adminRoleId는 모두 32바이트 zero이며 같은 실행의 DEFAULT_ADMIN_ROLE ID와 같았다. 역할 ID 6개 후행 응답은 MATCH이고 code/슬롯/chain/마지막 헤더도 일치했다. 실제 관리자 계정·서명 정책·역할 부여/회수 성공·민팅/동결 실행은 미검증이다.

다음 공백은 근거 있는 공개 계정 표본을 이용한 hasRole/accountPaused, 또는 공식 출처와 과거 역할 이벤트로 후보 계정을 찾는 별도 조사다. 임의 고객 계정이나 반환 role ID를 주소로 대입하지 않는다.

후속 [계정 후보 배포 조사](RLUSD_ACCOUNT_CANDIDATES.md)는 RPC 영수증 null 때문에 후보 출처를 대조하지 못했다. 실제 표본을 얻은 것으로 표시하지 않으며 membership/accountPaused는 미실행 상태를 유지한다.
