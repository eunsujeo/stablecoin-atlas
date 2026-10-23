# Allium 전송량 기간·공급량 정의 분석
- 목표: 전송량 빈 응답 원인과 USDC/USDT 공급량 차이를 추가 조사하고 완료 후 commit/push.
- 끝난 것: 고정5Ethereum주소 10/08<=date<10/23 전송량60행 확보, 모두 최신10/21·10/22없음. JPYC 포함4코인14일, JPYSC10/09·19·20·21의4행. has_adjusted_volume=true여도 JPYSC최신조정량null 유지. USDC/USDT10/16~22 공급량14행 확보. 10/22 총량은 Llama minted와 거의 같지만7일 비교에서 USDC는 Allium D와Llama D+1가 더 가까워 cutoff차이 가능성. 날짜 자동이동 금지.
- 변경 파일: docs/research/allium-samples/followup.md, docs/research/allium-samples/followup-observations.json, docs/research/allium-samples/volume-recent.sql, docs/research/allium-samples/volume-recent-compatible.sql, docs/research/allium-samples/supply-recent.sql, docs/research/allium-samples/README.md, docs/DEVELOPMENT_STATUS.md
- 검증: private offline 분석 rc0 결과74행 주소/기간/중복/문자열검사, 원문 gzip SHA검증·Llama circulation/minted sourceHash동일 PASS. npm run check 최종결과 .state/agent-logs/allium-followup-check.log 확인 후 commit/push. 전송60행<limit75; 공급14행=limit14지만2코인×7일고유셀14개확보 확인.
- 기다리는 것: 모든run terminal·결과회수. Lead d8d9dc5346f94dba9760a445345fb9ef와 f710e716840f412daf44ea3b8c48a0df proceed 회수. 원래 volume-recent는 SQL Query not allowed로failed. 같은run 소유메타데이터GET으로확인, SYSTEM$TYPEOF 제거한 별도교정run성공; 함수정책단정금지. 실패포함새실행3회, 자동재시도0. 기존UI/수집기 유지.
- 다음 행동: 다른승인네트워크 지원과 Allium 별도DB저장/조회설계. Llama 고정소스의 circulating=minted-unreleased+inbound-outbound 확인, 원문bridge 상세합산만으로재구성시 USDC263418148.05935717540/USDT552607059.650265679 tokens잔차가남아 정확한전체원인미해결. 실제배포소스버전/누락조정/집계cutoff/원천자료형미확인. 자동교체·날짜복제·누락0 금지. Private원문 .state/allium-sample-probe/, Llama압축 .state/collector-archive/history/.
- 사용자 확인 필요: 아니오
- 읽을 파일: docs/research/allium-samples/followup.md, docs/research/allium-samples/followup-observations.json, docs/DEVELOPMENT_STATUS.md
