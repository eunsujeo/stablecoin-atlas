# 스테이블코인 호환성 Lab 마일스톤 완료

2026-10-21 현재 합의한 소스 중심 기술 호환성 검토, 체인별 읽기 경로, 로컬 대조 검증, 공통 보고서와 공개 계정 표본 조회를 **완료**했다. 남는 제한을 기록하고 이 단계는 마감한다. 동일 조회나 모의 검증을 반복하며 완료를 미루지 않는다.

## 완료 범위

- Ethereum USDC·USDT·RLUSD, TRON USDT, Solana USDC·USDT, XRPL USDC·RLUSD의8개 프로필과 근거 비교표
- 선택 소스의 전송·승인·권한 조건 검토39개 findings 및 소스 hash/줄 범위 연결
- EVM 엔진·신규 사설 Anvil Fixture, TRON 읽기·격리 사설 TVM 대조
- Solana mint/명시 Token Account 읽기, XRPL issuer/명시 holder trust-line 읽기
- 공통 assess CLI·JSON 보고서·오프라인 정합성 validator
- 기존 구현 전체 검사212개 통과, 실패·취소·skip0. 이번 공개 조회 단계의 제품 코드 변경·전체 검사 재실행은 없음

## 최종 공개망 표본 관측

사용자 개인 지갑이나 서비스 주소 수집 없이 [Orca 공개 저장소의 Token Account 상수](https://github.com/orca-so/typescript-sdk/blob/main/src/constants/pools.ts)와 [XRPL 공식 account_lines 예제 계정](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_lines)을 조회 후보로 선택했다. 문서 기록만으로 현재 계정 상태나 자산 보유를 인증하지 않고 실제 응답을 검증했다.

| 자산 | 실제 관측 | slot / validated ledger | 읽기 RPC |
|---|---|---|---|
| Solana USDC | raw `21728679176`, decimals6 → **21,728.679176 USDC**. INITIALIZED, delegate/close authority 없음, 위임 한도0 | slot459482034 | 2 |
| Solana USDT | raw `23278820987`, decimals6 → **23,278.820987 USDT**. INITIALIZED, delegate/close authority 없음, 위임 한도0 | slot459482035 | 2 |
| XRPL USDC | 공개 holder에 해당 issuer/currency의 line **NOT_PRESENT**.2페이지 완전 조회 | ledger107797376 | 5 |
| XRPL RLUSD | 같은 공개 holder에 해당 issuer/currency의 line **NOT_PRESENT**.2페이지 완전 조회 | ledger107797376 | 5 |

Solana 두 계정은 동결 상태가 아니었지만 실제 전송을 시험한 것은 아니다. 별도 slot의 관측을 동시 snapshot으로 합치지 않는다. XRPL 두 보고서의 ledger hash도 각각 보존하며, line 부재는 잔액0·기능 미지원·계정 전체 무잔액을 뜻하지 않는다. XRPL에서 해당 자산을 실제 보유한 line의 양수 잔액·인가·동결 설정은 이번 표본으로 관측하지 못했다.

총14회 읽기 RPC이며 HTTP/RPC 오류·재시도·endpoint 전환·공개망 거래는0회다. 새 보고서4개 모두 공통 정합성 검증을 통과하고0600으로 저장했다. 원래8개 공통 보고서와 과거15개 증거 보고서는 덮어쓰지 않았다. 각 표본의 주소·출처·조회시각·slot/ledger hash·호출 내역·원본 report hash는 [최종 공개 조회 기록](research/public-account-read-closeout.json)에 연결한다.

## 마감 후 보존하는 제한

실제 전송·권한 행사·키 통제·서비스/수탁 운영·내부 장부·준비자산/상환·법적 취급 승인은 이번 검증 대상이 아니다. 소스와 배포 bytecode 전체 동일성, TRON 응답의 정확한 상태 블록/forward 대상 구현, 지갑 전체 탐색·ATA·Token-2022·XRPL Payment는 별도 확장이다. 공개 표본 읽기도 제품 PASS/SUPPORTED나 자산 안전성 인증으로 바꾸지 않는다.

**이번 단계의 필수 미완료 작업은 없다.** XRPL 양수 보유 line 관측 등의 제한은 그대로 남긴다. 추가 작업은 새로운 구체적 목표가 생겼을 때 별도 마일스톤으로 시작한다.

후속 사용자 승인된 [XRPL 양수 보유 trust-line 연구](XRPL_HELD_TRUSTLINE_OBSERVATION.md)를 완료했다. USDC/RLUSD AMM 표본의 잔액·설정을 동일 ledger의 직접 RippleState로 관측했다. 공통 account_lines Adapter는 해당 표본에서3페이지 미완료였으며 기존 INCONCLUSIVE 보고서와 분리한다. 추가 연구18회 읽기·거래0회, 제품 코드/기존212개 검사 이력은 유지한다.
