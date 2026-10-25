# 추가18곳 연구 결과의 로컬 자산 프로필 반영

2026-10-25 인계문 확인 후 사용자가 추가18곳 모두의 로컬 웹 반영을 승인했다. [ADR0102](../adr/0102-scoped-top10-profile-excerpts.md)가 표시 경계의 정본이다. [연구 원본 결과](2026-10-25-top10-source-review-results.md)와 구조화 JSON, 소비 기록은 변경하지 않았다.

## 수행 경로와 확보 범위

1. 기존 웹 데이터·렌더러·전체 현황·정적 발췌 생성기를 확인했다. 기존8곳을 모두 SOURCE_REVIEWED로 표시하고 coinId별14기능을 재사용하는 경로라 새18곳에 그대로 적용하면 프록시·공통 코드·문서만 확보한 경우를 오표시할 수 있었다.
2. Lead `4b0e34bf486d418d84b385cefc1339ba`의 proceed 검토를 회수했다. profile별 독립 기능,7개 상태,non-EVM 선택키,기존8/전체26 분모와 범위별 집계,원문 미공개·브라우저 검증 조건을 반영했다. 모델 전환은 수행하지 않았다.
3. `tools/top10-profile-excerpts.mjs`로 저장 결과의 명시 필드만 새 공개 모듈로 발췌했다. 원래 조건·state·한계와 근거 SHA-256/취득 시각을 그대로 연결했다. 기존8곳의14기능을 보존하고 새18곳은 체인별 가변 항목을 제공한다.
4. 기본 웹과 Atlas의 네트워크 선택·검색·3개 탭·상태 필터·근거 발췌를 연결했다. 새18곳의 로직6/프록시4/프로토콜·참조·브리지7/문서1이라는 연구 범위를 구분한다. 전체 현황에는 기존 소스 확인8/전체 검토26과 자산별 범위별 수를 표시하고 읽기 등급·판정 산식은 유지한다.
5. non-EVM에는 EVM chainId를 만들지 않는다. 저장 mint·currency+issuer·module/FA object·view와 후보 주소를 구분하고 발췌에 없는 식별자는 미포함으로 명시한다. 전체26프로필은 기존8+추가18이다. 공급량 선정22의 기존4곳을 이번에 새로 추가했다는 의미는 아니다.

## 실패·원인과 수정

첫 브라우저 검사는 과거의 기능 수 표시 금지 정규식이 새 정상 필터 이름 `공통 프로토콜 기능 1`까지 금지해 실패했다. 기존8곳에는 그 검사를 유지하고 신규 범위는 원래 상태·행·조건의 실제 일치로 검증하도록 수정했다. 네트워크 기억 검사는 새 non-EVM 마지막 선택 Arc가 보존되는 동작에 맞춰 기대값을 바꿨다. 데이터나 판정을 시험에 맞춰 바꾸지 않았다.

정적 근거 생성기의 기존 템플릿에는 검토 기준일 자리의 comma expression과8개 배포 고정 문구가 있었다. 실제 날짜·자산/프로필 수로 수정하여 발췌 본문과 일치시켰다. 수집 도구 실패나 동적 사이트 자료 부재를 새로 판단한 작업은 없다. 이번 브라우저 검증 대상은 로컬 생성 화면이다.

## 미확인과 보존

초기 구현 후보의 현재 구현 대응, 프록시만 확보한 곳의 토큰 로직, 공통 프로토콜의 자산별 활성 설정, 참조·브리지와 실제 원장의 대응, 문서만 확보한 구현 소스, 공급량과 선택 컨트랙트 물량 대응을 유지했다. 현재 배포 연결 UNKNOWN을 새 실패나 제품 PASS로 변환하지 않았다. 기존 실패·MISMATCH·UNKNOWN과 연구 원본은 보존한다. 외부 자료/API/RPC/다운로드·키·운영 DB 변경0이며 브라우저 외부 요청0을 검사한다.

## 재현과 검증

```sh
node tools/top10-profile-excerpts.mjs
node tools/source-review-notes.mjs
node --test web/source-review.test.mjs
npm run ui -- --port 4397
node tools/source-review-browser-check.mjs http://127.0.0.1:4397
npm run check
git diff --check
```

`node --test web/source-review.test.mjs`: rc0, tests4/pass4/fail0/cancelled0/skipped0. 브라우저 검사: rc0, 기본/Atlas26프로필·필터/네트워크/탭·새18곳 모바일3탭·다크/라이트·390px, JS오류0/외부요청0. 실제 화면 `.state/top10-atlas-light-mobile.png`를 열어 문서/추가 근거 상태와 줄바꿈을 확인했다. `npm run check`: rc0, tests591/pass591/fail0/cancelled0/skipped0. `git diff --check`: rc0. 로그는 `.state/agent-logs/top10-profiles-{unit,browser,check}.log`, 브라우저 이미지는 `.state/top10-{atlas,legacy}-{dark,light}-mobile.png`. 원본 archive를 새로 읽거나 외부로 보충할 필요 없이 Git에 있는 허용 필드로 발췌를 재생성할 수 있다.
