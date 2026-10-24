# ADR 0091: 오프라인 정적 경로·조건부 runtime·감사 소스 대조

상태: 사용자 후속 구현 승인, 2026-10-24. Lead `c9ff179981d8483ebb89c43520ae345d` proceed 조건 반영. [ADR0090](0090-readonly-token-technical-review.md)의 별도 기술 검토를 보강한다.

## 결정

설정/결과1.1을 추가하고 기존1.0 schema·근거·판정을 보존한다. 1.0 설정은 기존 schema로 읽고 1.1 기능을 혼합하지 않는다. 새 보고서는1.1이며 검증 함수는 두 결과 버전을 구분한다. 제품 AI·새 외부 API/키·운영 DB·UI/감시는 추가하지 않는다.

## 정적 권한 경로와 동작

신뢰된 설치 compiler가 생성한 AST 선언 ID·타입·상속 linearization으로 명시 진입 함수의 연관 선언, modifier, 내부 호출, 조건, 저장값 변경을 연결한다. 같은 selector의 진입점은 상속 순서상 가장 구체적인 선언을 선택한다. virtual/super·외부 호출·함수 포인터·storage alias·assembly·인자 미치환·순환·절단은 불완전성으로 남긴다. 이는 가능한 선언 관계이며 실행 순서나 모든 경로의 도달성 증명이 아니다.

내장 require의 직접 `msg.sender == 주소형 저장변수` 비교는 해당 소스 위치의 조건 구문만 CONFIRMED로 기록한다. OR 우회 조건·사용자 함수 require·주소 역할에 관한 이름만으로 같은 판정을 내리지 않는다. 어떤 경우도 진입 함수 전체의 권한 보장을 CONFIRMED로 바꾸지 않는다.

false 반환문, 중첩 mapping의0비교, 주소 조건, 곱셈/나눗셈, 외부 호출, assembly, 전송 selector 밖의 address→uint mapping 대입을 위치와 함께 제시한다. 패턴 존재는 소스 구문 관측이며 실제 수수료·잔액 변경 의미·승인 제약·취약점은 UNKNOWN 후보다. 저장값별 변경 진입점을 제공하되 정적 경로의 의미·권한 보장은 UNKNOWN이다. 미관측·절단을 안전/부재로 판정하지 않는다.

## Runtime 대응

library 주소는 standard JSON settings.libraries에 명시하고 설치 compiler가 링크한 전체 runtime만 원시 비교한다. 미링크 참조는 UNKNOWN이며 주소를 추측하거나 배포 바이트를 가려서 비교하지 않는다.

immutable은 compiler AST ID별로 사용자가 제출한32바이트 값만 치환한다. compiler 원본 offset·32바이트 길이·범위·중복/중첩·0 placeholder와 값의 누락/추가를 검사하고 원본·제출값·치환 범위·전체 결과를 보존한다. 전체 바이트가 일치해도 생성자 실행/값 출처를 재현한 것이 아니므로 `SUBMITTED_IMMUTABLE_VALUES` 비교와 UNKNOWN 배포 연결을 유지한다. metadata 제거·부분 일치·관측 코드로부터 값 자동 추출은 하지 않는다. 잘못된 참조·불일치는 별도 실패다. 원시 runtime의 정확한 일치는 기존 종료 chain/hash 재검증 후에만 배포 연결 CONFIRMED가 가능하다.

## 감사 소스 대조

감사 문서와 별도로 제출된 source snapshot standard JSON을 명시한 분석 주소의 소스와 대조한다. 경로 집합과 각 content UTF8 바이트의 SHA256·일치/차이/누락/추가, 정규화한 compiler settings 객체의 일치를 기록한다. JSON 포장 공백이나 key 순서가 아니라 소스 경로/바이트를 비교한다. compiler 기본값의 의미상 동등성은 추정하지 않는다. 이 snapshot이 실제 감사 대상이라는 문서 연관, 진위, 감사 범위/commit, 현재 배포 대응은 UNKNOWN이다. 문자열·hash 일치만으로 감사받은 배포라고 표현하지 않는다.

## 오프라인 모드와 검증

`--offline`은 RPC_URL 없이 동작하며 체인 조회/재검증을 전혀 실행하지 않는다. 네트워크/주소는 제출 식별자이고 체인/블록은 미확인이다. 로컬 소스·snapshot·근거와 보고서를 생성한다. 읽기 전용 기본 경로와 같은 한도·사설 파일 권한·기존 묶음 보존을 적용한다.

사설 Fixture에서 상속·내부 guard·우회·가짜 require·override/super·modifier 전후/중복·순환·alias·assembly·절단, 승인/반환/수수료 후보, immutable 정확/오류/중첩/추가값, library 실제 링크, 감사 경로/내용/설정 차이, 무HTTP 오프라인·기존 schema 보존을 확인한다. 실제 다섯 토큰의 외부 배포 확인과 다른 compiler의 신뢰된 준비는 별도 입력/범위 확인이 필요하다.
