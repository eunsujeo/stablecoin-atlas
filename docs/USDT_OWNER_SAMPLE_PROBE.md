# Ethereum USDT owner 표본의 한정 읽기

[별도 연구 도구](../tools/research/usdt-owner-sample-probe.ts)는 같은 실행의 새 [무인자 baseProbe](USDT_CONTROL_READ_PROBE.md)를 검증하고, owner()/getOwner()가 canonical·동일·nonzero 주소를 반환하며 base가 OBSERVED/PARTIAL인 경우에만 한 주소를 표본으로 선정한다. 과거 주소나 임의 지갑으로 대체하지 않는다. 선정 근거는 getter 응답이며 서비스·고객 계정 또는 운영자 인증이 아니다. 기본 probe와 제품 Assessment 계약은 유지한다.

## 조회 경계와 증거

새 표본 단계는 base의 chain1·번호 블록·헤더·전체 USDT runtime hash를 동결한다. zero caller에서 USDT의 정확한 `isBlackListed(address)` (`0xe47d6060`)와 `getBlackListStatus(address)` (`0x59bf1abe`)에 이 주소 word만 전달한다. 코드 조회는 USDT와 선정 표본에 한정한다. owner 대상 함수·추가 주소·storage·override·재귀 탐색·서명·거래는 허용하지 않는다. 소스 조사 hash와 제3자 ABI의 정확한 대소문자·view/legacy constant·address→bool 후보를 검증한다. 배포 source binding은 UNKNOWN이다.

bool은 정확한32바이트의0/1만 수용한다. 두 응답 모두 OK일 때만 MATCH/MISMATCH, 나머지는 UNKNOWN이다. code `0x`는 EMPTY/0바이트, `0x00`은 PRESENT/1바이트이며 완전한 byte-pair hex를 검사하고 decoded bytes의 Keccak을 기록한다. 실패나 malformed를 false/EMPTY/미지원으로 대체하지 않는다.

끝에 owner 두 응답·최초 성공한 표본 code(EMPTY 포함)·USDT code·chain을 재확인하고 마지막 헤더 hash를 검사한다. 변화나 후행 실패는 CONSISTENCY_ERROR, 최초 개별 조회 실패는 일관성 확인 시 PARTIAL이다. 표본 선정 전제 실패는 표본 호출 없이 PRECONDITION_ERROR다. 숫자 tag와 provider 전후 검사는 atomic hash pinning이나 최종성 증명이 아니다.

[별도 schema](../schemas/usdt-owner-sample-probe.v1.schema.json)와 의미 검증으로 raw/decoded 값·호출 tuple·증거 순서/분할·전후 검사를 연결한다. baseProbe와 ownerSample 증거 namespace는 별개다. base snapshot SHA-256은 `JSON.stringify(baseProbe)` UTF-8 기준이다. base의 blacklist NOT_TESTED는 기본 단계의 기록이며 표본 단계 readings와 구분한다. 전체 verdict INCONCLUSIVE, source/authority/support/issuer/native UNKNOWN, 실제 행위 NOT_TESTED를 유지한다.

```sh
node --env-file=.env.local --use-env-proxy --import tsx \
  tools/research/usdt-owner-sample-probe.ts --out reports/usdt-owner-sample-readonly.json
```

RPC_URL은 환경변수로만 받으며 관리형 proxy를 유지한다. base 최대16요청+표본 최대16요청=총32요청, 정상 경로26요청이다. 요청당10초/1MiB·단일endpoint·redirect 미추종이며 실패 시 endpoint/예산을 변경하지 않는다. 검증 후0600 원자 저장하고 초기 설정 실패 시 기존 출력을 보존한다. PRECONDITION_ERROR/CONSISTENCY_ERROR는 저장 후 exit1, OBSERVED/PARTIAL은 exit0이다.

## 2026-10-20 관측

[실제 보고서](../reports/usdt-owner-sample-readonly.json)는 완료 `2026-10-20T05:13:28.091Z`, 블록 `26231630`, 헤더 `0xc1b0692d64f1e8e0d080baf413449be8de7aa932df53eef699dfcf92aac6717a`에서 OBSERVED를 기록했다.26개 읽기 RPC·27개 증거이며 거래는 없다.

| 항목 | 관측 |
|---|---|
| fresh owner/getOwner 표본 | 0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828 |
| isBlackListed(address) | false |
| getBlackListStatus(address) | false |
| 두 응답 비교 | MATCH |
| 표본 code | PRESENT / 5705바이트 |
| 표본 code Keccak | 0x621a994556d636b7de0b2f1fad36188c978abc119bc04832ad8b0976331cf85a |
| owner/code 전후 확인 | MATCH |

USDT code·chain·마지막 헤더도 일치했다. PRESENT는 멀티시그·서명 정책·운영자·키 통제·실제 권한의 증명이 아니다. false는 해당 블록/caller/표본의 응답이며 서비스 계정 전체의 상태·전송 허용·미래 상태를 보장하지 않는다. 실제 전송·승인·철회·관리자 함수 실행과 서비스/고객 계정 문맥은 미검증이다.
