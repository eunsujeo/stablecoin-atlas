# Multicall3 새 runtime 단발 읽기 결과

## 결과

사용자가 [고정 실행 계획](2026-10-26-multicall3-runtime-read-plan.md)을 승인해 단발 읽기를 실행했다. 첫 `eth_chainId`가 **TLS_FAILURE**로 종료됐고 HTTP 상태코드/정상 응답/수신 바이트는 없었다. 실제 시도1회·정상 반환0·수신0바이트·GET0이며 재시도/endpoint 전환0이다. 새 v2 슬롯은 **소비 완료**다. 남은 호출3회를 재사용하지 않는다.

전체 관측은 INCONCLUSIVE, 기준 block/hash·runtime·공급자 artifact 대조는 UNKNOWN이다. `eth_getCode`와 종료 블록 재확인은 NOT_TESTED다. 실제 배포 코드가 없거나 소스와 다르다는 결과가 아니다. 기존 첫 실패는 원인 UNKNOWN으로 유지하고 이번 TLS 분류를 소급하지 않는다. 실제 코드 확인은 아직 미완료다.

## 수행 경로와 고정 경계

1. 실행 코드를 재확인하고 저장 입력3개 hash의 `--preflight` rc0 및 v2 슬롯 부재를 확인했다. 별도 추가 외부 확인 요청은 보내지 않았다.
2. `node --use-env-proxy tools/contract-review-runtime-read.mjs --execute`를 정확히1회 실행했다. Ethereum chainId1/기존 Multicall3 주소/기존 PublicNode 선택과 최대4RPC·120초·GET0·재시도/전환0을 유지했다. 기존 workspace RPC/키로 전환하지 않았다.
3. 최초 송신 전에 새 슬롯에 plan과 배타적 소비 marker를 기록했다. 실제 요청은 첫 chainId 확인에서 실패해 나머지 단계는 보내지 않았다. CLI rc1은 INCONCLUSIVE 결과이며 자동 시험 실패와 구분한다.
4. 비공개 receipt와 Markdown·소비 marker를 보존했다. 새 runtime 파일은 없다. 입력3개 hash는 실행 후에도 불변이었다. 디렉터리0700/plan·marker·receipt·Markdown0600을 확인했다. 추가 검증 manifest도0600으로 보존했다.

| 항목 | 값 |
| --- | --- |
| 주소 | `0xca11bde05977b3631167028862be2a173976ca11` |
| 새 실행 시작(UTC) | `2026-10-26T05:20:38.812Z` |
| 새 실행 종료(UTC) | `2026-10-26T05:20:38.855Z` |
| 기준 블록 관측 시각 | UNKNOWN; 위 시각은 실패 실행 시각 |
| 중단 단계 | PIN / READ_OR_VALIDATION_FAILED |
| transport 분류 | TLS_FAILURE; `eth_chainId`, FAILED, bytes0, httpStatus 없음 |
| 입력 불변 | true / 원래 capture·plan·snapshot3개 hash 일치 |
| 결과 receipt SHA256 | `6f62fa74a52faa87e15842878296da12f8de992ef80f9897015dae56643f4def` |
| 비용 | UNKNOWN |

## TLS 분류의 의미와 미확인

이 분류는 연결 단계에서 허용목록에 있는 구조화된 인증서 검증 관련 code가 확인됐다는 의미다. 원시 code/message/stack/cause·서버 인증서·URL은 저장하지 않았으므로 정확한 인증서 오류 종류나 만료/체인/hostname 중 무엇인지는 확정할 수 없다. 로컬 CA 신뢰 설정·관리형 네트워크·서버 측 인증서 중 어느 쪽이 원인인지도 미확인이다. endpoint 장애·접근 권한 거절로 단정하지 않는다.

외부 송신 없이 실행 후 로컬 Node v25.2.1의 설정 존재 여부만 확인했다. NODE_EXTRA_CA_CERTS/NODE_USE_SYSTEM_CA/SSL_CERT_FILE/SSL_CERT_DIR와 표준 proxy 변수는 모두 미설정이었다. 기본 CA 수146개는 bundled CA 수146개와 같았다. 이것만으로 CA의 내용/신뢰 일치나 실제 실패 원인을 증명하지 않는다. TLS 검증은 비활성화하지 않았으며 신뢰 저장소·인증·전역 환경을 바꾸지 않았다. 키·환경변수 값·RPC URL은 출력하지 않았다.

