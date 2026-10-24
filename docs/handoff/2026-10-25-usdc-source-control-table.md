# USDC 후보 소스 권한·동작 검토표
- 목표: cached compiler 인계문의 다음 행동인 USDC 후보 소스 항목별 검토를 마무리한다.
- 끝난 것: linked 후보 입력을 직접 읽고 최종 V2_2 override·상속·내부 호출을 반영한15행 검토표를 작성했다. 발행/본인 소각·정지/제한·minter 설정/제거·전송·승인/철회·permit·EIP3009·서명 의존성·역할·초기화/복구를 SOURCE_REVIEWED로 정리했다. proxy 업그레이드·감사/수수료/rebase 배포 결론은 UNKNOWN이며 모든 행의 배포 연결 UNKNOWN·실제 실행 NOT_TESTED를 유지한다. 원래 runtime mismatch/PARTIAL·보고서는 변경하지 않았다. 원본26파일 hash 불변. Lead c5214c06397144ecaa9d147b8ac8ebba proceed 회수·조건 반영. 새 API/RPC/키/DB/UI 변경0.
- 변경 파일: docs/research/2026-10-25-usdc-offline-source-review.md, docs/DEVELOPMENT_STATUS.md, docs/handoff/2026-10-25-usdc-source-control-table.md
- 검증: npm run check > .state/agent-logs/usdc-source-table-check.log 2>&1 — rc=0 tests537/pass537/fail0/cancelled0/skipped0. python3 저장 입력 SHA256 비교 — rc=0 files26/changed0. git diff --check — rc=0.
- 기다리는 것: 없음
- 다음 행동: 기존 저장 자료만 사용해 USDC·USDT·RLUSD·JPYC·JPYSC의 등록/선정 네트워크별 근거 현황표를 작성한다. 시장 공급량·전송량 확보와 기술 소스·체인 관측·배포 연결을 별도 열로 구분한다. 없는 소스/관측은 미확보·UNKNOWN/NOT_TESTED로 보존하며 새 외부 호출·다운로드·키·운영 데이터 변경은 하지 않는다. 자료가 부족하면 필요한 고정 입력/실행 범위만 정리한다.
- 사용자 확인 필요: 아니오 — 기존 승인 범위의 오프라인 목록 정리. 새 실제 배포 검토는 정확한 입력과 허용 RPC 범위를 별도 확인한다.
- 읽을 파일: docs/research/2026-10-25-usdc-offline-source-review.md, docs/STABLECOIN_COMPATIBILITY_MATRIX.md, docs/TOP10_NETWORK_BACKFILL.md, docs/ALLIUM_SURVEY_DATA.md, docs/research/allium-samples/survey-2026-10-23.md, docs/DEVELOPMENT_STATUS.md

사용자 최신 질문: 다섯 코인과 모든 네트워크를 확인 중인지 물었다. 이번 상세 검토는 Ethereum USDC1배포임을 명확히 답했다. 기존 기술8프로필과 선정 공급량 네트워크(USDT10/USDC10/RLUSD2 및 JPY 자료)는 구분하며 전 네트워크 기술 검증 완료로 표현하지 않는다. 비공개 원문은 .state에 유지한다. 기존 untracked docs/handoff/2026-10-22-router-lead-review.md는 보존한다.
