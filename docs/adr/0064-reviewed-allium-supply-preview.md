# ADR0064 — 검토된 Allium 공급량의 로컬 표본 화면

## 범위

[ADR0063](0063-supply-install-and-api-boundary.md)에서 설치·대조한 Ethereum USDC/USDT의 2026-10-16~22 공급량 14행을 Overview의 별도 표에 연결한다. 기존 공급량 차트·시장 비교표의 공급자·지표·기본값을 바꾸지 않는다. 전체 11배포 지원, Allium 기본 전환, DeFiLlama 보조 연결과 일별 수집은 완료 범위에 포함하지 않는다.

## 읽기 경계

명시적 `--database` 모드에만 `/reviewed-supply-data.json`의 GET/HEAD를 연결한다. query/path 변형은 받지 않는다. 기존 loopback·Host/Origin·동일 출처 제한을 적용하며 JSON 모드에서는 404와 화면의 미연결 상태를 반환한다. 서버 시작은 DB 조회를 실행하지 않으며 웹 요청은 저장 DB의 기존 `readSupply`만 호출한다. 수집·공급자 API·import·grant·설정 변경을 실행하지 않는다.

reader는 고정 날짜의 두 자산을 한 번에 읽는다. 기존 READ ONLY transaction·역할/schema/hash 검사를 유지한다. 연결 5초·문장 10초·transaction 60초 제한을 재사용하고, 단일 진행 조회·동시 요청 병합·성공/실패 10초 cache로 요청 폭주를 제한한다. 최대 14행·32KiB를 검사하고 필드 허용목록으로 projection을 다시 구성한다. 원문 SQL·run/query ID·접속 문자열·manifest·receipt·비밀은 웹에 제공하지 않는다. 실패 응답은 고정된 503 코드다. API 경계의 Dashboard UNKNOWN과 SOURCE_REVIEWED의 의미는 ADR0063 그대로다.

## 표시와 실패

총공급량·유통량·조정 유통량은 별도 열의 정확한 십진 문자열/null이다. Number 변환·합산·공급자 간 대체를 하지 않는다. 원래 기준일·UTC 관측 시각(마이크로초)·원문 hash·공급자의 isNative를 확인할 수 있다. 집계 timezone UNKNOWN, 최소 단위 정밀도 미검증, USD 미조회를 표시한다. 두 자산/전체 필터는 이미 읽은 projection만 선택한다.

고정 두 자산×7일 grid를 표시하며 null은 `—`, 저장 행 부재는 `미확보`, 실제 0은 `0`으로 구분한다. 부분 자료는 확보 행 수를 표시하고 미확보 날짜를 채워 넣거나 이전 응답의 날짜와 합치지 않는다. 최초 실패·미연결·정상 빈 응답을 구분한다. 정상 후 실패는 현재 페이지 메모리의 마지막 정상 자료와 원래 시각을 보존하고 실패 상태를 명시한다. 정상 복구 시 응답 전체를 교체한다. F5는 DB를 다시 읽으며 페이지 메모리를 영속 저장하지 않는다. 기존 60초 화면 갱신은 저장본 재독이다.

## 검토와 검증

설계 검토 `f6fee423a686477ba05ce260354ce378`의 proceed와 고정 범위·크기·실패 제한·날짜 누락·실패/복구 검증 조건을 반영했다. 검토는 사용자 권한 확대나 완료 인증이 아니다. 실제 검증 결과와 명령·시험 수는 이번 단위의 [인계문](../handoff/2026-10-23-allium-supply-preview.md)을 따른다.