이어서 Node의 `tls.getCACertificates`로 기본/system 목록의 SHA256 집합을 메모리 안에서만 비교했다. 기본146개/system7개이며 system7개 모두 기본 목록에 없었다. 별도 **네트워크 없는 진단 프로세스**에만 `--use-system-ca`를 주면 기본153개가 되고 system 누락0이 됐다. 인증서 원문·subject·fingerprint 자체는 출력/저장하지 않았고 OS 신뢰 저장소/전역 설정을 변경하지 않았다. 이번 실패에서 받은 서버 인증서나 구체 오류 code가 없어 이 차이가 실제 원인이라고 확정할 수는 없다. 이 옵션으로 실제 RPC를 재실행하지 않았다.

Lead `8797e8b371064f1bb5be0893220d69ee`: proceed(결과 해석·외부 송신 없는 로컬 CA 집합 점검). 원인 단정 금지·인증서 원문/환경 값 미출력·신뢰 저장소 변경0·추가 실제 연결0 조건을 적용했다. 구현 위임/추가 agent0이며 응답 회수 완료다.

## 보존 자료와 재현

- 비공개 슬롯: `.state/contract-review-multicall3-runtime-once-20261026-v2/`의 `plan.json`, `consumed.json`, `receipt.json`, `result.md`, `verification.private.json`.
- 비공개 실행/로컬 점검 로그: `.state/agent-logs/contract-runtime-live-v2.log`, `contract-runtime-live-v2-local-tls.log`. 원문/바이트코드/로그는 Git/웹에 게시하지 않는다.
- CA 비교/진단 옵션 로그: `.state/agent-logs/contract-runtime-live-v2-ca-comparison.log`, `contract-runtime-live-v2-ca-flag.log`. 개수·집합 차이 개수·외부0·저장소 변경0만 기록했다.
- 오프라인 재현: 실행 전 준비의 [검증 기록](2026-10-26-multicall3-runtime-read-plan.md#최종-검증-결과), 전용 가상 시험 및 `--preflight`를 사용한다. 소유 슬롯에서 `--execute`를 재호출하거나 새 슬롯을 만들어 외부 실패를 재현하지 않는다.
- 원본 compiler·Slither 실행/새 다운로드·실제 거래/서명·DB/Collector/FX/대시보드·운영 배포 변경0. 기존 SOURCE_REVIEWED·개별 사설 PASS·호환성 판정도 유지한다.

## 다음 행동

외부 호출 없는 Node/OS 신뢰 목록의 차이 점검까지 완료했다. 후속 준비 작업은 이 로컬 차이를 반영한 별도의 제한된 실행 계획을 구체화하는 것이다. 새 실제 연결 확인/요청·다른 endpoint·신뢰 경로 변경을 적용한 실제 재실행은 별도 고정 계획과 사용자 승인이 필요하다. TLS 검증 비활성화로 우회하지 않는다. 이번 사용자 승인은 위 v2 단발 실행으로 소비 완료됐으며 후속 외부 실행에 재사용하지 않는다.

후속 사용자가 브라우저의 인증서 오류와 Infura 변경을 알렸다. 이 지시에 따라 [별도 Infura v3 계획](2026-10-26-multicall3-infura-runtime-plan.md)을 준비했다. OS CA 적용 경로는 실제 실행하지 않았고 기존 v2 슬롯/원본은 유지한다.

## 검증과 인계

- 실제 실행: 위 `--execute` rc1, 시도1/정상0/bytes0/GET0, INCONCLUSIVE/대조UNKNOWN. v2 소비 완료/새 runtime 파일 없음. 실제 실행을 재현 목적으로 다시 호출하지 않았다.
- `node --use-env-proxy tools/contract-review-runtime-read.mjs --preflight`: rc0, inputPins3/RPC0/GET0(실행 전). 실행 후 검증 manifest에서도 원래3파일 hash 불변이다.
- `npm run check > .state/agent-logs/contract-runtime-live-v2-check.log 2>&1`: rc0, tests647/pass647/fail0/cancelled0/skipped0. 실제 읽기 실패와 자동 시험 성공은 다른 결과다.
- 로컬 TLS 설정/CA 비교/`--use-system-ca` 진단 프로세스: 각 rc0, 추가 외부0/인증서 원문 출력0/신뢰 저장소 변경0. 현재 실행 소비를 재사용하지 않았다.
- `git diff --check`: rc0. 비공개 슬롯 디렉터리0700·모든 결과 파일0600 확인.
- [인계문](../handoff/2026-10-26-contract-runtime-read-result.md). 새로운 실제 실행 범위는 미승인 상태이므로 자동 갱신/재실행을 예약하지 않았다.
