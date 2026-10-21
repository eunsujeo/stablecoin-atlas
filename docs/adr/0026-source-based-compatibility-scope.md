# ADR 0026: 서비스 검증을 제외하고 소스로 권한 검토를 완료한다

상태: 채택, 2026-10-20. 사용자가 서비스 검증이 목적이 아니며 실제 권한 행사 대신 소스 확인으로 충분하다고 명시했다. 이어 현재 범위의 남은 작업은 추가 사용자 확인 없이 진행하도록 했다.

목표는 스테이블코인의 체인·구현별 기술 호환성 비교다. 수탁 지갑·입출금 서비스·내부 장부 검증을 요구하지 않는다. 역할 계정 표본 수집·실제 mint/freeze/clawback/upgrade 행사를 완료 필수조건에서 제거한다. 기존 서비스 입력/읽기 도구와 관측은 선택적 이력으로 보존한다.

권한 검토는 고정된 소스의 함수·modifier·조건·반환·이벤트·버전 차이와 출처/파일 hash·줄 범위를 근거로 완료한다. SOURCE_REVIEWED는 별도 연구 상태이며 제품 Verdict/Support/authority enum이 아니다. 기존 실제 권한 UNKNOWN, 행위 NOT_TESTED, 배포 source binding UNKNOWN과 과거 보고서를 변경하지 않는다. 미확보 dependency나 full source/bytecode 재현도 검토한 직접 선언의 결론을 무효화하거나 무기한 대기시키지 않는다.

체인별 소스가 없으면 SOURCE_NOT_AVAILABLE, 상속 본문이 없으면 INHERITED_NOT_REVIEWED, 프로토콜 설명만 있으면 PROTOCOL_DOCUMENTED_ONLY로 구분한다. Ethereum USDT를 TRON 구현으로 일반화하지 않는다. 현재 구현/조사 범위를 넘는 Solana/XRPL 실행 Adapter는 추가하지 않는다. 새 서비스 자료나 공개망 쓰기·운영 키는 필요하지 않다.

[호환성 표](../STABLECOIN_COMPATIBILITY_MATRIX.md)·[연구 기록](../research/stablecoin-source-compatibility.json)·[현재 작업 목록](../STABLECOIN_EVIDENCE_BACKLOG.md)이 새 완료 기준을 따른다. 과거 문서의 계정 표본/권한 행사 요구는 해당 조사 당시의 공백이며 현재 필수 backlog로 재사용하지 않는다.
