# ADR 0028: XRPL 발행자 AccountRoot 읽기 연구

상태: 채택, 2026-10-21. Solana mint 연구 다음 단계 진행 승인에 따라 XRPL USDC·RLUSD의 발행자 설정만 읽는다. 제품 Adapter/Assessment·SDK·서명·거래·trust-line/Payment 처리는 추가하지 않는다.

발행사 공식 mainnet currency+issuer를 재확인한다. 계정 관측은 해당 currency의 실제 발행/유통·가격·발행사·native 인증을 뜻하지 않는다. 운영 지갑·키·권한 행사 자료는 요구하지 않는다.

`XRPL_RPC_URL` 또는 명시적 `--public`으로 요청 전 목적지를 선택한다. 고정 순서는 `server_info` → `ledger` → 두 발행자의 `account_info`이며 최대4회다. 서버가 숫자 network_id0을 보고할 때만 진행한다. 누락을0으로 채우지 않는다. 독립적 mainnet 인증이 아닌 서버 보고값 확인이다.

API v2에서 `ledger_index=validated`를 한 번 읽고 validated=true·닫힌 ledger·hash/index와 중첩 header의 정합성을 검증한다. 이후 두 계정은 그 ledger_hash로만 요청하며 응답의 validated/hash/index/Account/LedgerEntryType을 확인한다. 다른 시점으로 재선정하지 않는다. 한 자산의 성공 관측은 다른 자산 실패와 분리하고, HTTP/transport 실패에서는 남은 호출도 중단한다.

Flags는 uint32 검증 후 bigint로 해석한다. AccountRoot lsf 비트와 AccountSet asf 번호를 구분한다. 해석하지 않은 비트도 보존한다. 비트의 true/false는 해당 설정만 뜻하며 키 통제·개별/Deep Freeze·실제 회수 가능성·amendment 활성 상태 판정이 아니다. DisableMaster도 서명 불가능의 증거가 아니다.

TransferRate의 원시 absent·0·1000000000을 구분해 보존하고 누락 시0을 합성하지 않는다. 문서의 기본 no-fee 의미와 실제 전송 실수령 검증을 분리한다. 현재 AccountSet 입력 상한을 기존 AccountRoot 검증 상한으로 적용하지 않는다. XRP Balance나 공급량은 이 연구에 포함하지 않는다.

기존 Solana 연구의10초/64KiB·redirect 거부·오류문 비노출 HTTP 전송을 공통 연구 helper로 옮겨 재사용한다. protocol envelope 검증은 각 reader에 둔다. 관리형 proxy를 그대로 존중하고 실패 후 목적지를 자동 변경하지 않는다. 원자적0600 출력과 기존 catalog/report hash는 보존한다. 로컬 모의 검증과 실제 RPC 관측을 별도로 기록하고 `npm run check`로 회귀를 검사한다.

설정 마스크의 고정 source commit/hash와 공식 식별자·RPC 출처는 [연구 결과](../XRPL_ISSUER_READONLY.md)에 연결한다. 소스와 실제 서버 바이너리 일치·amendment 활성은 UNKNOWN으로 유지한다.
