# 서비스 계정 목적·출처의 로컬 입력 검증

현재 범위(2026-10-20): 이 도구와 문서는 선택적 기능/과거 구현 이력이다. 서비스 운영 검증·서비스 계정 자료 수집은 현재 완료 조건에서 제외했다. 권한은 [소스 기반 호환성 검토](STABLECOIN_COMPATIBILITY_MATRIX.md)로 정리하며 아래 입력 조건을 사용자에게 필수 자료로 재요청하지 않는다.

[별도 연구 명령](../tools/research/service-account-context.ts)은 네트워크 없이 계정 표본의 필수 입력 형식을 검사한다. 제품 `assess`·공통 도메인·기존 보고서와 분리한다. 결과는 `LOCAL_INPUT_VALIDATED_NOT_ACCOUNT_VERIFIED`이며 계정 존재·소유권·운영자·키 통제·실제 역할/서비스 신원은 UNKNOWN, queryExecution은 NOT_TESTED, rpcAdmission은 NOT_GRANTED다. 검증 성공은 출처 자료의 진위·온체인 상태·조회/거래 실행 승인이 아니다.

## 입력

[입력 v1 schema](../schemas/service-account-context-input.v1.schema.json)는 파일당 한 context만 허용하며 batch·알 수 없는 필드·자유 설명·URL/경로·키/seed/RPC 설정 필드는 거부한다. **합성 예제**는 [테스트 Fixture](../tests/fixtures/service-account-context.json)다. 예제 주소·사용자 진술은 실제 서비스 계정 자료가 아니며 네트워크 조회에 사용하지 않았다.

| 필드 | 정책 |
|---|---|
| schemaVersion/contextKind | 1.0 / SERVICE_ACCOUNT_PURPOSE_CLAIM |
| profileId | ethereum-usdc, ethereum-usdt, ethereum-rlusd, tron-usdt |
| chainFamily/network/networkId/assetAddress | 저장된 프로필의 정확한 조합. Ethereum EVM/MAINNET/"1", TRON TRON/MAINNET/"728126428" |
| query.kind | BALANCE 또는 ALLOWANCE |
| BALANCE | holder 한 개만 허용 |
| ALLOWANCE | owner·spender를 모두 요구. holder 혼입 거부 |
| 각 계정 | address, purpose, provenance 필수 |
| purpose | BALANCE: DEPOSIT_REVIEW/WITHDRAWAL_REVIEW/SWEEP_REVIEW. ALLOWANCE: 양쪽 모두 ALLOWANCE_REVIEW |
| provenance | kind(USER_STATEMENT/PUBLIC_REFERENCE), referenceId, recordedAt, scope(ACCOUNT_PURPOSE_ONLY) |

EVM 주소는 `0x`+40hex이며 전체 소문자/전체 대문자는 허용해 checksum 형태로 정규화하고 혼합 대소문자는 checksum을 먼저 검증한다. TRON은 Base58Check 또는 41-prefix hex(`0x41` 포함)를 Base58로 정규화한다. 형식·prefix/checksum만으로 실제 체인 소속·mainnet 계정 존재를 확인하지 않는다. 자산 주소는 저장된 연구 참조와 대조하며 새 공식 지원/주소 인증으로 표시하지 않는다. Solana/XRPL 입력은 이번에 지원하지 않는다.

정규화 후 zero와 해당 토큰 계약 자체를 계정 표본으로 거부한다. 다른 계약 주소라고 자동 거부하거나 EOA로 판정하지는 않는다. owner=spender는 명시적인 SAME_ACCOUNT 문맥으로 허용하지만 위임/권한의 근거는 아니다. 파일당 한 표본 문맥이므로 중복 record 병합·출처 합성은 수행하지 않는다.

referenceId는 소문자로 시작하는1..64자의 `[a-z0-9._-]` 로컬 식별자다. URL·파일 경로로 해석하거나 열지 않는다. PUBLIC_REFERENCE라는 입력도 공개 자료의 진위나 해당 계정과의 관계가 검증됐다는 뜻이 아니다. recordedAt은 유효한 UTC `YYYY-MM-DDTHH:mm:ss.sssZ`만 허용하고 로컬 검증 시각보다 미래이면 거부한다. UTC 형식 검증은 그 진술이 실제 그때 작성됐다는 증명이 아니다.

