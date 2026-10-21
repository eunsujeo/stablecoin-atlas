# USDC 제어 getter 읽기 관측

2026-10-20T01:04:04.423Z에 완료한 [별도 연구 보고서](../reports/usdc-controls-readonly.json)는 AssessmentReport가 아니다. [ADR 0020](adr/0020-qualified-control-read-probes.md)에 따라, 정확한 source binding이 UNKNOWN인 상태에서도 제한된 getter의 raw 응답과 디코딩을 관측했다. 제품 `assess`의 PAUSE/BLACKLIST 시나리오를 실행하거나 판정을 변경하지 않았다.

Ethereum chain `1`, proxy `0xA0b86991c6218b36c1d19D4a2e9eb0ce3606eb48`는 [Circle 공식 주소 표](https://developers.circle.com/stablecoins/usdc-contract-addresses)의 Ethereum 참조와 일치함을 재확인했다. 선언 구현 주소·전체 runtime hash가 기존 기준과 같은 경우만 호출했다. 기준 ABI의 출처와 hash는 보고서의 sourceEvidence에 연결했다.

| 항목 | 관측 |
|---|---|
| 번호 블록 | `26230386` |
| 헤더 hash | `0x703cacabd604851a3b16ce05d6d4bfed17dfffd3944e256b800ac271273bfd74` |
| 호출 문맥 | proxy 대상, 명시적 zero from, 각 getter의 정확한 무인자 selector |
| 응답 | owner/pauser/blacklister/masterMinter address word, paused bool word: **5개 OK** |
| paused | **false**: 그 블록·caller 문맥의 응답값 |
| 전후 확인 | 같은 높이 헤더 hash·proxy code·선언 구현·구현 code 기준 일치 |
| isBlacklisted | 표본 미지정으로 **NOT_TESTED** |
| 전체 해석 | **INCONCLUSIVE**, source/authority/support/issuer/native UNKNOWN |

주소 word를 읽었다고 실제 운영자·서명자·multisig·timelock·역할 행사 가능성을 확인한 것은 아니다. paused=false로 전송 성공·미래 허용·제어 기능 부재를 판정하지 않는다. 계정별 blacklist·transfer/approve·mint/freeze/upgrade는 실행하지 않았다. 이전 metadata/source 조사 기록과 실제 응답 관측은 다른 시점의 별도 증거다.

```sh
node --env-file=.env.local --use-env-proxy --import tsx tools/research/usdc-control-probe.ts --out reports/usdc-controls-readonly.json
```

RPC_URL은 환경변수로만 읽고 URL·키·토큰은 보고서에 남기지 않는다. 기본 보고서 경로를 다시 사용하면 덮어쓰므로 관측을 보존하려면 다른 `--out` 경로를 지정한다. 전제/일관성 오류도 partial evidence를 저장한 뒤 exit 1로 끝낸다. 개별 getter 오류는 PARTIAL과 READ_FAILED/INVALID_RESPONSE로 보존한다. source ABI 출처 검증이나 출력 저장 자체가 실패하면 기존 보고서를 유지한다.

검증은 메서드·caller/data/block 강제, 전제 불일치 시 호출 0건, 전후 reorg/코드/transport 오류, 비정상 ABI word, 오류 비밀 canary 제거, 참조·값 변조 거부와 CLI의 0600/기존 출력 보존을 포함한다. 실제 보고서는 28개 증거를 갖는다. 번호 블록 전후 확인은 원자적 hash pinning이나 최종성의 증명이 아니다.

## 역할 주소의 선택적 코드 관측

`--role-code`는 같은 실행의 canonical address getter 응답에서 얻은 주소 4개에 한해 `eth_getCode`를 허용한다. 역할 주소에는 함수나 storage 조회를 하지 않는다. 옵션을 생략하면 기존의 5개 getter 조회와 보고서 형태가 유지된다.

```sh
node --env-file=.env.local --use-env-proxy --import tsx tools/research/usdc-control-probe.ts --role-code --out reports/usdc-role-code-readonly.json
```

2026-10-20T01:11:05.609Z에 완료한 [역할 코드 보고서](../reports/usdc-role-code-readonly.json)는 블록 `26230421`, 헤더 hash `0x998a2dfa68cc13dd441d842a4115f39442eb0e7d19ddecea1461979bdc055eec`의 관측이다. getter 주소는 앞선 관측과 같았지만 이번 실행에서 새로 읽어 사용했다.

| getter가 반환한 역할 주소 | 코드 관측 | 바이트 |
|---|---|---:|
| owner | EMPTY | 0 |
| pauser | EMPTY | 0 |
| blacklister | EMPTY | 0 |
| masterMinter | PRESENT | 7667 |

masterMinter 주소는 `0xE982615d461DD5cD06575BbeA87624fda4e3de17`, 코드 Keccak-256은 `0x02fdd843a6e0369ab3914b7f7900a2198234700330badd0c59912f81661bb811`다. 네 주소의 성공 응답을 같은 번호 블록에서 각각 다시 조회한 뒤 마지막 헤더 hash를 확인했다. 37개 증거의 주소·getter 참조·block tag·byte 길이·hash·재조회 결과를 검증했다. 기존 28개 증거 보고서는 덮어쓰지 않았다.

EMPTY/PRESENT는 해당 블록의 코드 바이트 관측이다. EMPTY를 EOA·단일 서명자·역할 부재로 판정하지 않으며 PRESENT도 multisig·계약 소유자·위임 목적지·실제 권한 행사를 입증하지 않는다. delegation marker 형태를 포함한 코드는 이번에 의미를 추적하지 않는다. `0x`와 `0x00`은 각각 EMPTY/0바이트와 PRESENT/1바이트로 구분한다. 비정상·131072바이트 초과 응답은 INVALID_RESPONSE, RPC 실패는 READ_FAILED로 남긴다. getter 실패 주소는 추정하지 않고 코드 조회를 NOT_TESTED로 유지한다.

처음 성공한 코드의 후행 조회가 달라지거나 실패하면 전체 CONSISTENCY_ERROR다. 원시 응답을 보존하되 일관된 snapshot으로 사용하지 않는다. 전체 verdict는 계속 INCONCLUSIVE이며 source/authority/support/issuer/native는 UNKNOWN이다. 다음은 코드가 관측된 masterMinter의 공식 소스·관리 구조를 별도 근거로 확인하는 작업이다.

후속 [masterMinter 관리 응답 관측](USDC_MINTER_MANAGEMENT_PROBE.md)을 별도 도구로 추가했다. 새 gate를 통과한 고정 관리 계약의 두 무인자 view 후보만 읽으며, 이 문서의 기본/role-code 모드가 임의 역할 주소 함수를 호출하도록 바뀐 것은 아니다.

후속 [USDC owner 표본 조회](USDC_OWNER_SAMPLE_PROBE.md)는 별도 새 실행의 owner 주소 하나에 한정해 isBlacklisted 응답을 관측했다. 기본 단계의 blacklist NOT_TESTED와 위 과거 보고서는 유지한다.
