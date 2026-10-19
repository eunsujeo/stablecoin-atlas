# ADR 0005 — RPC 오류 진단의 비밀정보 기록 방지

날짜: 2026-10-19. 상태: 채택.

## 관측한 문제

기존 Rpc.request는 오류 메시지의 HTTP(S) URL만 가린 뒤 error 전체를 펼쳐 증거에 기록하고 error.data를 RpcError에 전달했다. 상위 RPC가 인증정보를 일반 문자열·중첩 data·추가 필드로 반환하면 이 경로가 해당 내용을 보존할 수 있었다. CLI도 URL만 치환해 예상하지 못한 예외 메시지를 그대로 출력했다. 실제 인증정보 유출이 관측됐다는 뜻은 아니며, 로컬 합성 응답으로 재현 가능한 기록 경로를 수정한다.

## 결정

JSON-RPC 2.0 응답은 객체, 일치하는 id, result/error 중 하나만 존재해야 한다. error.code는 안전한 정수, message는 문자열이어야 한다. null/배열/잘못된 타입/상충 응답은 원문 없는 transport/protocol 오류로 처리한다.

정상 오류 응답에서 숫자 code, 로컬 category/message, `upstreamDetailsOmitted: true`만 보존한다. 상위 message/data와 임의 추가 필드는 증거·RpcError에 넣지 않는다. cause/원문 stack도 전달하지 않는다. HTTP 실패의 숫자 상태와 성공 응답의 receipt/log/return 증거는 유지한다.

revert 신호는 원문을 버리기 전에 분류한다. code 3 또는 code -32000/-32015/-32603에서 `execution reverted`로 시작하는 메시지만 지원 신호로 삼는다. isRevert는 명시적 reverted 플래그를 읽으며 출력용 문자열을 재분류하지 않는다. 일반 문장의 revert 단어나 method-not-found 응답의 revert 문구만으로 revert를 판정하지 않는다. 이는 제공된 RPC 오류 신호의 분류이며 실제 실행을 독립적으로 증명하지 않는다.

CLI는 알려진 로컬 진단, 안전한 숫자 HTTP/RPC 코드와 네트워크 불일치, 고정된 주소·옵션 오류를 출력한다. 그 외 예외는 원문 대신 고정된 일반 진단을 출력한다. 진단 처리 자체의 오류도 원문을 출력하지 않는다. URL 생성 오류의 입력 속성도 전파하지 않는다. 관리형 프록시 설정이나 외부 실행 권한은 바꾸지 않는다.

## 진단과 호환성의 한계

새 오류 증거는 상위 원문 전체가 아니다. custom error/revert payload 디코딩과 제공자별 상세 원인 분석은 이 자료만으로 할 수 없다. RpcError.data는 제공하지 않으며 세 번째 생성자 인자는 명시적 reverted boolean이다. 기존 data 기반 소비자는 이 변경을 반영해야 한다. CLI의 자유 형식 메시지에 의존한 소비자도 숫자 code/category 및 종료 코드를 사용해야 한다.

schemaVersion 1.0과 시나리오 버전은 유지한다. evidence.data는 기존 확장 지점이며 code/category/생략 표식으로 진단 범위를 명시한다. 오류 세부정보 부족으로 PASS·기능 부재·자산 승인 판정을 만들지 않는다. 성공 응답과 요청 params는 별도 신뢰 경계다. 이 변경이 모든 가능한 보고서 내용의 비밀정보 제거를 보증하지 않는다.

## 검토와 검증

Lead 요청 `8cf65636be1447ecb0c6f33dad7d0fac`의 proceed 응답을 회수해 분류 플래그, 원문 생략, CLI 고정 진단과 검증 조건을 적용했다. 표적 소스 검토이며 배포·자산 취급 승인이 아니다.

합성 canary만 사용하는 로컬 HTTP 및 CLI subprocess 테스트로 일반·인코딩 문자열, 중첩 data, 추가 필드, 잘못된 응답, HTTP 상태, JSON/소켓 오류, 잘못된 endpoint 입력과 출력 보고서 파일을 확인한다. 정상 반환 증거·기존 로컬 Fixture 판정은 전체 회귀 테스트로 검증한다. 운영 RPC·거래·인증정보를 사용하지 않는다.
