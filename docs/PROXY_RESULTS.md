# Phase 1 보강 — 읽기 전용 Proxy 관측 결과

실행일: 2026-10-19. 이전 [첫 세션 결과](POC_RESULTS.md)의 후속 변경이다.

## 구현

- `src/evm/proxy.ts`: EIP-1967 implementation/beacon/admin 슬롯과 exact canonical ERC-1167 runtime 검사.
- `src/evm/identity.ts`: metadata와 같은 pinned block에서 Proxy 탐색. 확인한 1차 선언 대상만 implementationAddress에 반영.
- `src/assessment.ts`: EVM-PROXY-001과 전용 증거 참조 추가. metadata와 Proxy 증거 범위를 분리.
- `fixtures/Tokens.sol`: 새 로컬 Proxy/Beacon/slot-spoof/self-target Fixture. clone은 canonical runtime으로 새로 배포.
- `tests/proxy.test.ts`: 주소 해석, 실제 로컬 RPC, 정상·부정 구조, 읽기 전용 메서드 목록, 같은 블록 유지, 증거 연결 검증.
- [ADR 0002](adr/0002-proxy-observation.md): 구조 신호와 실제 위임/업그레이드 권한의 판정 분리.

`EVM-PROXY-001`의 PASS는 선언 대상과 코드 해석 성공만 의미한다. 실제 dispatch와 업그레이드 권한은 미검증이므로 UPGRADEABILITY support는 UNKNOWN이다. 슬롯을 위조한 비위임 Fixture에서도 이 구분을 확인했다.

## 실제 검증

`npm run check`: strict 타입 검사 및 테스트 **10개 통과 / 실패 0 / 건너뜀 0**. 기존 ERC-20 회귀 테스트를 포함한다. 추가 통합 검증은 직접 생성한 Anvil에 신규 Fixture만 배포했다. 외부 RPC/운영 자산 상태 변경은 없다. 추가 Agent는 생성하지 않았다.

| 로컬 샘플 | 구조 대상 해석 |
|---|---|
| EIP-1967 직접 구현 슬롯 | RESOLVED |
| EIP-1967 Beacon 슬롯 | RESOLVED |
| canonical ERC-1167 | RESOLVED |
| 일반 토큰, 코드 없는 대상, 충돌 슬롯 | UNRESOLVED |
| 호출자별 구현 주소가 다른 Beacon | UNRESOLVED |
| 코드 없는 Beacon, revert하는 Beacon, 자기 참조 | UNRESOLVED |

별도 HTTP 테스트에서 조회 불가/잘못된 슬롯 응답을 주입해 UNKNOWN/INCONCLUSIVE를 확인했다. 읽지 못한 implementation 슬롯을 ZERO로 가정하지 않는다. Beacon 슬롯이 비었는지 확인되지 않으면 직접 구현 해석도 보류한다. admin 슬롯 조회만 실패한 경우에는 대상 해석을 유지하되 admin은 UNKNOWN이다. 슬롯의 빈 값으로 Proxy·관리자·업그레이드 기능의 부재를 주장하지 않는다.

결과 및 원시 증거: `reports/proxy-local.json`. 이 파일에는 컴파일 설정/소스 해시, 10개 구조 샘플, direct/slot-spoof/beacon/clone에 대한 독립 read-only assessment 4개를 포함한다. Probe 오류의 전체 회귀 검증은 자동 테스트 결과가 기준이다.

## Proxy 보강 당시 기본 CLI 보고서 (0 전송 추가 전)

| 프로필 | PASS | FAIL | INCONCLUSIVE | 총 결과 |
|---|---:|---:|---:|---:|
| baseline | 46 | 4 | 20 | 70 |
| exact-receipt | 43 | 7 | 20 | 70 |

`npm run lab -- --out reports/baseline.json` 및 exact-receipt 명령을 실제 실행했다. 두 종료 코드 2는 의도한 Fixture FAIL 검출이다. 기존 ERC20 결과는 바뀌지 않았으며 일반 토큰 7개의 구조 미확인 결과가 추가됐다. JSON 파싱과 증거 참조도 확인했다.

후속 ERC20-008/009/010 추가 후 최신 기본 CLI 결과는 [승인 철회 결과](ALLOWANCE_REVOCATION_RESULTS.md)의 91건이다. 위 표는 Proxy 보강 당시 기록이며 reports/baseline.json과 exact-receipt.json은 최신 실행으로 갱신된다.

## 실제 자산 조사와 남은 범위

[공식 USDC/USD₮ 주소 출처 및 최신 조회](research/ERC20_REFERENCE_ASSETS.md)에 DOCUMENTED 근거와 OBSERVED 결과를 분리했다. 최초 EIP-1967 검사에서 두 자산의 선언 대상을 해석하지 못했으며, 후속 ZeppelinOS 검사로 USDC의 선언 대상을 해석했다. USDT의 문서 기반 무반환 특성은 실제 실행 관측으로 표시하지 않았다.

### ZeppelinOS 후속 보강

[ADR 0003](adr/0003-legacy-proxy-slots.md)에 따라 implementation/admin 슬롯 관례를 추가했다. EVM-PROXY-001은 v1.1.0이다. 로컬 보고서는 16개 구조 샘플 및 6개 read-only assessment를 포함한다. 기존 샘플 외에 legacy 정상/위조/코드 없는 대상/자기 참조/modern·beacon 슬롯 충돌을 검증한다. 읽기 실패·잘못된 응답·대상 코드 조회 오류도 회귀 테스트한다. admin 실패는 구현 주소 해석과 분리한다.

실제 Mainnet 블록 26223078에서 USDC는 PASS 2 / NOT_TESTED 8, USDT는 PASS 1 / INCONCLUSIVE 1 / NOT_TESTED 8이다. USDC ZeppelinOS 슬롯의 선언 구현 주소와 대상 코드 존재만 확인했으며 실제 dispatch 및 권한은 UNKNOWN이다. 최신 보고서는 reports/usdc-readonly.json과 reports/usdt-readonly.json이다. 두 명령은 종료 코드 0으로 완료했다. 잔액은 holder 미지정으로 NOT_TESTED다.

ZeppelinOS 외 legacy/변형 Proxy, 재귀 대상, 실제 관리자 권한과 upgrade 실행은 미구현·미검증이다. 실제 자산 Fork 조작은 신규 Fixture에 한정된 현재 지침에 따라 제공하지 않는다.

개발용 Router는 요청 요약을 한 번 전달해 shadow 추천만 받았다. 모델/effort 전환, native hook 신뢰 변경, router-lead 메시지, 추가 pane 생성은 하지 않았다.
