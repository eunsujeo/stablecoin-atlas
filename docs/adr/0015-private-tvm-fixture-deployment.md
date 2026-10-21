# ADR 0015: 사설 TVM 정상 Fixture 배포와 초기 상태

상태: 채택 (2026-10-19). 사용자 승인 범위는 프로그램이 생성·소유·격리를 검증한 신규 사설 TVM이다. 외부 RPC는 읽기 전용이다.

정상 Fixture 하나를 독립 작성하고 공식 TRON Solidity compiler 0.8.26+commit.733b4d28을 고정한다. 공식 solc-bin manifest commit `32695fe4b8d85704da9ec4cedce107a905e412ac`의 게시 SHA-256 `31fe546b9e6ad74e816d6406dcdb59f3af180f9c1145fd994bd5205d9c8465c1`을 다운로드와 캐시 로드마다 대조한다. 소스·설정·init/runtime bytecode의 측정 해시는 별도로 보고한다. import callback과 자동 compiler 선택은 없다. 이는 compiler 재현 빌드 검증은 아니다.

실행마다 생성한 24단어 폐기 mnemonic을 0700 임시 디렉터리의 0600 env-file로 TRE에 전달한다. 생성 직후 파일을 지우고 finally에서 디렉터리를 회수한다. mnemonic은 컨테이너 삭제 전까지 Docker Config.Env에 존재하므로 메모리 전용 비밀이라고 주장하지 않는다. Docker 환경·파생 경로·계정 수를 메모리에서 대조하고 직접 파생한 owner가 실제 잔액을 받았는지 확인한다. 계정 관리 API/운영 키는 사용하지 않는다.

TronWeb 6.5.1(MIT)은 offline protobuf/서명 유틸리티만 사용한다. provider는 생성하지 않는다. 의존성은 lockfile로 고정하고 axios 보안 수정 버전 1.20.0을 해당 하위 의존성에 한정해 override한다. 모든 HTTP는 기존 격리 검증 후 컨테이너 내부 loopback의 고정 Java operation을 통한다. 요청/응답 1MiB, helper와 callback에 시간 제한이 있다.

서명 전 CreateSmartContract가 정확히 하나인지, owner/origin·bytecode·ABI·fee/resource·무자금 이동·기본 permission·TAPOS·시간을 검사한다. JSON을 정수 원문 문자열로 읽고 protobuf 재직렬화가 raw_data_hex와 같으며 SHA-256이 txID인지 확인한다. TRE의 약 12시간 기본 만료는 원본 검증 후 로컬에서 60초로 단축하고 protobuf·txID·계약 주소를 다시 계산한다. 서명 후 raw 불변·단일 서명·owner 복구를 확인한다. native JSON 숫자 해석 문제를 피하기 위해 검증한 protobuf와 서명 전체를 [공식 BroadcastHex API](https://developers.tron.network/reference/broadcasthex)에 전달한다. 금액은 보고서와 JSON에 십진 문자열이며, SDK protobuf setter의 안전 범위 정수 변환은 내부 복사본에만 적용한다. 블록 조회의 bounded 높이만 API 요구에 따라 숫자로 전달한다.

전파는 한 번이다. receipt 지연 시 같은 txID만 조회하고 재배포/자동 재전파하지 않는다. txID·실행 SUCCESS·예측 계약 주소·블록 높이/full ID·실제 포함을 검사하고 runtime code가 빌드와 같은지 확인한다. metadata, 2^128 발행량/owner 잔액, owner-self allowance 0을 읽는다. getter 응답 블록은 UNKNOWN이다. 이번 envelope의 OBSERVED는 AssessmentReport/PASS나 Mainnet 안전성·취급 승인이 아니다. 전송/승인/transferFrom·이벤트 시나리오·수수료 호환성은 후속 작업이다.

검증은 protobuf/hash/owner/ABI/TAPOS/permission/금액 변조 거부, 2^53 초과 정수 보존, 만료 단축, 서명 복구/전체 hex, receipt/inclusion 실패·timeout, bootstrap 권한/삭제·실패 정리와 실제 신규 TVM 배포를 포함한다.

후속 구현: 2026-10-20 [ADR 0016](0016-private-tvm-token-scenarios.md)에서 정상 Fixture의 전송·승인·이벤트·철회/미승인 REVERT를 추가했다. 이 문서의 deployment-only 범위는 `tvm:deploy` 명령에 적용한다.
