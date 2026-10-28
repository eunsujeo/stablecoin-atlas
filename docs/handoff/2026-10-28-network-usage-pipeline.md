# Arkham 수집·DB·UI 준비 인계

상태 업데이트: 이후 새 사용자 승인으로 실제 수집·DB 반영을 완료·소비했다. 현재 정본은 [실제 완료 인계](2026-10-28-network-usage-live.md)다. 아래는 준비 당시 기록이며 동일 호출/승인을 다시 요청하거나 재실행하지 않는다.

- 사용자 최신 수집/DB/화면 연결 진행 요청에 따라 [ADR0117](../adr/0117-arkham-network-usage-pipeline.md)의 전체 경로를 구현/로컬 검증했다. **실제5GET/키읽기/운영 DB init·grant·import/운영 배포는 아직0이다.** 준비를 실자료 반영 완료로 보고하지 않는다.
- [고정 최초 실행안과 CLI](../NETWORK_USAGE_COLLECTION.md), [수행·실패/수정·검증 기록](../research/2026-10-28-network-usage-pipeline.md)을 따른다.
- 최초 대상5개: USDT Ethereum/TRON/Solana, USDC Ethereum/Solana. 요청2026-10-21T00:00:00Z~27T23:59:59Z. 각 histogram1회, 총5GET/0run/10MiB/120초·간격1초·재시도/페이지/redirect/전환/반복0·비용 UNKNOWN. 기존키만 사용. 새 슬롯 arkham-network-usage-20261028-v1, 기존 .state/allium-executor root/common lock 사용. 기존 소비2GET는 재사용하지 않는다.
- 고정 계획 파일 data/arkham-network-usage-20261028-plan.json SHA256 cb0c8a538575fc5ead304b0fc9ba94e21cfe3142c31820ddca0938cf894cd755, 내부 planHash 3a0b22eb59ee06965a51bbfe0d5be95c1676215324cec7e1094dd4ac67d644ab. 현재 실제 실행용 승인 파일은 생성하지 않았다. 확인된 새 사용자 승인 bytes만 다음 단계에서 기록한다.
- 새 private atlas_network_usage: 원자적 불변snapshot1건/35관측·누락칸, 기존writer SELECT/INSERT·reader SELECT만 사용. PG17 pin 5a19f99626ccd958de1357795eb4fed2327b4fad30644b34e7e6cd06a449d905. 실제 적용 전후 기존10개 schema 구조/자료·Data API 유효 접근과 definer hash를 확인한다. 실패/partial/전체빈 묶음은DB입력하지 않는다.
- reader API /network-usage-data.json과 client/server5분 캐시를 준비했다. 화면은 Arkham/Allium을 명시 선택하고 미지원 tx수/토큰수량은null, 누락은0으로 채우지 않는다. 원 providerTime/queriedAt/hash·집계 시간대 UNKNOWN·하위 초 경계 미확인을 유지한다. 평균 합산/비중화·자동fallback·자동수집은 없다.
- 검증: npm run check 715통과/0실패. 가상수집/모델/API12통과, PG17 새 경로+기존asset-review2통과. Chrome1440/390 두테마·Safari API부재 모사·DB→HTTP·명시출처/last-good·기존production/FX·IndexedDB 캐시 모두통과, 외부요청/JS오류0. 실제 iPhone/WebKit은 미검증.
- 중요 수정: Lead 3eba93ff5ded459095b0feed0d532dc1의 원providerTime/경계보존 조건을 반영했다. Lead 19672e75da0c483888740e259744d0f0의 직접 import 전체MISSING 우회를 공통validator와SQL CHECK에서 막고, 올바른hash/직접SQL의 거절과 기존snapshot유지를 시험했다. 실제DB에 과거 DDL pin을 적용한 적은 없다.
- 로그/시험 pin은 비공개 .state/network-usage-pipeline-20261028. 원문/키/전체URL/실행승인은 Git/웹에 게시하지 않는다. 코드/시험/검토 가능한 계획은 별도commit/push하며 기존 무관한 docs/handoff/2026-10-22-router-lead-review.md는 제외한다.
- 다음 행동: 위 고정5GET·비용 미확인 및 실제 신규schema init/기존두역할 grant/검토snapshot1건 import/재입력0·reader·로컬화면 확인 범위의 사용자 확인을 받는다. 확인 후 같은 승인을 반복 요청하지 않고 실제 준비/실행/원문 검토→DB반영까지 진행한다. 수집 실패 시 DB변경 없이 소비/실패를 보존하고 종료한다. 운영 Mac mini·자동반복·새키·다른지표는 확대하지 않는다.
