# 토큰 기술 검토 잔여 작업과 UNKNOWN 집계

## 집계 기준

2026-10-25 저장 증거 기준이다. 현재 기술 검토 대상 5토큰의 **Ethereum 배포 전체 소스 연결은 5/5 미확인(UNKNOWN)**이다. JPYC의 Polygon/Avalanche/Kaia까지 포함한 이번 검토 목록은 **8배포 중 8배포가 전체 연결 미확인**이다. 이는 두 개의 포함 관계가 있는 분모이며 5와8을 더하지 않는다. 계약 단위로는 JPYC Ethereum 프록시1개의 이전 고정 블록 일치를 확인했다. 구현체가 UNKNOWN이므로 자산 배포 전체를 완료로 세지 않는다.

단어 UNKNOWN의 출현 횟수나 과거 보고서 사본을 세지 않는다. NOT_TESTED·INCONCLUSIVE·NOT_APPLICABLE을 UNKNOWN과 합산하지 않는다. 아래 표는 소스·배포 연결 축만 세며 각 행의 컴파일/관측 실행 상태는 별도로 적었다. Solana mint·XRPL issuer/holder·TRON 읽기와 전체33개 시장 후보는 이 EVM 기술 검토 분모 밖이다. 기존 호환성 PASS/FAIL·SOURCE_REVIEWED의 재판정이 아니다.

최신 선택 보고서의 계약 소스 단위만 따로 세면 **7개 중6 UNKNOWN·1 CONFIRMED**다(USDC1·USDT1·RLUSD1·JPYC2·JPYSC2). CONFIRMED1개는 JPYC Ethereum 프록시다. 모든 프록시/의존성의 전수 집계가 아니며 위 자산5개와 합산하지 않는다. `.state/summarize-token-review-status-20261025.py`가 최신 보고서5개의 hash·상태를 읽어 rc0/PASS로 검증했고, 비공개 `.state/agent-logs/token-review-status-20261025.json`에 분모/경로/시각을 보존했다. 새 요청·기존 보고서 수정0이다.

## 자산별 잔여 작업

| 대상 | 확인한 증거 | 소스·배포 연결 | 다음 필요한 입력/작업 |
| --- | --- | --- | --- |
| USDC Ethereum | 저장 고정 블록, solc0.6.12 컴파일/정적 경로. 명시 library 후보도 전체 runtime 불일치 | UNKNOWN | 원래 배포 build/metadata/library 대응과 후보 차이 원인. 부분 일치로 완료 처리하지 않음 |
| USDT Ethereum | solc0.4.18 저장 출력/보완 비교기. 신규 실행은 첫 송신 시도1회에서 실패 종료, 코드 관측 INCONCLUSIVE | UNKNOWN | 정확한 배포 build/metadata·원본 소스 provenance와 RPC 읽기 실패 원인. 재시도는 이번 소비로 허용되지 않음 |
| RLUSD Ethereum | 고정 solc0.8.29 확보·컴파일 성공, 함수133/정적 진입33 | UNKNOWN | immutable __self ID650의 독립 근거와 별도 고정 블록 코드 관측. V2 snapshot 차이·실제 구현 연결 미확인 유지 |
| JPYC Ethereum | 이전 고정 블록 proxy 전체 runtime CONFIRMED, 구현체 컴파일 성공 | UNKNOWN(구현체) | 실제 build/배포 manifest·근거 동반 immutable ID173 제출값. 주소/배포 코드에서 값을 자동 추정하지 않음 |
| JPYSC Ethereum | 고정 solc0.8.34 확보·proxy/implementation 컴파일 성공, 진입1/61 | UNKNOWN | 구현체 immutable __self ID1623의 독립 근거·별도 고정 블록 관측. initialize 경로 CALL_LIMIT/DECLARATION_LIMIT 보존 |
| JPYC Polygon | proxy/implementation 후보가 Ethereum의 저장 컴파일 입력과 각각 바이트 동일 | UNKNOWN | 체인별 고정 블록 관측과 구현체 immutable 근거. Ethereum 관측을 복사하지 않음 |
| JPYC Avalanche | proxy/implementation 후보가 Ethereum의 저장 컴파일 입력과 각각 바이트 동일 | UNKNOWN | 위와 동일하되 Avalanche의 별도 관측/한도 계획 필요 |
| JPYC Kaia | 저장 HTML만 있고 지원된 소스 묶음 추출 미완료 | UNKNOWN | 정확한 소스·compiler/settings·구현체 식별자 확보. 다른 체인 소스를 대입하지 않음 |

