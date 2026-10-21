# ADR 0027: Solana 스테이블코인 mint 읽기 전용 연구

상태: 채택, 2026-10-21. 사용자가 남은 작업 목록 다음 단계 진행을 승인했다. 첫 후속 작업을 Solana USDC·USDT mint 관측으로 한정한다.

기존 Solana 공식 식별자·계정 모델 조사를 실제 설정 관측으로 보강한다. 별도 연구 CLI이며 공통 도메인·AssessmentReport·제품 Adapter·SDK를 추가하지 않는다. ERC-20 함수나 allowance 의미를 적용하지 않는다. XRPL 실행은 이번 작업에 포함하지 않는다.

목적지는 요청 전에 `SOLANA_RPC_URL` 또는 명시적 `--public`으로 선택한다. 관리형 proxy 설정을 그대로 사용하고 endpoint fallback·자동 재시도·서명·거래·키 입력을 추가하지 않는다. `getGenesisHash`가 기대 mainnet genesis와 일치할 때만 `finalized`/`base64`의 `getMultipleAccounts` 한 번으로 발행사 문서의 두 mint를 조회한다.

기존 Token Program owner, executable=false, canonical base64, 정확한82바이트와 COption/초기화 태그를 확인해 supply를 u64 LE 십진 문자열로 읽는다. None authority의 남은 바이트는 무시하되 Some 영 pubkey는 None으로 바꾸지 않는다. 현재 reader가 모르는 프로그램·Token-2022·layout, null/미초기화/실패는 INCONCLUSIVE로 구분한다. 미구현은 자산 기능 부재가 아니다.

공통 응답 context slot을 기록하되 계정 마지막 변경 slot·블록 hash·과거 slot 고정이나 독립적 신뢰 증명으로 해석하지 않는다. authority 필드 관측은 키 통제·발행사 인증·권한 행사·전송 성공 증명이 아니다. 제품 지원/판정은 변경하지 않는다.

응답은64KiB, 요청은10초로 제한한다. 알 수 없는 upstream 텍스트·URL·자격정보·사용하지 않는 lamports/rentEpoch는 보고서에 넣지 않는다. 기존 원자적0600 출력 도구를 사용한다. 새 source/protocol/관측 증거는 별도 [연구 문서](../SOLANA_MINT_READONLY.md)와 JSON에 연결하고 기존 catalog/report hash는 보존한다.

로컬 모의 HTTP로 주소 순서·공통 slot·mainnet 불일치 중단·RPC 허용 목록·수치/형식 경계·오류/출력 보존을 검증하고 전체 `npm run check`를 실행한다. 실제 네트워크 관측은 mock 테스트와 별도로 기록한다.
