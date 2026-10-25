# 스테이블코인 소스 검토 결과 요약

사용자가 요청한 **Kaia 전체 소스 확보 → 기존 JPYC 대조 → JPYSC 초기화 경로 보완 → 결과 통합**을 진행했다. 소스에서 확인한 함수/권한 조건과 실제 관측을 아래에 구분했다. 기존 분석을 재사용했으며 새 compiler/RPC 실행은 없다.

## 요청 작업의 결과

| 작업 | 결과 | 근거 |
| --- | --- | --- |
| 1. Kaia 구현체 원문17파일 | 완료. 정상 사용자 탭의 Input JSON 편집기 전체를 선택하고 Chrome 기본 Copy로81804바이트를 확보했다. 17개 source content·설정·중복키·경로·import26연결을 검사했다 | [취득 과정](2026-10-25-kaia-code-view-source-intake.md)와 비공개 acquisition receipt |
| 2. 기존 JPYC 소스 대조 | 완료. 경로17개가 같고 원본 content는17개 모두 바이트 DIFFERENT다. CRLF→LF 별도 진단에서17개 모두 같은 텍스트이며 다른 코드 차이는 없다. optimizer는 같고 설정 차이는 outputSelection이다 | `.state/kaia-jpyc-full-comparison-20261025/comparison.json` |
| 3. JPYSC initialize 보완 | 완료. 선언42개·참조 간선60개를 수동 확인했다. 8개0주소 거절·3쌍 역할 분리·owner override/super·모듈 초기화·도메인 설정을 보완했다 | [수동 검토](2026-10-25-jpysc-initialize-manual-review.md) |
| 4. 결과 통합 | 완료. 아래 기능/권한·관측·제한과 연결 문서를 정리했다 | 이 문서 |

Kaia 입력의 SHA256은 `40877009b3d3cde577548dbfd2e53d10a210b01ba29c2e2ec69c61235ecc81ab`다. 이는 사용자 탭의 전체 Input JSON을 클립보드로 얻은 저장물 hash이며 공급자 HTTP 원문 바이트의 인증이 아니다. 원본을 줄바꿈 정규화하거나 Ethereum 소스로 교체하지 않았다. Kaia의 선택 소스 조건은 전체17파일의 진단 비교 결과를 근거로 기존 JPYC 텍스트 검토를 재사용한다. explorer의 부분 일치를 독립 전체 runtime 일치로 바꾸지 않는다.

## 자산별 기능·권한과 관측

아래 조건은 각 문서가 고정한 소스 범위다. 현재 역할 계정이나 실제 권한 행사로 읽지 않는다.

| 자산 | 전송·승인에서 확인한 조건 | 발행사 제어의 소스 조건 | 실제 관측/제한 |
| --- | --- | --- | --- |
| USDC Ethereum | 전송의 pause/주소 제한. V2.2 승인·증감·철회는 pause 조건이며 선택 override에 주소 제한 modifier가 없다. 승인 zero-reset 강제 없음 | minter 한도, masterMinter·pauser·blacklister·rescuer·owner 경로 | 기존 고정 블록 코드/getter 관측이 있다. 저장 소스의 생성 runtime은 전체 불일치. 소스와 관측 대응 UNKNOWN |
| USDT Ethereum | local approve는 nonzero→nonzero를 거절하며 반환 bool 선언이 없다. 전송은 pause·sender/from blacklist·유한/MAX allowance 분기를 구분 | owner의 issue/redeem·pause·blacklist·차단 자금 파기·fee·deprecate 경로 | 신규 단발 읽기는 eth_chainId 시도1에서 실패해 코드 미관측. 예전 MISMATCH·소스 연구·이번 INCONCLUSIVE를 각각 보존 |
| RLUSD Ethereum | transfer/transferFrom의 명시 true·유한/MAX allowance 분기. 승인에 caller/spender/global pause 조건. V2 전송 제한의 조건부 from 예외를 구분 | MINTER/BURNER/CLAWBACKER/PAUSER/UPGRADER와 role admin·UUPS 권한 hook | 35소스 저장 입력의 컴파일/정적 관계는 확보. 이 기술 검토 묶음에는 별도 고정 블록 코드 관측이 없어 구현 연결 UNKNOWN |
| JPYC Ethereum | transfer/transferFrom·approve/승인0에 pause·관련 주소 차단 조건. MAX allowance 차감 생략·승인 zero-reset 강제 없음 | minterAdmin·minter 한도·pauser·blocklister·rescuer·owner/UUPS 경로 | 이전 블록26264212에서 프록시 전체 runtime은 CONFIRMED. 구현체 연결은 UNKNOWN·전체 PARTIAL |
| JPYC Polygon/Avalanche | 저장 proxy/implementation 후보의 소스 텍스트 검토를 재사용 | 같은 저장 소스의 권한 조건 | 각 체인의 고정 코드 관측은 없으며 Ethereum 관측을 복사하지 않음 |
| JPYC Kaia | 직접 확보한 구현체17소스와 기존 JPYC의 코드 텍스트가 줄바꿈 진단 후 같다. 위 JPYC 조건을 선택 소스 연구로 재사용 | FiatTokenV1·owner 및 minter/pauser/blocklister/rescuer·UUPS 소스 경로 | 프록시6소스와 구현체17소스 확보. UI 표시는0.8.11/optimizer3000·부분 일치이며 독립 코드 관측/전체 runtime 대조는 미실행 |
| JPYSC Ethereum | transfer/transferFrom·approve에 pause·관련 주소 차단. mint에 minter별 수신 whitelist. MAX allowance 차감 생략 | minterAdmin·whitelistManager·pauser·blacklister·seizer·assetRecoverer·2단계owner·별도upgradeAuthority | 41소스 분석과 이번 initializer 수동 보완. 기존 자동 경로 절단과 현재 배포 연결 UNKNOWN은 유지 |