## 실행·출력

```sh
node --use-env-proxy --import tsx tools/research/service-account-context.ts \
  --input tests/fixtures/service-account-context.json \
  --out reports/service-account-context-synthetic.json
```

RPC_URL·TRON_RPC_URL이나 인증 정보가 필요 없다. 명령은 입력 파일만 읽고 출처 reference를 해석하거나 네트워크·서명·거래·계정 검색을 실행하지 않는다. 위 명령은 합성 입력의 로컬 실행 예시다. 실제 서비스 표본은 별도 파일에 공개 주소·목적·출처 필드를 제공해야 하며 기존 owner 제어 표본을 자동 사용하지 않는다.

입력은 최대16KiB의 UTF-8 JSON 정규파일이다. O_NOFOLLOW/nonblocking open과 열린 파일의 fstat로 symlink·디렉터리·FIFO/device를 거부하며 실제 읽기도16KiB+1 이내로 제한한다. 잘못된 UTF-8·JSON, 깊이16 초과, escaped alias를 포함한 중복 JSON key는 거부한다. 입력과 출력의 동일 경로·동일 inode hardlink도 거부한다. 부모 경로의 적대적 동시 교체를 막는 파일시스템 sandbox나 입력 파일 잠금은 아니다.

[출력 v1 schema](../schemas/service-account-context-report.v1.schema.json)는 AssessmentReport가 아니다. 검증을 통과한 입력의 원시 UTF-8 bytes SHA-256, 정규화한 공개 주소/목적, 출처 kind·시각·scope, referenceId SHA-256을 기록한다. referenceId 원문·로컬 입력 경로·고객 label은 저장하지 않는다. hash는 무결성 참조이며 익명화나 입력의 비밀 안전성을 보장하지 않는다. 허용된 주소/식별자 필드에 비밀을 넣지 않아야 하며 범용 DLP 검사기가 아니다.

의미 검증 함수 `validateServiceAccountContextReport(report, rawInput)`는 원래 입력 bytes와 기록된 검증 시각으로 결과를 재도출해 tuple·정규 주소·역할/목적·출처 digest·상태·전체 input hash를 대조한다. 입력 공백도 bytehash에 포함되므로 재직렬화한 입력은 같은 원본 증거가 아니다. schema 단독 검사를 원문/출처 인증으로 사용하지 않는다.

직렬화/검증 후 기존0600 원자 저장기를 사용한다. 성공 exit0, 입력/저장 실패 exit1이며 오류에 입력·경로·Ajv 상세를 출력하지 않는다. 실패한 입력의 원문/hash 보고서를 생성하지 않고 기존 출력과 입력을 보존한다. 출력 저장기는 기존 원자 저장 한계를 따른다([계약](REPORT_CONTRACT.md)).

## 검증 범위

테스트7개는4프로필 tuple·EVM checksum/TRON alias·zero/token-self·정확한 holder/pair·각 출처/목적·UTC·duplicate key·secret canary·과대/링크/특수파일·input/output alias·보고서 변조·0600·기존 출력/입력 보존을 검사한다. 순수 검증의 fetch 호출0건과 CLI의 잘못된 RPC 환경변수 무관 동작을 확인한다. 이 검사는 실제 서비스 계정이나 공개망 조회 검증이 아니다.

원본 입력을 검증한 뒤 기존 읽기 전용 Adapter에 연결하는 별도 실행 경로를 제공한다. 현재 결과만으로 자동 RPC admission을 허용하지 않는다. 실제 표본 없이 합성 입력과 로컬 HTTP 대조로 연결 경로를 검증했다. 실제 서비스 표본 조회에는 목적·출처를 갖춘 공개 주소가 별도로 필요하다.

후속 [명시적 읽기 실행기](SERVICE_ACCOUNT_READONLY.md)를 구현했다. 이 로컬 검증 명령의 상태·자동 RPC 미실행 경계는 유지한다.

실제 공개 계정 자료를 채울 때는 [체인별 미완성 입력 템플릿과 준비 안내](SERVICE_ACCOUNT_INTAKE.md)를 사용한다. placeholder가 남아 있는 파일은 검증에서 거부하며 RPC 입력으로 실행하지 않는다.
