# ADR0035: 코인·네트워크·발행 자산별 저장 시장 관측

상태: 채택, 2026-10-21. 사용자가 실제 API 시험 후 네트워크별 순위·그래프와 확장 가능한 등록 구조의 구현을 승인했다.

`data/asset-registry.json`의 변경되지 않는 coin/network/deployment ID를 기준으로 연결한다. deployment는 네트워크+contract/mint 또는 issuer+currency를 갖는다. 표시명·심볼·다른 네트워크의 동일 주소로 병합하지 않는다. 현재 세 코인·네 네트워크·여덟 발행 자산을 등록하며 등록은 Adapter 지원·발행사 인증이 아니다. origin은 UNKNOWN을 유지한다. 한 coin/network에 여러 발행 형태를 허용할 때는 공급자 집계가 개별 deployment를 구분하지 못하므로 현재의 단일 매핑 제한을 먼저 확장해야 한다.

`npm run market:build`는 고정된 로컬 연구 보고서 다섯 개에서 허용한 가격·공급량·네트워크 상태만 발췌한다. 외부 요청과 환경파일 읽기는 없다. 읽은 동일 바이트의 SHA-256과 selector/endpoint를 각 관측에 기록한다. bounded regular-file/NOFOLLOW 입력, JSON 금액 문자열과 bigint 계산, 관계·중복·주소·시각·지표 검사를 적용한다. 원문 보고서는 기존 reports에 남으며 publisher가 별도 원문 사본을 생성하지는 않는다. 해시는 진위 인증이 아니다.

Arkham market circulatingSupply는 코인 전체 공급자 유통량, holders.totalSupply는 반환 체인별 공급자 총공급량이다. XRPL gateway_balances.obligations는 동결·locked·운영주소 등과의 집계 관계를 인증하지 않은 별도 범주다. 합산·차감·혼합 순위/점유율에 사용하지 않는다. XRPL 확정 원장 hash/index와 보고서 시각 대체 여부를 보존한다. 누락은 미확보이며0이 아니다. 등록 밖 체인의 반환값은 미표시 건수로 알린다.

`reports/market-store`에0600 내용 해시 snapshot과 마지막에 원자적으로 교체하는 index를 보존한다. 이전 관측은 유지하고 같은 source/selector/관측 ID는 재생성하지 않는다. 최대5000관측·2MiB snapshot을 넘으면 이전본을 유지하고 실패한다. 삭제·자동 보존기간 정리는 하지 않는다. 단일 로컬 writer만 허용하며 병렬 build는 지원하지 않는다. 불완전 입력·해시 불일치·등록 관계 오류는 이전 정상 index와 FAILED 상태를 남긴다. 저장 공간은 현재 소규모 JSON snapshot이며 운영 DB가 아니다.

고정 `/market-data.json`은 현재 index·내용 해시·형식을 검사한 projection만 제공한다. 임의 파일/URL/query를 받지 않으며 기존 loopback·Host/Origin·GET/HEAD·CSP 경계를 유지한다. 키·RPC URL·holder 목록은 발췌하지 않는다. 실패 시 브라우저는 마지막 성공 자료를 유지하고 오류를 표시한다.

별도 `#live` 화면에서 코인 전체 유통량 순위, 같은 코인의 네트워크별 공급자 총공급량 막대/순위, 저장된 시계열, XRPL 별도 지표와 source/observation 시각을 제공한다. 체인 순위는 같은 요청 묶음 안의 등록된 값만 비교한다. 코인 전체는 각각의 관측 시각을 상세에 표시하며 동시점 관측을 인증하지 않는다. 그래프는 같은 endpoint/selector/metric/provider/대상별로만 연결하고1점은 점만 표시한다. 전체 공급량을 합계나 비중 분모로 사용하지 않는다. 정밀 원본값은 상세에 보존하고 표시용 좌표만 유한 정수비로 바꾼다.

브라우저는 화면이 보일 때60초마다 저장본만 재독한다. 자료 기준 시각·수집 관측 시각·자료 묶음 생성 시각·화면 확인 시각을 구분하며 재독을 새 외부 관측으로 만들지 않는다. networks/status의 active/tip/asOf는 공급자 관측이며 모든 토큰의 최신성이나 실제 체인 건강을 보증하지 않는다. 네이티브 가격·시총·수수료·TPS는 스테이블코인 지표로 섞지 않는다.

외부 자동 수집·정확한 rate/credit 예산·429 처리 수집기·DB·자동 fallback·공개 배포는 후속 단계다. 이번 구조는 Arkham WebSocket이나 제품 LLM을 추가하지 않는다. 기존 검증 판정과 목데이터 화면은 유지한다.
