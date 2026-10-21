# ADR 0031: 공통 보고서 오프라인 검증

상태: 채택, 2026-10-21. 4개 체인 읽기 연결 후 다음 작업으로 저장된 공통 AssessmentReport의 재검증을 제공한다. 기존 의미 검사는 tests/helpers에만 있었고 TVM 전용 검증기는 별도였다.

src/report-contract.ts에 고정 로컬 schema와 내부 계약 검사를 옮기고 기존 test helper가 재사용한다. 기존 negative mutation·형식 검증의 독립 기대값은 유지한다. assess/lab 출력 경로에 자동 gate를 추가하거나 기존 자산 판정을 바꾸지 않는다.

validate --file 전용 파싱을 일반 assess 파싱 전에 둔다. file/help 외 옵션·위치 인자·중복/빈 file은 거부하고 --out이나 파일 수정은 제공하지 않는다. 종료0은 유효한 보고서,2는 잘못된 JSON/schema/내부 계약 또는 크기/깊이 제한 초과,1은 옵션·파일 접근·인프라 실패다. 정상적인 FAIL 보고서도0이다.

최대10MiB·128단계 JSON wire 입력만 검증한다. O_RDONLY|O_NOFOLLOW|O_NONBLOCK으로 열고 같은 FD에서 fstat regular-file 확인·크기 사전 검사·읽기 중10MiB+1 상한을 적용한 뒤 finally close한다. FIFO open 대기와 마지막 경로 요소 symlink를 거부한다. 부모 경로 전체 symlink를 차단한다고 주장하지 않는다. 엄격한 UTF-8·문자열/escape를 구분하는 깊이 검사와 decoded duplicate key 거부 뒤 JSON.parse로 문법을 판정한다. 임의 JS 객체/getter/toJSON을 받는 API는 제공하지 않는다.

Ajv는 고정 로컬 schema만 컴파일하며 원격 참조·입력 schema·기본값/coerce/removeAdditional을 사용하지 않는다. evidence ID·시나리오/capability 중복, assessment/identity 일치, 참조 존재, PASS/FAIL의 OBSERVED 근거, 유한 timestamp/시간 순서, 정확한 capabilitySummary를 검사한다. identity는 JSON 키 순서를 정규화해 비교하고 큰 루트 identity를 매번 다시 비교하지 않도록 fingerprint를 사용한다. 그 hash는 출처 인증 수단이 아니다.

검증 결과는 최대32개 고정 reason code와 고정 필드/숫자 index 위치만 반환한다. Ajv instancePath/params·원문 값·동적 key·파일 경로·assert diff는 출력하지 않는다. additional 필드와 허용된 배열 순서 차이는 유지한다.

결과는 보고서 구조와 내부 일관성만 판정한다. 출처 진위·실제 체인 상태·증거 위조 여부·기능 지원·안전성·취급 승인 검증이 아니다. Lab wrapper/연구/TVM 형식을 추정하거나 자동 변환하지 않는다. 오프라인 실행·읽기 불변·파일/문법/경계/오류 비노출·정상 FAIL·기존4체인 보고서를 확인하고 전체 검사를 실행한다.