자산별 원래 결과는 [USDC](2026-10-25-usdc-offline-source-review.md), [USDT 신규 단발 결과](2026-10-25-usdt-live-runtime-result.md), [RLUSD·JPYSC 신규 분석](2026-10-25-rlusd-jpysc-offline-source-review.md), [JPYC](2026-10-25-jpyc-token-review-live.md), [JPYSC/JPYC 저장 소스](2026-10-25-jpy-public-html-source-review.md)를 따른다. 초기 입력 미확보/미컴파일 문서는 당시 기록으로 보존하며 이 최신 집계와 합산하지 않는다.

## 이번 다른 토큰의 오프라인 진전

`.state/advance-other-token-inputs-20261025.py`로 원본54파일의 SHA256 불변을 확인했다. RLUSD 저장 HTML·manifest·35소스/settings와 decoded bundle hash를 검사하고 `.state/other-token-inputs-20261025/rlusd-implementation.candidate.json`에 원본 content/settings를 보존한 입력을 새로 만들었다. settings를 소스 파일로 컴파일하지 않도록 원래 bundle과 구분했다. 표시 compiler는 `v0.8.29+commit.ab55807c`이며 전체 실행 버전 인증은 아직 NOT_TESTED다.

JPYC Ethereum/Polygon/Avalanche의 proxy/implementation 입력6개를 이전 Ethereum 실제 보고서의 artifact hash/길이와 대조해 바이트 동일함을 확인했다. 기존 컴파일 결과를 식별할 수 있는 사실이며, Polygon/Avalanche에서 compiler나 RPC를 새로 실행한 것으로 표시하지 않는다. JPYSC 입력2개의 소스 수9/41·osaka/viaIR 설정을 확인했다. 기존0.8.11/0.6.12/0.4.18을0.8.29/0.8.34 대신 사용하지 않았다.

별도 `OtherTokenInputProgress/1.0` report/input-hashes/validation은 위 새 비공개 root0700·파일0600으로 보존했다. 이번 다른 토큰 작업의 외부 호출·컴파일·다운로드는0이다. compiler 미확보는 NOT_TESTED의 원인이며 계약 결함/미감사 판정이 아니다.

## 다음 작업의 경계

RLUSD ID650·JPYSC ID1623·JPYC ID173의 [저장 immutable 소스 참조표](2026-10-25-stored-immutable-source-map.md)를 정리했다. 선언 초기화·생성자 구문·onlyProxy/notDelegated 참조 위치만 확인했고 신규 취득·재컴파일·값 제출·runtime 대조는0이다. 독립 배포 근거의 미확보와 기존 UNKNOWN 집계는 유지한다.

RLUSD·JPYSC의 compiler 확보·사설 검증·저장 입력3개 컴파일은 후속 승인으로 완료했다. 남은 우선 입력은 RLUSD/JPYSC/JPYC의 immutable 독립 근거, USDC의 원본 build/metadata/library, USDT 읽기 실패 원인과 관측이다. 신규 RPC는 주소/체인·메서드·횟수·시간을 고정한 별도 실행 계획으로 구분하며 기존 단발/취득 소비를 재사용하지 않는다. JPYSC initialize의 경로 내부 절단은 범위가 명시된 정적 검토 자료로 보존하고 전체 권한 보장으로 승격하지 않는다.

[RLUSD·JPYSC 고정 compiler 계획](2026-10-25-rlusd-jpysc-compiler-plan.md)은 총6GET으로 종료·소비했다. 두 compiler 고정 profile을 등록하고 실제 자산 입력3개를 각각1회 컴파일했다. 새 RPC0·기존107파일 불변·두1.2 보고서 PARTIAL/배포 UNKNOWN과 상세 제한은 [실행 결과](2026-10-25-rlusd-jpysc-offline-source-review.md)에 기록했다. 소스 컴파일 완료와 전체 배포 연결 완료를 구분하므로 집계5/5·8/8은 유지한다.

공통 미확인은 감사 대상 snapshot/배포 대응·compiler 독립 진위·원본 build/생성자·전체 실행 의미·실제 dispatch·비용이다. 이들은 배포 수8에 더할 독립 토큰 수가 아니며, 자료 확보 가능성도 서로 다르다. 실제 권한 행사·역할 계정 수집·서비스 장부·운영 거래를 남은 필수 작업으로 되돌리지 않는다. [ADR0026](../adr/0026-source-based-compatibility-scope.md)의 완료 경계를 유지한다.

오프라인 입력 준비 스크립트는 rc0·PASS다. 별도 Python 재독 검증도 rc0·PASS로 USDT31/다른 토큰54입력 hash·소비 plan hash·0700/0600을 확인했다. 경계 시험 포함 `npm run check`는 rc0·tests557/pass557/fail0/cancelled0/skipped0이며 `git diff --check`는 rc0이다. 이 검사 성공과 실제 관측/소스 연결의 UNKNOWN을 구분한다.
