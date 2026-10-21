# ADR0036: 다른 PC의 로컬 개발과 관측 자료 이동

상태: 채택, 2026-10-21. 사용자가 다른 PC에서도 작업할 수 있도록 하고 완료 후 기존 origin으로 push하도록 승인했다.

소스·빈 환경 template·초기화/진단·개발 인계만 Git에 공유한다. Node24.5+ UI 경로와 Anvil/JDK17·21 전체 검사 경로를 분리한다. setup은 wx/0600으로 새 `.env.local`만 생성하고 기존 파일·symlink를 덮어쓰지 않는다. doctor는 파일 존재와 로컬 도구만 확인하고 공개망/API·Docker·설치를 실행하지 않는다.

격리 checkout 검사에서 실제 Solana 보고서와 TRON compiler cache에 대한 숨은 테스트 의존성을 발견했다. Solana 형식 검사는 합성 specimen으로 바꾸고, TRON 고정 compiler는 명시적 `compiler:prepare` 단계로 준비한다. 기존 로더의 공식 URL·SHA-256·버전 검증을 유지하며 준비 실패를 skip이나 대체 compiler로 우회하지 않는다. 공통 data/tron-compiler-pin.json으로 고정 버전·해시를 공유하고 doctor는 캐시 바이트의 해시를 검사한다. doctor는 해당 JS를 실행하거나 컴파일하지 않는다. 설치 단계 이후 검사 자체는 준비된 cache를 요구한다.

env wrapper는 허용5변수만 parse하고 정해진 세 읽기 CLI에 전달한다. 기존 shell 값을 우선하고 proxy/NO_PROXY/PATH 등 나머지 상속 환경은 변경하지 않는다. 다른 파일 변수는 거부한다. source/eval/shell·변수 확장·값 로그는 없다. 파일 설정은 브라우저에 제공하지 않는다.

원본 보고서는 기존처럼 Git에서 제외한다. 명시적 export는 현재 evidence publisher의9개와 시장 publisher의5개 원본만 읽는다. 10MiB/file·32MiB 합계·46MiB bundle·깊이120 제한, 정규파일/NOFOLLOW·UTF8·JSON·금지 키/URL/credential 패턴과 로컬 알려진 키 일치를 확인한다. 원본 바이트를 변경하지 않으며 의심 자료는 내보내기를 거부한다. 제한된 검사로 모든 비밀정보 부재를 보장하지 않는다.

버전 있는 bundle은 고정 파일명·SHA-256·base64와 내보낸 시각을 담고 ignored reports/transfers 아래0600으로 저장한다. base64는 암호화가 아니고 해시는 진위 인증이 아니다. 외부 전송은 자동 실행하지 않는다. 원본에는 사용자 계정의 공개 주소·관측 맥락이 있을 수 있으므로 신뢰하는 개인 전달 경로로 이동한다.

import는 중복·누락·추가/경로 파일명·길이·hash·형식 오류를 거부한다. 임시0700 디렉터리에 동일 바이트를 저장하고 현재 registry/schema/추출기로 evidence·market publisher를 검증한다. 두 publisher의 입력·출력은 모두 임시 경로다. 원본 시각·판정·FAIL/INCONCLUSIVE를 변경하거나 새 실행으로 인증하지 않는다. 버전이 다른 도구/registry에서 검사에 실패하면 원래 checkout 기준을 확인하며 자동 수정하지 않는다.

목적지 원본이 같은 hash면 무변경, 다르면 중단한다. 누락 파일은 같은 파일시스템의 준비 디렉터리에서 hard link로 exclusive 생성한다. 오류 rollback은 이번 생성 파일의 inode/device와 내용을 확인한 경우에만 제거한다. 단일 writer를 전제로 하며 악의적 로컬 동시 writer에 대한 완전한 경로 경합 방지는 보장하지 않는다. 기존 다른 원본·기존 게시 index를 덮어쓰지 않는다. import 뒤 두 기존 build 명령을 명시적으로 실행해 웹용 자료를 게시한다.

현재 raw 원본14개에 없는 과거 모든 게시 이력·intake·로컬 도구 설정·개인 인계·키의 전체 백업은 제공하지 않는다. 새 PC에서 UI는 바로 열리지만 실제 자료는 이동/관측 후에 표시한다. 이 단계는 서버 수집기·DB·자동 fallback을 앞당기지 않는다.

검증은 합성 표본으로 byte 보존·비밀/변조/경로/충돌 거부와 환경 상속을 검사하고, 실제 로컬 원본의 별도 이동 파일을 생성하여 격리된 소스 checkout에서 설치·전체 검사·오프라인 복원/게시·HTTP/화면을 확인한다. 같은 머신의 재현과 다른 물리 PC의 검증은 구분한다.
