# 저장 immutable 소스 참조표 완료
- 목표: 직전 인계의 다음 행동인 RLUSD ID650·JPYSC ID1623·JPYC ID173 선언/초기화·onlyProxy 참조 비교.
- 끝난 것: 저장3입력/AST/출력만 읽어 선언 초기화 address(this)·참조 각3곳·선택 상속의 생성자/권한 modifier·runtime relocation 위치를 정리했다. JPYSC upgradeable 파일은 import 전용이고 실제 선언은 일반 contracts 경로임을 구분했다. 기존107파일 포함134파일 SHA256 불변·새 증거0700/0600. 외부 조회/다운로드/재컴파일/immutable 제출/runtime 대조0. 배포 UNKNOWN5/5·추가체인 포함8/8과 기존 PARTIAL·JPYSC 경로 절단·소비를 유지했다. 원문은 비공개 .state/immutable-source-map-20261025/evidence.json에 보존했다.
- 변경 파일: docs/research/2026-10-25-stored-immutable-source-map.md, docs/research/2026-10-25-token-review-remaining-work.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-25-stored-immutable-source-map.md
- 검증: python3 .state/map-stored-immutables-20261025.py — rc0 PASS(3입력/참조각3/134파일불변/권한). 별도Python재독 — rc0 PASS(134파일/명시UUPS생성자부재/문서링크). npm run check — rc0 tests564/pass564/fail0/cancelled0/skipped0 (.state/agent-logs/immutable-source-map-check.log). git diff --check — rc0.
- 기다리는 것: 없음
- 다음 행동: RLUSD·JPYSC·JPYC의 독립 build/배포·immutable 제출자료 확보 경로와 신규 외부 실행 계획을 별도 문서로 구체화한다. 우선 대상·정확한 chain/address·공식 출처 재확인 경로·RPC/GET 메서드/한도/시간·기존 소비와 분리·비용 UNKNOWN·실패 종료 조건을 적어 사용자에게 제시한다. 준비 중에는 저장 자료만 읽고 새 조회/다운로드/재컴파일/값 제출을 시작하지 않는다.
- 사용자 확인 필요: 예 — 문서로 구체화한 신규 외부 취득/실행 범위 승인. 계획 작성 자체는 오프라인으로 가능하다.
- 읽을 파일: docs/research/2026-10-25-stored-immutable-source-map.md, docs/research/2026-10-25-token-review-remaining-work.md, docs/research/2026-10-25-jpyc-immutable-input-research.md, docs/research/2026-10-25-rlusd-jpysc-offline-source-review.md

기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존했다. 이번은 소스 참조 문서화이며 새 Lead 요청/하위 Agent는 없다. compiler bytes/소스 원문/키/RPC URL은 게시하지 않는다.
