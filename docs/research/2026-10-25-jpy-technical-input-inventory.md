# JPYC・JPYSC 5배포 기술 검토 입력 점검

2026-10-25 기존 저장 입력만 점검했다. **5배포 모두 실제 계약의 제공 소스·의존 closure·compiler 전체 버전/settings를 연결할 입력을 확인하지 못했다.** 기술 분석·컴파일·배포 대조는 NOT_TESTED, 소스·배포 연결은 UNKNOWN으로 유지한다. 미확보는 미공개·미감사·기능 부재를 뜻하지 않는다.

[기존 현황표](2026-10-25-five-coin-network-evidence.md#jpycjpysc--후보-5조합)의 후속 입력 점검이며 [기술 검토 입력 규칙](../TOKEN_TECHNICAL_REVIEW.md#입력)을 적용한다. 새 다운로드/RPC·compiler 실행·DB/UI 변경·기존 보고서 덮어쓰기는 없다. 아래 주소와 출처는 저장 기록의 식별자이며 이번 공식 재확인이나 현재 배포 인증이 아니다.

## 배포별 확보와 누락

| 저장 deployment ID | chainId | 저장 계약 주소 | 제공 소스 / 의존 closure | 전체 compiler version / settings | 소스 출처·시각·hash 연결 |
| --- | --- | --- | --- | --- | --- |
| jpyc-ethereum | 1 | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | 미확보 / 미확보 | 미확보 / 미확보 | 미확보 |
| jpyc-polygon | 137 | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | 미확보 / 미확보 | 미확보 / 미확보 | 미확보 |
| jpyc-avalanche | 43114 | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | 미확보 / 미확보 | 미확보 / 미확보 | 미확보 |
| jpyc-kaia | 8217 | `0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29` | 미확보 / 미확보 | 미확보 / 미확보 | 미확보 |
| jpysc-ethereum | 1 | `0x6781d5631BFe47432b089e64e3EaB3b6eDd26177` | 미확보 / 미확보 | 미확보 / 미확보 | 미확보 |

식별자는 [metadata](../../data/market-registration.json)의 `newDeployments`와 `networks.networkIdentity`를 연결했다. JPYC 네 체인의 동일 주소가 동일 소스·설정·runtime을 뜻하지 않는다. proxy/implementation 여부·정확한 구현 주소도 이번에 확인하지 않았다. JPYC Prepaid는 포함하지 않는다.

## 발견한 입력과 고정 연결

| 로컬 입력 | 발견한 내용과 사용 범위 | SHA256 |
| --- | --- | --- |
| `data/market-registration.json` | 5배포 주소·chainId와 과거 공식 출처 참조. Solidity 소스 출처가 아님 | `0430e6c7a1d6ec75f5dedba02bd93ed160c35d7c9ae36a33fef52a1f32e5f1c6` |
| `docs/research/yen-stablecoins-network-coverage-2026-10-22.md` | 2026-10-22 식별자·상품·공급자 정의 조사. 이번 분석 시각과 구분 | `4a42c3e2a4ff1c18091d4f59225c48d5ecf47aee1dcae8c4aee655799c29e17a` |
| `.state/yen-expansion/source-manifest.json` | 공급자 원문 3파일의 byte/hash 연결을 다시 확인. 계약 source manifest가 아님 | `0ee1c18be46677a212562317f7785312d13c2349063bf6c44713bab9804985d4` |
| `.state/yen-expansion/llama-355.json` | JPYC 저장 시장 응답. 소스·컴파일·직접 체인 관측 근거가 아님 | `fb42936bc69a73c897b0a8f0e37e37de7e393ce208b7f8df4bd550e22c91afbe` |
| `.state/yen-expansion/llama-427.json` | JPYSC 저장 시장 응답. 소스·컴파일·직접 체인 관측 근거가 아님 | `93d24ea738165c858872083088f27c5b55b60da9a1a8ad9172d18ba864937e37` |

위 hash는 점검한 바이트 연결이며 진위·원래 취득 시각의 독립 인증이 아니다. 비공개 원문은 Git/웹에 추가하지 않았다. 시장 데이터의 Kaia 불일치와 JPYSC 전송량 3일 누락은 기존 상태를 유지한다.

## 검색 범위와 제외한 대조군

저장소의 `.state`, `source-intake`, `data`, `docs`, `fixtures`에서 symlink를 따라가지 않고 JSON/Solidity/HTML/TXT/Markdown/TOML 파일 1,507개를 확인했다. `node_modules`, `.git`, `agent-logs`와 다른 확장자 476파일은 제외했으며 32MiB 초과로 건너뛴 대상 텍스트 파일은 없었다. 홈 디렉터리·Downloads·다른 PC·원격 저장소는 점검하지 않았다. 압축 파일 내부는 풀거나 분석하지 않았으므로 그 내부의 입력 부재까지 주장하지 않는다.

인라인 `sources[*].content` 등 구조를 가진 JSON 후보 24개 중 JPYC/JPYSC 문자열이 함께 발견된 것은 `.state/token-review-smoke/input.json`과 그 출력 사본뿐이었다. 연결된 config는 chainId `31337`의 사설 Fixture이며 `ReviewOwned`, `ReviewTokenA`, `ReviewTokenB`, `ReviewProxy` 대조군이다. 실제 5배포 소스로 사용하지 않는다. 확인한 `.sol` 파일에는 대상 이름/주소 표식이 없었으며 다른 토큰의 compiler·소스·감사 자료를 이 5배포에 복사하지 않았다. 표식/JSON 구조 검색은 구문·출처 증명이 아니므로 결론은 **이 범위에서 연결 가능한 입력 미확보**로 제한한다.

점검 경로·hash·검색 제외 내역은 비공개 `.state/agent-logs/jpy-technical-input-inventory-20261025.json`에 남겼다. 표식 일치 원문은 문서에 옮기지 않았다. 현재 DB·수집기·공급자 응답 전체 재검사는 수행하지 않았다.

## 다음 입력

다음 기술 검토 대상을 사용자에게 확인한다. 권장 첫 대상은 `jpyc-ethereum`이다. 선택 배포의 제공 Solidity standard JSON(모든 import content 포함), 정확한 contract 경로/이름, compiler 전체 version, optimizer/EVM target/libraries/metadata 설정, 제공 출처·취득 시각·SHA256이 필요하다. proxy/implementation 소스는 해당 식별자를 구분하고 감사 자료가 제공되면 대상 version/commit/범위를 별도로 연결한다. 미확보 감사 자료를 미감사로 판정하지 않는다.

입력 확보 전 compiler 버전이나 경로를 추측하지 않는다. 외부 취득·새 실제 배포 읽기는 정확한 대상·입력·호출 범위를 따로 확인한 후 진행한다. 기존 승인된 오프라인 점검은 여기까지 완료했다.
