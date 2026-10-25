# Collector 심볼릭 링크 CLI 진입점 수정

## 관측과 원인

사용자는 Fedora Asahi Remix44 ARM64의 릴리스 `0c5b59547d2fcfbfa7d16f721f28ecb010d423b3`에서 `collector-current` 경유 status가 무출력 rc0이고 `readlink -f` 경유는 정상이라고 보고했다. 이는 사용자 서버 관측이며 이번 작업에서 Supabase나 서버로 재조회하지 않았다.

Node가 기본적으로 심볼릭 링크를 해석한 `import.meta.url`과 링크가 남아 있는 `process.argv[1]`의 file URL을 문자열 비교해 main 호출을 건너뛰는 원인을 소스와 새 임시 디렉터리의 subprocess로 확인했다. 수정 전 회귀 시험7개가 모두 실패했으며, CLI6종은 링크에서 rc0/무출력으로 종료하고 정상 로컬 doctor 결과도 출력되지 않았다.

## 수정과 범위

`tools/cli-entrypoint.mjs`는 모듈과 실행 인자의 실제 경로를 모두 해석해 비교한다. argv 부재·해석 실패·다른 모듈·query/hash가 붙은 별도 모듈은 진입점으로 취급하지 않는다. systemd의 `collector-worker.mjs`, `registered-collector.mjs`, `fx-store.mjs`, `collector-deploy.mjs`, `publish-production-fx.mjs`, `production-web.mjs`에 적용했다. import-only는 main을 실행하지 않는다.

기존 오류 출력·종료 코드와 수집 주기/API 한도·DB 예약·Receipt/Archive 복구·FX claim·unit 파일은 유지한다. 이번 변경은 실행 판정만 수정한다. 공통 함수는 파일 경로 동일성 판정이며 모듈 진위/권한 검증을 대신하지 않는다. Lead `e20d4b63d91b44238e3df8672a90f05a`의 proceed와 양쪽 정규화·부작용 없는 검증 조건을 반영했다.

## 수행·실패와 수정

새 시험은 환경변수를 PATH와 임시 HOME/TMPDIR로 제한하고 fetch/Socket 연결을 차단한다. status의 미지원 인자로 오류 경로를 검사해 실제 DB 접속 전 종료한다. 실제 경로·디렉터리 링크·파일 링크·상대 경로·release 디렉터리의 `--preserve-symlinks-main`·import-only를 비교한다. 공백/# 경로도 포함한다.

시험 준비 중 없는 `--env-file`을 사용하자 로컬 Node25.2.1이 rc9로 종료해 의도한 앱 오류 경로를 검증하지 못했다. 미지원 인자로 바꿔 앱 파서에서 거절하도록 했다. 추가 FX 성공 fixture의 XML header/Sender 누락은 FX_INVALID로 거절돼 기존 고정 형식에 맞췄다. 공백/# 시험 경로의 preload를 문자열 경로로 넘기면 Node가 # 이후를 URL fragment로 해석하므로 `pathToFileURL`로 바꿨다. 이들은 시험 구성 오류이며 제품 FX 검증을 완화하지 않았다.

성공 경로는 임시 private writer 설정의 무통신 배포 doctor와 합성 XML의 오프라인 FX import/check/publish로 확인했다. 원본 XML·snapshot·receipt의 바이트와 디렉터리 목록이 그대로인지 검사한다. 소유 임시 자료는 시험 종료 시 삭제하며 기존 `.state` 수집 자료는 사용하지 않는다.

## 검증과 재현

- `node --test --test-reporter=tap tests/cli-entrypoint.test.mjs`: rc0, tests8/pass8/fail0.
- `npm run check`: rc0, tests608/pass608/fail0/cancelled0/skipped0 (TypeScript 검사 포함).
- `npm run check:production`: rc0, tests15/pass15/fail0/cancelled0/skipped0.
- `git diff --check`: rc0.
- 로그: `.state/agent-logs/cli-entrypoint-before.log`, `cli-entrypoint-after.log`, `collector-symlink-check.log`, `collector-symlink-production.log`.

실제 Arkham/ECB/기타 데이터API0, Supabase 조회/예약 변경0, 기존 수집 상태 변경0, 서버 배포/서비스 변경0이다. GitHub push는 운영 적용을 뜻하지 않는다. Fedora/ARM64/실제 systemd에서의 재실행은 NOT_TESTED이며 사용자가 제공할 새 SHA 적용 결과와 대조해야 한다. 새 서버 실행·수집 활성화는 이번 승인에 포함되지 않는다. 키·RPC URL·환경설정 원문은 기록/게시하지 않는다.
