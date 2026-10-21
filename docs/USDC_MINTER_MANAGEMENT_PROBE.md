# USDC masterMinter 관리 응답 관측

이 문서는 관리 구조의 읽기 관측이다. 실제 권한 계정으로 서명한 설정/발행 거래는 실행하지 않았다. 주소 getter·코드·pointer는 구조의 근거이며 운영자 신원·서명 통제·권한 행사 성공을 입증하지 않는다. 외부 RPC는 계속 읽기 전용이다.

Circle의 고정 commit [MasterMinter 설명](https://github.com/circlefin/stablecoin-evm/blob/fc85788bc7c23cefe3df1a757133048bfddadeaa/doc/masterminter.md)은 token의 masterMinter 역할과 관리 계약의 owner, minterManager, controller, minter를 구분한다. 이 문서상 모델은 현재 배포를 인증한 결과가 아니다. [소스 조사 JSON](research/usdc-master-minter-source.json)은 공식 0.6.12 소스와 제3자 검증 자료의 0.4.24 버전을 별도로 기록한다.

Sourcify v2의 onchain 코드 응답은 기존 역할 코드 보고서와 전체 바이트가 일치했다. 그러나 재컴파일 코드는 전체 불일치이고 CBOR 교체가 보고돼 source binding은 UNKNOWN이다. 0.4.24 artifact ABI에서 무인자 address/view인 `owner()`와 `getMinterManager()`만 후보로 확인했다. 구형 metadata는 현재 비교기의 지원 형식 밖이므로 metadata 제외 비교도 UNKNOWN이며 임의로 잘라 일치 처리하지 않았다.

## 실행 경계

별도 management 도구는 먼저 새 USDC getter/role-code probe를 실행한다. 같은 번호 블록의 USDC 구조, masterMinter 주소, 7,667바이트/고정 전체 코드 hash가 모두 맞는 경우에만 두 getter를 호출한다. 기존 기본/`--role-code` 도구의 역할 주소 함수 호출 제한은 바뀌지 않는다.

```sh
node --env-file=.env.local --use-env-proxy --import tsx tools/research/usdc-minter-management-probe.ts --out reports/usdc-minter-management-readonly.json
```

관리 조회의 allowlist는 target·selector·zero from·block tag의 정확한 조합이다. USDC에는 후행 `masterMinter()`만, 관리 계약에는 `owner()`/`getMinterManager()`만 허용한다. 반환 owner/manager 주소를 새로운 호출 대상으로 등록하지 않는다. `getWorker(address)`는 controller 표본이 없어 NOT_TESTED다. controller/worker/minter 열거, 설정·승인·민팅·서명·거래 전파는 추가하지 않았다.

## 관측 결과

[새 보고서](../reports/usdc-minter-management-readonly.json)는 2026-10-20T01:24:29.115Z에 완료됐고, 번호 블록 `26230486`, 헤더 hash `0x3aad29d0780ab49dbe77ae6da708b4d44cc0518164e4349578f041a67389ee30`를 사용했다.

| 별도 namespace | 후보 getter 응답 |
|---|---|
| USDC token의 owner | `0xFcb19e6a322b27c06842A71e8c725399f049AE3a` |
| token의 masterMinter | `0xE982615d461DD5cD06575BbeA87624fda4e3de17` |
| masterMinter 관리 계약의 owner | `0xC1d9fe41D19Dd52cb3Ae5d1D3b0030B5D498c704` |
| 관리 계약의 getMinterManager | USDC proxy `0xA0b86991c6218b36c1d19D4a2e9eb0ce3606eb48`와 주소 일치 |

두 관리 getter 모두 canonical address word로 디코딩됐으며 후행 masterMinter 값·코드·마지막 헤더가 기준과 같았다. management 단계 증거는 8개, 내부 새 baseProbe 증거는 37개다. evidence ID는 각 배열 안에서만 유효하며 서로 합치지 않는다. 두 owner 응답을 하나의 관리자 주소로 정규화하지 않는다. manager pointer의 일치로 mint 경로/권한/실행 성공을 판정하지 않는다.

전체 결과는 **INCONCLUSIVE**, source binding·실제 authority·support는 **UNKNOWN**, 실제 행위는 **NOT_TESTED**다. 번호 tag의 전후 확인은 원자적 hash pinning·재조직 부재·최종성의 증명이 아니다. 기존 관측 보고서 6개를 수정하지 않고 새 파일에 저장했다.

남은 항목은 controller/worker/minter 표본·관계·한도, 관리 owner의 통제 구조, 계정별 제한 및 실제 실행 증거다. 표본 없이 임의 주소의 결과를 서비스 계정으로 일반화하지 않는다. 사설 Fixture의 권한자 성공/비권한자 거부 검증은 실제 USDC 권한 행사와 별도다. 실제 공개망 권한 행사는 현재 저장소 범위 밖이다.

후속 [과거 관리 이력 조사](USDC_ADMIN_HISTORY.md)는 새 거래 없이 과거 행사 기록을 확인하는 경로다. 현재 RPC에서는 배포 거래/receipt가 null이고 블록 조회가 RPC 4444로 실패해 검색을 시작하지 못했다. 실패를 과거 행사 부재로 해석하지 않는다.
