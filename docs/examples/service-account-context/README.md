# 서비스 계정 입력 템플릿

[입력 준비 안내](../../SERVICE_ACCOUNT_INTAKE.md)를 먼저 읽는다. 이 폴더의8개 JSON은 현재 코드가 지원하는 Ethereum USDC/USDT/RLUSD와 TRON USDT의 BALANCE/ALLOWANCE 문맥이다.

REPLACE_WITH placeholder가 남아 있어 의도적으로 검증에 실패한다. 실제 계정·출처 자료가 아니며 자동 생성한 계정 주소나 인증된 출처 진술을 포함하지 않는다. 복사본에 실제 공개 주소·목적·출처·시각을 채운 후 로컬 검증을 실행한다. 키·시드·RPC URL·토큰·고객 식별 정보는 넣지 않는다.

파일별 chain/network/asset 값은 저장된 코드 참조와 일치하며 현재 공식 지원을 새로 조사한 결과가 아니다. EVM ALLOWANCE 실행에는 명시 --evm-allowance 옵션이 필요하다. 형식 계약은 [입력 문서](../../SERVICE_ACCOUNT_CONTEXT.md), 실행 계약은 [runner 문서](../../SERVICE_ACCOUNT_READONLY.md)를 따른다.
