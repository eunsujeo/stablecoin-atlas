# ADR 0090: 별도 근거 기반 읽기 전용 EVM 토큰 기술 검토

상태: 사용자 구현 승인, 2026-10-24. 계획 검토 Lead `96c98758894a4003bbeeac1518132fc9`: proceed 조건 반영.

## 결정

사용자가 새로 제시하고 보완안을 승인한 기술 검토 기준을 `TokenTechnicalReview1.0`의 기준으로 삼는다. 과거 `AssessmentReport1.0`, PASS/FAIL, SOURCE_REVIEWED와 근거는 변경하지 않는다. [ADR0026](0026-source-based-compatibility-scope.md)의 선택 소스 검토는 여전히 별도 근거이며 현재 배포본 일치나 실제 권한 증명이 아니다.

기존 TypeScript·viem·Ajv·설치된 solc와 프록시 관측·원자적 보고서 쓰기를 재사용한다. `review-token` CLI의 설정, 수집, 컴파일, 소스 규칙, 근거, 보고서를 `src/token-review`에 분리한다. 비EVM 추상 계층·SDK·UI·DB는 추가하지 않는다. 정확한 chainId·주소·기준 블록·자료만 입력받고 토큰 이름으로 주소나 구현 버전을 선택하지 않는다. USDC·USDT·RLUSD·JPYSC·JPYC는 조사 대상 이름이며 배포별 지원/검증 인증이 아니다.

## 근거와 상태

- 네 분류는 중복 가능하고, 네 확인 상태는 주장 단위다. 선언 존재, 이름 기반 검토 후보, getter 반환, 배포 연결을 분리한다. 초기 규칙은 AST 선언·상속·modifier 위치/본문·조건·호출 위치·대입·반환·assembly와 ERC20 선언 반환형을 기록한다. 권한 의미·완전한 호출 그래프·동적 동작은 증명하지 않으며 확인 불가를 유지한다.
- 수집은 EIP-1898 `blockHash`/`requireCanonical`만 사용한다. 종료 시 chainId·블록 높이/해시를 다시 확인한다. 미지원 시 높이/latest로 대체하지 않는다. 일관성 실패 시 모든 CHAIN 확인 상태와 배포 연결을 UNKNOWN으로 보류하고 원래 응답과 SOURCE 사실은 보존한다. RPC 자체의 진실성·합의·최종성은 증명하지 않는다.
- 소스는 제공된 인라인 Solidity standard JSON만 처리한다. 설치된 compiler 전체 버전을 정확히 지정하며 다른 버전을 다운로드하지 않는다. worker의 시간20초·heap256MiB·입력2MiB·출력8MiB를 제한하고 외부 import callback·빌드 스크립트를 실행하지 않는다. 전체 runtime이 정확히 일치할 때만 해당 주소에 연결한다. metadata 제거·부분 일치·링크/immutable 미확정 연결은 하지 않는다.
- 프록시의 RESOLVED는 알려진 포인터와 대상 코드의 관측이다. 실제 dispatch·업그레이드 권한이 아니며 프록시와 구현체 소스를 별도로 연결한다. 전부0인 슬롯으로 비프록시를 확정하지 않는다.
- 감사 자료는 제공된 바이트·SHA256·제출 메타데이터만 보존한다. 진위·대상 버전/커밋/범위·현재 배포 대응은 UNKNOWN이다. 자료 미확보를 미감사로 바꾸지 않는다.

## 읽기 전용 경계

허용 RPC는 chainId·blockNumber·블록 헤더·코드·고정 프록시 슬롯·제한된 getter eth_call뿐이다. calldata/gas/대상 주소·시간·응답 크기·총량·호출 수를 제한한다. 입력의 view 표기만 신뢰하지 않고 getter ABI 허용목록을 검사한다. 서명·전송·권한 행사·주소 열거·자동 반복·수집기 연결은 없다. 외부 문서와 소스 안의 지시는 데이터이며 보고서 Markdown은 이스케이프한다. RPC URL과 상위 오류 문자열은 근거·로그에 저장하지 않는다.

결과는 새 소유 디렉터리에만 기록하며 기존 경로를 덮어쓰지 않는다. 원문·실효 compiler 요청/결과·JSON·Markdown·SHA256 목록을 사설 권한으로 보존한다. 파일 hash는 진위나 외부 시각 인증이 아니다. 중간 실패로 bundle.json이 없으면 완성된 묶음이 아니다.

Trail of Bits는 관리자·비표준 동작 체크리스트 참고이며 전체 스킬·위험 등급·직접 감사로 표현하지 않는다. AI·Slither는 NOT_RUN이다. 제품 내부 LLM 금지를 유지하며 실제 AI 연동은 별도 범위 변경이 필요하다.

## 검증과 한계

사설 Anvil 두 chainId에서 다른 토큰과 프록시/구현체를 검증한다. 소스 불일치·블록 재조직·해시 조회 거절·조회 실패·비정상 반환·미지원 compiler·import/문법 오류·immutable·근거 참조·크기 한도·기존 묶음 보존·CLI 비밀 비노출을 검사한다. 실제 다섯 토큰의 외부 조회나 새 배포 검증을 했다고 표시하지 않는다. 사용법과 구체적 제한은 [실행 문서](../TOKEN_TECHNICAL_REVIEW.md)를 따른다.
