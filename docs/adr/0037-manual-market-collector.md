# ADR0037: 서버 전용 단발 시장 자료 수집

상태: 채택. 사용자 다음 단계 진행 승인, 2026-10-22.

## 결정

`npm run market:collect`는 `.env.local`의 허용 변수만 읽고 Arkham 고정 origin에 GET을 순차 실행한다. USDC/USDT/RLUSD market·holders 각2건과 networks/status1건, 실행당 최대7건이다. 요청 사이1초, 요청별15초·응답2MiB·전체120초 예산을 적용하고 리다이렉트·재시도·공급자 전환은 없다. `.env.local`은 실행 환경의 proxy/NO_PROXY/TLS를 변경하지 않는다.

공식 [엔드포인트 목록](https://arkm.com/llms.txt)은 `/subscription/intel-usage`를 제공한다. 개발 중 별도1회 조회는 HTTP200, `totalLimit=10000`이었다. 기간·잔여량·요청별 단가·rate 계약은 확인하지 못했다. 이는7회 수집의 성공 보장이나 반복 예산이 아니다. 이번 실사용 조회 상한은 usage1건+자료7건이다. CLI는 usage를 자동 호출하지 않는다.

자료는 숫자 lexeme를 문자열로 보존하고 음수·지수·과도한 길이·깊이·필수 지표 누락을 거부한다. 저장 대상은 유통량·가격·체인별 공급량·등록 네트워크의 active/tip/asOf뿐이다. holder 목록·계정 식별자·키·응답 오류 본문은 보존하지 않는다. 키는 서버의 API-Key 헤더에서만 사용한다.

7건 전체 성공 및 스키마 검증 후 `reports/market-store/collected/`에0600 새 projection을 저장하고 기존 publisher로 발행한다. sourceHash는 이 projection 바이트의 hash이며 원격 응답 전체나 서명 검증의 증거가 아니다. 원본 연구 파일은 변경하지 않는다. XRPL의 이전 관측은 과거 시각 그대로 남고 Arkham 값으로 대체하지 않는다.

수집과 수동 market:build는 같은 `.writer-lock`을 배타 생성하며 소유 token을 확인한 뒤 제거한다. 잠금은 이전 snapshot 읽기·수집·검증·index commit을 포함한다. 경쟁자는 API0회 및 기존 상태 무변경으로 종료한다. 시간/PID 기반 잠금 강제 회수는 없다. 비정상 종료 후에는 모든 writer 종료를 직접 확인하고 남은 잠금을 수동 복구한다.

실패 시 index를 발행하지 않으며 관측시각은 갱신하지 않는다. 별도 last-collection.json에 시도시각·요청/완료 수·HTTP 상태·숫자 Retry-After·발행 여부만 저장한다. 429는 기록하고 중단한다. RUNNING은 시작 기록이며 현재 프로세스 생존 보장이 아니다. index commit 후 상태 쓰기 오류는 발행 사실을 별도 표시하며 파일시스템 오류로 상태 자체가 기록되지 않으면 CLI는 실패한다.

최신값 선택은 같은 coin/deployment/metric/provider/endpoint에서 관측시각이 가장 늦은1건을 사용해 과거 추출 위치 차이로 순위가 중복되지 않게 한다. 이력은 selector까지 일치하는 관측만 연결한다. 수집기 첫 관측과 연구용 서로 다른 추출 위치를 임의로 이어 붙이지 않는다.

## 유지하는 경계

웹60초 갱신·서버 시작은 저장본만 읽는다. 주기 수집, DB, 실제 안전성 등급, 공개 배포는 추가하지 않는다. 기존 workspace 이동 형식의14개 원본은 유지하며 새 collected 이력은 해당 이동 파일에 포함되지 않는다. 새 PC에서는 키를 별도 설정하여 단발 수집할 수 있다. 누적5000관측·snapshot2MiB 한도에 도달하면 발행을 중단하며 자동 삭제하지 않는다.

## 검증

모의 응답으로7회 상한·중간 실패 중단·429/Retry-After·정밀 수량/0·키와 holder 제외·이력·이전 index와 시각 보존·동시 writer 차단을 검사한다. 전체 npm run check와 실제 단발 수집 결과는 개발 상태 문서에 별도 기록한다.
