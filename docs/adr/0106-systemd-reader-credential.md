# ADR0106: systemd Reader Credential 파일 검증

일자: 2026-10-25. 상태: 사용자 요청에 따른 호환성 수정·로컬 검증. 실제 서버 적용은 별도다.

## 원인과 결정

사용자는 Fedora Asahi44의 서비스 UID981에서 root:root0440 Credential을 읽고 Reader DB 권한 검사도 통과했지만, 99c372f의 일반 파일 UID 일치 검사로 시작이 거절됐다고 보고했다. 이는 사용자 제공 운영 관측이며 이번 세션의 직접 관측이 아니다.

production에만 별도 Credential 정책을 적용한다. 환경변수만으로 임의 경로를 신뢰하지 않고 `/run/credentials/<단일 unit>/reader.env` 정확 경로·root 관리 상위 디렉터리·unit 디렉터리 소유/권한·symlink 부재와 파일 소유/권한을 함께 검증한다. root0400/0440과 서비스 UID0400/0600을 허용한다. root unit 디렉터리의 group r/x는 ACL mask 가능성을 고려한다. 이 검사는 mount/ACL 진위의 독립 인증이 아니며 root가 관리하는 systemd 실행 환경을 신뢰한다. 상세 정책은 [운영 안내](../PRODUCTION_DEPLOYMENT.md#환경-파일과-reader-분리)를 따른다.

`O_NOFOLLOW` descriptor의 fstat에도 동일 정책과 lstat 파일 동일성을 적용하고 그 descriptor에서 최대64KiB를 읽는다. 크기/메타데이터 변동·읽기 실패는 내용/경로 없는 고정 오류로 종료한다. 기존 일반 파일 정책·Preview·Reader/Writer·TLS·DB schema/수집 정책은 유지한다. credential 환경에서 외부 파일로 fallback하거나 운영 원본/릴리스를 수정하지 않는다.

## 근거와 한계

[systemd.exec 공식 문서](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#Credentials)는 `CREDENTIALS_DIRECTORY`와 system service의 `/run/credentials/UNITNAME` 참조, 서비스 사용자/root의 접근을 설명한다. 소유 UID 일치만으로 전달 파일을 분류하지 않는다. 지원 범위는 system service이며 user manager 경로는 제외한다.

실제 Fedora의 mount/ACL·SELinux·LoadCredential 부팅/재시작 검증은 로컬 가상 메타데이터·파일시스템 시험과 구분한다. 과정과 결과는 [연구 기록](../research/2026-10-25-systemd-reader-credential.md)을 따른다.