근거: [USDC 선택 소스](2026-10-25-usdc-offline-source-review.md), [USDT 소스 분석](2026-10-25-usdt-offline-recompile.md)·[조회 실패](2026-10-25-usdt-live-runtime-result.md), [RLUSD 조건표](../STABLECOIN_COMPATIBILITY_MATRIX.md#evmtvm-선택-소스의-전송승인-차이)·[저장 분석](2026-10-25-rlusd-jpysc-offline-source-review.md), [JPYC·JPYSC 함수별 조건](2026-10-25-jpy-public-html-source-review.md), [JPYC 관측](2026-10-25-jpyc-token-review-live.md), [Kaia 취득](2026-10-25-kaia-code-view-source-intake.md), [JPYSC 초기화 보완](2026-10-25-jpysc-initialize-manual-review.md)。

## 남아 있는 미확인과 판정

- USDT 읽기 실패의 네트워크/HTTP/RPC 원인은 구분하지 못했다. 이번 작업에서 같은 조회를 다시 보내지 않았다.
- USDC의 기존 전체 runtime 불일치와 각 구현체 연결 UNKNOWN을 그대로 둔다. 소스 텍스트 확인은 실제 배포의 동일 실행을 인증하지 않는다.
- JPYSC 수동 검토는 특정 initialize entry의 보완이다. 제품 자동 분석의 절단 표시·assembly/storage/전체 권한 의미론 제한은 그대로다.
- 서명 기반 기능은 해당 소스의 조건을 읽었으며 실제 서명·거래 실행 증거는 없다. 외부 토큰 회수 경로의 상대 토큰 동작도 미확인이다.

이 항목들은 보고서에 명시할 관측 한계다. 이번4개 요청 작업의 미완료 수나 취약점 수로 합산하지 않는다. 기존 제품 PASS/FAIL·SOURCE_REVIEWED·PARTIAL·UNKNOWN 집계를 재판정하지 않았다.

## 근거 보존·검증

전체 Kaia input과 source17개/비교 JSON은 `.state/kaia-full-input-copy-user-tab-20261025/`와 `.state/kaia-jpyc-full-comparison-20261025/`, JPYSC 수동 근거는 `.state/jpysc-initialize-manual-20261025/`에0700/0600으로 보존했다. 기존134증거파일의 hash는 불변이다. 새 자료 시각/hash와 과거 소스 취득·블록·분석 시각을 각각 유지한다. 원문은 Git/웹에 게시하지 않는다.

Kaia 17소스/26import·전체 content·원본/CRLF 진단 차이·settings 차이 검사는 rc0/PASS다. JPYSC 선언42/간선60·8개0주소 guard·3쌍 분리·빈 unchained7개·owner override/super 검사는 rc0/PASS다. 별도 Python 재독도 rc0/PASS로 새 소스 hash·수동 evidence/간선·기존134hash·0700/0600·문서 링크를 확인했다.

`npm run check`: rc0·tests564/pass564/fail0/cancelled0/skipped0 (`.state/agent-logs/kaia-jpysc-four-tasks-check.log`)。`git diff --check`: rc0。검사 성공과 소스 검토 완료를 실제 토큰 실행 성공으로 바꾸지 않는다.
