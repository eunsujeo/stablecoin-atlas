# ADR 0021: 서비스 계정 목적·출처의 로컬 입력 경계

상태: 채택, 2026-10-20.

USDC·USDT owner 제어 주소 표본은 확보했지만 서비스/고객 계정 문맥은 미확보다. 계정을 임의로 만들거나 제어 주소를 서비스 표본으로 바꾸지 않고, 입력의 chain×asset×account×purpose×provenance를 먼저 검증한다.

별도 연구 도구와 input/report v1 schema를 사용한다. 기존 공통 도메인·제품 CLI·AssessmentReport는 바꾸지 않는다. 현재 구현된 읽기 대상4프로필만 저장된 tuple과 비교하며 EVM/TRON 주소 의미를 각 정규화 함수에 둔다. Solana/XRPL의 mint/issuer/account를 ERC-20 주소로 강제하지 않는다.

출처는 각 holder/owner/spender의 목적 진술 필드다. 로컬 식별자와 UTC 시각만 수용하고 자료를 열거나 가져오지 않는다. 사용자 진술·공개 참조 입력을 독립 검증한 사실로 표시하지 않는다. 형식 검증 성공과 RPC admission·권한·소유·서비스 승인 판정을 분리한다.

16KiB/정규파일/O_NOFOLLOW/fstat/읽기 상한/strict UTF-8·duplicate-key 거부와 입력·출력 동일 경로/inode 거부를 적용한다. 성공 결과에만 bytehash·정규 공개 주소·목적·최소 출처/digest를 저장한다. 실패 입력이나 path·referenceId 원문을 로그/보고서로 남기지 않는다. hash는 DLP/익명화 보장이 아니다.

LOCAL_INPUT_VALIDATED_NOT_ACCOUNT_VERIFIED, RPC admission NOT_GRANTED, query NOT_TESTED, 권한/소유/계정 존재/서비스 신원 UNKNOWN, 전체 INCONCLUSIVE를 고정한다. 결과는 기존0600 원자 저장으로 보존한다. 실제 조회 연결은 별도 작업이며 입력 성공이 네트워크나 쓰기를 자동 시작하지 않는다.

구체적인 형식·파일/주소 정책·검증 조건은 [사용 문서](../SERVICE_ACCOUNT_CONTEXT.md)를 따른다.
