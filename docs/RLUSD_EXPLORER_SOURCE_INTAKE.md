# 사용자 제공 RLUSD HTML의 소스 추출·대조

사용자가 구현 주소 `0x9747a0d261c2d56eb93f542068e5d1e23170fa9e`의 Etherscan 페이지를 HTML로 저장해 제공했다. **이 파일에 필요한 Solidity 소스와 OpenZeppelin 의존 소스가 포함돼 있어 파일별 재전달은 필요하지 않다.** HTML·JavaScript는 실행하지 않았으며 새 네트워크 요청·설치·컴파일·RPC·권한 행사도 하지 않았다.

| 항목 | 결과 |
|---|---|
| 원본 HTML | 1,133,216 bytes, SHA-256 `f6aa69226a632f355aff9ee59dc2053316e501c860817b50015215439d44c65c` |
| 추출 결과 | Solidity35개 + settings.json1개 |
| import 연결 | source unit·상대 경로·remapping 대조,55개 모두 로컬 해결, 누락0 |
| 추출 ABI | 79항목/함수40개, 기존 사용자 제공 ABI와 파싱한 구조 전체 일치 |
| 페이지가 주장한 compiler | `v0.8.29+commit.ab55807c` |
| 추출 설정 | optimizer enabled/runs200, viaIR true, evmVersion cancun |
| 저장 | 원본 변경 없음, 새 디렉터리0700·추출 파일0600 |
| 자료 구분 | USER_PROVIDED_EXPLORER_HTML, 배포 source binding UNKNOWN |

[추출 폴더](../source-intake/rlusd/extracted-f6aa69226a63), [파일 hash/import manifest](../source-intake/rlusd/extracted-f6aa69226a63/manifest.json), [구조화 검토 기록](research/rlusd-explorer-source-review.json)을 보존했다. 원본 HTML의 기타 브라우저/페이지 내용은 공유 문서로 복사하지 않는다. `/source-intake/`는 Git 추적 제외에 추가했다.

## 어떻게 추출했는가

HTML에서 고정된 `editor_contractJsonData` 문자열 대입 한 개만 찾았다. 제한된 문자열 escape를 해석한 후 중복 key를 거부하는 JSON parser로 읽었다. 표현식·템플릿·함수·페이지 스크립트는 평가하지 않았다. 파일명 탈출/절대 경로/정규화 충돌·중복·과대 크기를 거부하고 새 소유 디렉터리에 배타 생성했다. 추출기 로컬 음성 검사는 악성 표현식·잘린/중복 literal·미지원 escape·중복 JSON key·경로 탈출을 거부했다.

페이지의 편집기 데이터는 `language/sources` bundle이고 그 안에 settings.json이 별도 항목으로 들어 있었다. 이를 원형 그대로 보존하고, Solidity35개와 설정을 합친 `compiler-input.candidate.json`도 생성했다. **이 후보 입력을 컴파일한 것은 아니다.** 사용되지 않는 추가 remapping 경로를 외부에서 취득하지 않았으며 실제 source import55개만 대조했다.

## 기존 ZIP과의 차이

| 파일/자료 | 비교 |
|---|---|
| StablecoinUpgradeable.sol | 기존 ZIP과 bytes hash 동일 |
| AccountPausableUpgradeable.sol | 기존 ZIP과 bytes hash 동일 |
| StablecoinUpgradeableV2.sol | 별도 snapshot, SHA-256 `a4abb052dc1193e3ebfc65274c559104d08256b396939059360d809dc9b2f42b` |
| V2 초기화 함수 | 새 소스는 `initializeV2`·`reinitializeV2`, 기존 ZIP은 override `initialize`·`reinitialize` |
| 기존 ABI | 새 HTML 추출 ABI와79개 항목의 전체 구조가 동일 |

따라서 이전 ZIP과 ABI의 함수명 차이를 새로운 **별도 소스 버전**으로 설명할 근거가 생겼다. 과거 ZIP을 새 HTML 소스로 덮어쓰거나 두 snapshot을 동일 commit으로 표시하지 않는다. ABI의 이름 대조와 전체 compiled ABI/배포 동일성 검증은 구분한다.

OpenZeppelin 파일 헤더에는 last-updated v5.0.0/v5.1.0/v5.3.0 등이 함께 있다. 이것은 파일별 주석이며 패키지 lock이나 전체 dependency tag가 아니다. 정확한 package version을 추정하지 않고 파일별 실제 hash·본문을 검토 근거로 사용한다.

## 새 소스로 확인한 상속 동작

[검토 JSON](research/rlusd-explorer-source-review.json)의8개 findings는 선택 함수와 줄 구간 hash를 연결한다.

- ERC20 transfer/transferFrom은 true를 반환하고 `_transfer`→override `_update`로 이어진다. core는 잔액/supply를 갱신하고 Transfer를 방출한다. 검토한 경로에 전송 수수료 차감은 없다.
- `_approve`는 nonzero owner/spender 검사 후 allowance를 대입하며 별도 zero-reset 전제는 없다. 직접 approve는 Approval을 방출하고 RLUSD의 계정/global pause 검사도 유지된다.
- transferFrom은 유한 allowance를 검사·차감하며 최대 uint256 승인량은 유지한다. 차감에 `emitEvent=false`를 사용해 추가 Approval은 방출하지 않는 경로다.
- permit은 deadline·typed-data/nonce·복구 signer와 owner의 일치를 검사한 후 `_approve`를 호출한다. RLUSD 외부 permit의 owner/spender/caller/global pause 조건은 이 상속 경로보다 먼저 적용된다.
- AccessControl의 role membership 검사, grant/revoke의 해당 role admin 제한, renounce의 caller confirmation 조건을 확인했다.
- UUPS는 onlyProxy 문맥 검사와 token의 `_authorizeUpgrade` 역할 검사를 거쳐 upgrade 루틴을 호출한다. 주소별 실제 권한·업그레이드는 실행하지 않았다.
- ERC20Pausable의 `_update`에는 whenNotPaused가 있어 RLUSD V2의 frozen-from clawback 예외를 global pause 우회로 해석하지 않는다.

이 결론은 제공된 explorer snapshot의 선택 소스 검토다. 저장 HTML의 주소·compiler·verification badge는 자료가 주장한 정보이며 독립 체인/소스 인증이 아니다. import 연결 완료도 컴파일/배포 동일성·전수 보안 감사가 아니다. 기존 실제 권한 UNKNOWN·행위 NOT_TESTED와 과거 보고서는 그대로 유지한다.

## 검증 결과

원본 HTML·추출36개 파일·8개 소스 구간의 hash,55개 import 연결, ABI 구조·설정 후보·0600 권한과 로컬 링크를 확인했다. 기존15개 보고서와 catalog hash는 유지된다. `npm run check`는182개 통과, 실패·skip0이다.
