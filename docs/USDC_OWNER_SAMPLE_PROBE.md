# Ethereum USDC owner 표본의 blacklist 응답

[별도 연구 도구](../tools/research/usdc-owner-sample-probe.ts)는 같은 실행의 새 기본5getter [USDC probe](USDC_CONTROL_READ_PROBE.md)를 검증한 뒤, coherent OBSERVED/PARTIAL과 canonical·nonzero owner 응답이 성립할 때만 주소 하나를 선정한다. 다른 getter의 개별 실패와 owner 선정 실패를 구분한다. 과거 보고서·임의 지갑·역할 ID로 대체하지 않는다. 이 표본은 제어 주소 응답의 표본이며 서비스/고객 계정 또는 실제 운영자 인증이 아니다.

## 실행·증거 경계

base의 chain1·번호 블록·헤더·proxy/선언 implementation 주소와 fullcode hash·고정 source-study SHA-256을 동결한다. USDC proxy/zero from/동일 tag의 정확한 `isBlacklisted(address)` (`0xfe575a87`)와 owner word 하나만 허용한다. USDT `isBlackListed`의 대소문자/selector를 대입하지 않는다. 후보 ABI의 signature/input address/output bool/view 및 출처 hash를 연결한다. source binding은 UNKNOWN이며 제품 ABI로 등록하지 않는다.

표본 전후에 chain·헤더·proxy/implementation fullcode·고정5개 선언 slot의 raw word를 확인한다. owner도 호출 전과 후에 다시 읽고 마지막 요청은 같은 높이의 header hash 확인이다. 슬롯은 선언 구조의 증거이며 dispatch/권한 인증이 아니다. owner 대상 함수·추가 주소 code·임의 storage·override·재귀 탐색·서명·거래는 허용하지 않는다.

base는 기존 control guard와 새 bounded transport guard를 모두 적용한다. 기본/role-code/management 명령의 allowlist·형태는 유지하며, 보호된 send hook과 선택적 transport 주입만 추가했다. 새 base32요청+표본24요청=총56요청 상한이다. 정상 경로는 base25+표본21=46 RPC이며 합성 BLOCK_REFERENCE/PROXY_OBSERVATION3개를 포함해49개 증거다. 두 단계 모두 요청당10초/1MiB·단일endpoint·redirect 미추종·오류 sanitize를 적용한다. 요청 수에 base의 전후 proxy 탐색을 포함하며 실패 시 endpoint나 예산을 변경하지 않는다.

```sh
node --env-file=.env.local --use-env-proxy --import tsx \
  tools/research/usdc-owner-sample-probe.ts --out reports/usdc-owner-sample-readonly.json
```

RPC_URL은 환경변수로 받고 관리형 proxy를 유지한다. [별도 schema](../schemas/usdc-owner-sample-probe.v1.schema.json)와 의미 검증은 immutable base snapshot hash(`JSON.stringify(baseProbe)` UTF-8 SHA-256), owner raw→canonical 주소→calldata→bool raw/value, 각 단계 namespace·증거 순서·pre/post 프레임과 단계 판정을 검사한다. base의 blacklist NOT_TESTED는 기본 단계 기록으로 보존하며 새 표본 readStatus와 구분한다. 결과는0600 원자 저장하고 초기 설정/출처 실패 시 기존 출력을 보존한다.

정확한32바이트 bool0/1만 OK다. malformed는 INVALID_RESPONSE, revert/RPC/transport 실패는 READ_FAILED이며 false/미지원으로 대체하지 않는다. 전제 실패는 PRECONDITION_ERROR/표본호출0건, 개별 표본 실패는 일관성 확인 시 PARTIAL, owner·구조 변화나 후행 실패는 CONSISTENCY_ERROR다. PRECONDITION_ERROR/CONSISTENCY_ERROR는 보고서 저장 후 exit1, OBSERVED/PARTIAL은 exit0이다. 번호 tag/provider 검사는 atomic hash pinning·재조직 부재·최종성 증명이 아니다.

## 2026-10-20 관측

[실제 보고서](../reports/usdc-owner-sample-readonly.json)는 완료 `2026-10-20T05:34:26.335Z`, 블록 `26231733`, 헤더 `0xa877c6c244100b6b1a01d931caf2d7294a6a97e83448a3dfc803100db8324bd2`에서 OBSERVED/OK를 기록했다.

| 항목 | 관측 |
|---|---|
| fresh owner 표본 | 0xFcb19e6a322b27c06842A71e8c725399f049AE3a |
| isBlacklisted(address) | false |
| 읽기 요청 | 46회, 거래 없음 |
| owner/코드/선언slot/chain/header 전후 확인 | 일치 |

false는 해당 블록/caller/표본의 응답값이다. 서비스 계정 전체의 상태·전송/승인 가능·미래 정책·실제 권한 행사로 일반화하지 않는다. 전체 INCONCLUSIVE, source/authority/support/issuer/native UNKNOWN, 실제 행위 NOT_TESTED를 유지한다.

RLUSD는 기존 배포 receipt null 이후 새 계정 선정 근거가 없어 같은 조회를 반복하지 않았다. source 서비스의 deployer나 role ID를 역할 보유 계정으로 대체하지 않는다. 다음 공백은 USDC 서비스/고객 계정·controller/minter 표본과 RLUSD 역할 계정의 근거 확보다. 공개망 실제 권한 행사는 현재 범위 밖이다.
