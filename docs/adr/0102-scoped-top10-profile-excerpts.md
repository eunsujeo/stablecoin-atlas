# ADR0102: 공급량 선정 추가18곳의 웹 검토 발췌

일자: 2026-10-25. 상태: 사용자 로컬 웹 반영 승인으로 구현.

## 결정

사용자가 추가18곳 모두의 기존 자산 프로필 반영을 승인했다. [ADR0101](0101-supply-ranked-source-review-candidates.md)의 완료된 연구 결과만 오프라인으로 발췌하여 [ADR0100](0100-reviewed-source-asset-profiles.md)의 기본/Atlas 프로필에 추가한다. 새 수집·RPC·compiler·키·DB 변경과 제품 판정 재계산은 없다. 소비된 연구 실행은 재사용하지 않는다.

기존8곳의 SOURCE_REVIEWED와14기능은 유지한다. 새18곳은 연구 원래의 reviewScope·가변 기능·7개 항목 상태·조건·한계·근거 hash/취득 시각을 보존한다. 초기 구현 후보·프록시만 확보·공통 프로토콜/프레임워크·참조·브리지 구성요소·공식 문서를 구분한다. 새18곳의 연구 발췌 표시 상태 RESEARCH_SCOPE_REVIEWED는 원문 연구의 새 판정이나 SOURCE_REVIEWED/PASS가 아니다.

## 선택과 집계

EVM은 기존 chainId로 선택한다. non-EVM은 별도 networkKey를 사용하며 EVM chainId를 부여하지 않는다. 주소 후보·mint·currency+issuer·module/FA object·ERC20 view의 종류를 표시한다. 발췌에 식별자가 없으면 임의 주소를 채우지 않는다. 신규 profile별 기능만 읽으며 coinId별 Ethereum 기능을 상속하지 않는다.

전체 현황은 기존 소스 확인8/전체 검토26이라는 분모와 자산별 범위별 수를 표시한다. 이는 새18곳을 같은 수준의 완료나 실패로 합산하지 않는다. 네트워크 집계와 선택 컨트랙트 물량 대응은 미확정으로 유지하며 현재 순위를 주장하지 않는다. 전체26은 기존8+추가18이며 공급량 선정22 전체가 새로 웹에 구현됐다는 뜻이 아니다.

## 제공 경계와 재현

`node tools/top10-profile-excerpts.mjs`는 고정 저장 JSON과 계획/registry의 허용 필드만 `web/source-review-top10-data.js`로 생성한다. 원문 bytes·archive 경로·endpoint는 제공하지 않는다. `node tools/source-review-notes.mjs`는 정적 근거 발췌를 생성하며 웹 요청은 생성·검증·외부 조회를 실행하지 않는다. 상세 수행·실패/수정·검증은 [작업 기록](../research/2026-10-25-top10-profile-excerpts.md)을 따른다.
