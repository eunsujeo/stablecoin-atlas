# Ethereum USDT의 한정 제어 응답 조회

[연구 명령](../tools/research/usdt-control-probe.ts)은 chain1의 USDT 주소에서 고정된 무인자 view 후보7개만 읽는다. [소스·ABI 조사](USDT_CONTROL_SOURCE_RESEARCH.md)의 제3자 후보 provenance, 전체 재컴파일 불일치/source binding UNKNOWN을 유지하며 제품 ABI·AssessmentReport·공통 도메인의 지원 범위는 변경하지 않는다.

## 실행 범위

주소는 `0xdAC17F958D2ee523a2206206994597C13D831ec7`, 기준 full runtime Keccak은 `0xb44fb4e949d0f78f87f79ee46428f23a2a5713ce6fc6e0beb3dda78c2ac1ea55`다. 기존 [USDT 보고서](../reports/usdt-readonly.json)의 block26223078/e4와 파일 hash를 출처에 고정했다. 새 번호 블록/header와 전체 code가 일치할 때만 조회한다. mismatch·오류·빈code는 전제오류로 저장하고7개 모두 NOT_TESTED다. USDT에 EIP-1967 구현 슬롯을 강제하거나 기존 proxy INCONCLUSIVE를 불변성으로 바꾸지 않는다.

호출은 동일 USDT주소/zero from/고정 selector/동일 block tag tuple만 허용한다. owner·upgradedAddress 등 반환 주소를 자동 추적하지 않는다. state override·임의 인자/caller·storage·추가target·setter·sign/send는 허용하지 않는다. isBlackListed/getBlackListStatus는 계정 표본 미지정으로 NOT_TESTED다.

| 함수 | 반환 처리 |
|---|---|
| owner(), getOwner(), upgradedAddress() | 정확한32바이트·상위12바이트zero인 address word |
| paused(), deprecated() | 정확한32바이트·canonical bool0/1 |
| basisPointsRate(), maximumFee() | 정확한32바이트·bigint에서 unsigned 십진 문자열로 변환 |

uint256은0..2^256-1을 그대로 다루며 Number·소수·지수 표기로 바꾸지 않는다. 잘못된 길이/padding/bool은 INVALID_RESPONSE, revert/RPC/transport 실패는 READ_FAILED다. 실패값을0/false/미지원으로 채우지 않는다.

ownerResponseComparison은 두 getter가 각각 OK일 때만 MATCH/MISMATCH이며 한쪽 실패는 UNKNOWN이다. 일치해도 실제 운영자·키 통제·권한의 증명이 아니고 불일치도 디코딩 실패나 취약점 판정이 아니다. paused/deprecated false·zero upgradedAddress는 전송 허용·불변성·미래 동작의 보장이 아니다. fee 값은 해당 시점의 로컬 설정 응답이며 실제 수령량·전송 수수료나 전달 대상의 설정을 검증한 값이 아니다.

끝에 동일 tag의 code·chain을 확인하고 마지막 header hash를 검사한다. 변화/후행실패는 CONSISTENCY_ERROR로 raw를 보존하되 coherent snapshot으로 사용하지 않는다. 숫자 block tag/provider 전후 확인은 atomic hash pinning·최종성·재조직 부재의 증명이 아니다.

## 실행·보고서

```sh
node --env-file=.env.local --use-env-proxy --import tsx \
  tools/research/usdt-control-probe.ts --out reports/usdt-controls-readonly.json
```

RPC_URL은 환경변수로만 받고 URL/인증을 기록하지 않는다. 관리형 proxy 설정을 유지한다. 정상 경로14요청, 실행상한16요청·요청당10초/1MiB·단일endpoint·redirect 미추종이다. [공유 전송부](../tools/research/bounded-read-rpc.ts)는 보호된 함수의 fetch/envelope/size/deadline/sanitize/evidence만 제공한다. 기본 request는 거부하며 각 도구의 validator가 필요하다. 기존 RLUSD 모드의 allowlist/한도/보고서 형태는 그대로다.

[별도 v1 schema](../schemas/usdt-control-probe.v1.schema.json)와 의미 검증으로 source hash·signature/legacy constant/view·입출력·고정 tuple·raw/decoded 값·증거 참조·전후 frame을 연결한다. 원자0600 저장이며 초기 설정/소스 실패 시 기존 출력은 보존한다. PRECONDITION_ERROR/CONSISTENCY_ERROR는 보고서를 저장하고 exit1, OBSERVED/PARTIAL은 exit0이다. OK는 응답 디코딩이며 verdict는 INCONCLUSIVE, source/authority/support/issuer/native UNKNOWN, 실제 행위 NOT_TESTED다.

## 2026-10-20 관측

[실제 보고서](../reports/usdt-controls-readonly.json)는 완료 시각 `2026-10-20T04:55:28.646Z`, 블록 `26231540`, 헤더 `0xd82d212d5cf8ad5e388f1a82e183d3d3ec5b94a768a7e9d38c1a336a1bd3613c`에서 OBSERVED7/7 OK를 기록했다.14개 RPC 요청·15개 증거이며 거래는 없었다.

| 항목 | 관측 응답 |
|---|---|
| owner(), getOwner() | 모두0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828 — MATCH |
| paused() | false |
| deprecated() | false |
| upgradedAddress() | zero address |
| basisPointsRate() | 십진 문자열 "0" |
| maximumFee() | 십진 문자열 "0" |

전후 full code·chain·마지막 header는 일치했다. 원래 proxy 관측/지원 판정은 유지하며 owner 주소의 code·함수, 계정별 제한, 전송·승인·철회·실제 수수료·권한 행사는 조회/실행하지 않았다. 후속 표본은 출처와 목적을 따로 정하고 이 한정 응답을 서비스/고객 계정 전체의 근거로 일반화하지 않는다.

후속 [owner 표본 연구](USDT_OWNER_SAMPLE_PROBE.md)는 별도 새 실행에서 owner/getOwner가 일치한 주소 하나의 코드와 두 blacklist 응답을 조회했다. 위 기본 단계의 NOT_TESTED 기록과 과거 보고서는 유지한다.
