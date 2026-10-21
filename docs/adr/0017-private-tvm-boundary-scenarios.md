# ADR 0017: 정상 사설 TVM Fixture의 0 금액·잔액·승인량 경계

상태: 채택 (2026-10-20). [ADR 0016](0016-private-tvm-token-scenarios.md)의 검증기와 실행 경계를 유지하고, 별도의 신규 사설 환경에서 `npm run tvm:boundary`를 실행한다. 기존 정상 프로필은 유지한다. 운영 키·공개망/외부 RPC 쓰기·추가 민팅은 없다.

서로 다른 owner/recipient/spender와 유효한 비영 recipient를 사용한다. 양수 transfer와 approve/transferFrom 성공 대조를 먼저 확인한 뒤 다음 항목을 실행한다.

- transfer(0), allowance=0에서 spender의 transferFrom(owner,recipient,0): receipt SUCCESS·canonical bool true·해당 계약의 정확한 Transfer 0 한 건·모든 표본 토큰 상태 불변.
- transfer의 잔액 부족: 직전 owner balance+1을 전송한다.
- transferFrom의 승인량 부족: approve(1) 성공 후 1 < amount=2 <= owner balance를 확인한다.
- transferFrom의 잔액 부족: owner balance+1을 먼저 승인하고 0 <= owner balance < amount <= allowance를 확인한 뒤 실행한다. Fixture가 allowance 차감 이후 잔액 검사에서 revert하므로 승인량 전체 rollback도 확인한다.
- 마지막 approve(0)으로 정리한다. 컨테이너/네트워크는 기존 finally 정리 절차를 따른다.

각 호출 직전 전체 표본(owner/recipient/spender 잔액, totalSupply, owner→spender allowance)을 다시 읽고 직전 단계 결과와 같은지 확인한다. 세팅 approve와 검증 대상 호출의 baseline을 섞지 않는다. 금액은 bigint/십진 문자열이며 동적 balance+1과 uint256 범위를 검사한다. 보고서에는 사전조건 이름·검증 여부·실제 금액/전후 상태·기대 실행 결과를 남긴다. 조회 실패/사전조건 불일치면 해당 항목 ERROR, 후속 항목 NOT_TESTED로 멈춘다.

실패 시나리오 관측은 실제 채굴 receipt REVERT+block ret REVERT·블록 full ID/높이 및 호출 본문/hash 바인딩·committed 토큰 로그 없음·모든 표본 토큰 상태 불변을 요구한다. allowance가 충분한 잔액 부족 호출에서는 승인량이 차감되지 않은 원래 값으로 돌아와야 한다. broadcast 거부·timeout·OUT_OF_ENERGY 등은 의도한 REVERT 검증 성공이 아니다. native TRX·Energy/Bandwidth는 무변화 비교 대상이 아니다.

보고서는 별도 `TRON_PRIVATE_TVM_TOKEN_BOUNDARIES`, profile BOUNDARY, scenarioVersion 1.0.0 envelope다. 호출 직전 현재 시각·서명/소유/격리·단일 전파·기존 120초 제한을 유지하며 시간 제한을 늘리지 않는다. getter 블록 UNKNOWN과 읽기 전용 Adapter의 기존 판정/지원 상태는 유지한다. REVERT만으로 내부 원인을 확정하지 않으며 분리한 사전조건과 고정 Fixture 소스에 따른 관측으로 해석한다. 0값 위임 호출 성공을 양수 위임 권한이나 승인 우회의 증거로 해석하지 않는다. 이번 결과는 일반 토큰·Mainnet·최종성·자산 안전성을 검증하지 않는다.

자동 검증은 사전조건 혼동/범위 초과/잘못된 baseline·0값 이벤트 누락/false 반환·승인 rollback 누락·실패 후 후속 NOT_TESTED를 포함하며, 실제 신규 TVM 실행은 별도로 수행한다. 비표준/실패 Fixture와 자원 한도 평가는 후속 범위다.
