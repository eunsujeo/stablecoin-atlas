# 원화 가격·시장 표와 Allium 조사
- 목표: 원격 수집 서비스 준비, 원화 가격 선택, 시장 표 여백 축소, Allium 중심 조회 조사. 완료 후 commit/push.
- 끝난 것: 배포 준비 c59a8d4 push 완료. 분리된 Arkham/일별 systemd unit, persistent receipts/archive/market-store와 로컬 설정 검사. 원격 설치는 미실행. USD/KRW 선택과 URL/F5 유지, ECB 일별 비공개 환율 저장·복구, 정확한 BigInt 환산, 기준일/미확보 표시. 시장표 6열·행 60px 이하·390px 대응. Allium 공개 문서 조사만 완료, 키 사용 없음.
- 변경 파일: deploy/atlas-fx.service, deploy/atlas-fx.timer, tools/fx-store.mjs, tools/ui-preview.mjs, web/fx-model.js, web/overview.js, web/index.html, web/loading.js, web/styles.css, tests/fx-store.test.mjs, web/fx-model.test.mjs, package.json, docs/adr/0058-reference-krw-prices.md, docs/COLLECTOR_SERVICE.md, docs/DEVELOPMENT_STATUS.md, docs/research/allium-data-plan-2026-10-23.md
- 검증: npm run check rc0 tests329/pass329/fail0. FX target rc0 tests6/pass6/fail0. persistent collector PG target rc0 tests1/pass1/fail0. offline systemd-analyze verify 259 rc0. 브라우저 USD/KRW·F5·미확보·dark/light·390px 검증 rc0. 최종 변경 후 같은 check를 실행하고 push한다.
- 기다리는 것: 기존 Arkham worker PID4397/lock405 및 registered worker session78794/lock407 유지. UI session45394/port4173. Lead 구현 검토 c14bd4ba17f14b32bd1c333729c5996c proceed 회수 완료. 비공개 FX seed는 ECB 2026-10-22 기준, importedAt이며 신규 수집 API 요청 아님.
- 다음 행동: Allium 키의 안전한 서버 설정 위치·상품 권한·비용 확인 후 승인된 5코인/발행 자산의 소량 읽기 표본과 공급량 정의 비교. 실제 조회 지원 전 자동 수집/공급자 교체 금지. 원격 서비스 설치는 아직 하지 않았다. 관련 최신 Git 상태를 확인하고 시작한다.
- 사용자 확인 필요: 아니오
- 읽을 파일: docs/DEVELOPMENT_STATUS.md, docs/adr/0058-reference-krw-prices.md, docs/COLLECTOR_SERVICE.md, docs/research/allium-data-plan-2026-10-23.md
