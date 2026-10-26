# 자산 프로필·기술 검증 현황 DB 저장

[ADR0114](adr/0114-asset-review-supabase-snapshot.md)의 사용자 승인으로 두 화면이 같은 검토 snapshot을 사용한다. 현재 입력은 2026-10-25 검토 자료26프로필/179기능이며 실제 배포 안전성/권한 인증이 아닌 저장 소스·문서 조건 검토다. 기존 catalog의 기본정보와 연구 프로필의 범위를 구분하고 등록되지 않은 연구 자산을 catalog에 자동 추가하지 않는다.

`npm run review:asset:db -- init|grant|import|read|boundary`가 수동 CLI다. 웹 요청/서버 시작은 migration/import/분석을 실행하지 않는다. private `atlas_asset_review`에 검토된 공개 요약 snapshot만 append하며 원문·키·RPC/DB URL을 저장/게시하지 않는다. 같은 snapshot ID/다른 내용은 거절한다. 새 검토는 새 ID로 입력하고 기존 행을 수정/삭제하지 않는다.

## 입력과 적용

검토 파일은 `tools/asset-review-source.mjs`의 `reviewedAssetSnapshot`을 명시 JSON으로 내보낸다. 이 모듈은 기존 공개 발췌만 읽으며 비공개 source/report 탐색이나 외부 호출은 없다. `--expected-sha256`는 해당 파일의 검토한 전체 바이트 SHA256이다. CLI는 연결 전에 hash와 필드·26개 ID/기능 ID 집합·민감값/크기를 검증한다. 실제 DB에서는 canonical payload hash를 보존하고 reader가 재검증한다.

관리자/writer/reader는 기존 `.state/market-db-secrets/{admin,writer,reader}.env`를 사용한다. 새 접속값/키를 인자로 넘기지 않는다. init/grant는 관리자, import는 writer, read는 reader만 사용한다. 관리/입력에 공개 API 역할의 definer 검토가 필요하면 기존 고정 SOURCE_REVIEWED 파일과 그 SHA256을 `--reviewed-definers`/`--reviewed-sha256`으로 명시한다. 임의 hash 재생성/allowlist 확대로 오류를 우회하지 않는다.

사설 PG17 검증 후 명시 init → 기존 writer/reader grant → import → 동일 입력 무변경 확인 → reader/경계/기존 스키마 확인 순서로 적용한다. 기존 schema가 있으면 검증 없이 초기화를 반복하거나 덮어쓰지 않는다. 권한/TLS/검증 실패 시 endpoint/CA/키 변경이나 자동 재시도 없이 상태를 기록한다. 실제 적용 결과는 [연구 기록](research/2026-10-26-asset-review-supabase.md)을 따른다.

## 화면과 캐시

```sh
npm run ui -- --database --database-env .state/market-db-secrets/reader.env
npm run review:asset:db -- read --env-file .state/market-db-secrets/reader.env
```

자산 프로필 `/#assets`와 기술 검증 현황 `/#overview`는 `/asset-review-data.json`의 동일 snapshot을 브라우저에서 한 번만 요청한다. 두 영역은 같은 snapshot ID를 data 속성으로 보유하며 집계와 상세가 독립 자료로 갈라지지 않는다. 로딩바/스켈레톤/aria-busy는 성공/실패 모두 정리한다. 오류는 명시 표시하고 정적 프로필로 fallback하지 않는다. 기본 JSON 미리보기는 같은 공개 검토 snapshot을 서버에서 명시 제공하는 별도 모드다.

서버의 검증된 성공 snapshot은 1시간 캐시하고 동시 요청을 합친다. 만료 후 첫 요청에서 재조회하며 실패한 갱신으로 이전 cache 객체/시각을 덮어쓰지 않지만 만료 자료를 정상 응답으로 사용하지 않는다. HTTP/브라우저 no-store는 유지한다. 즉시 반영이 필요하면 로컬 UI를 재시작하고 페이지를 새로고침한다. 브라우저는 한 페이지에서 처음 받은 snapshot을 계속 공유한다.

정적 근거 발췌 문서는 원래 검토의 참고 자료이며 새로운 snapshot을 자동 게시하지 않는다. 실제 운영 웹 배포·Collector/FX·Tunnel/DNS 변경은 이 작업에 포함하지 않는다. 기존 두 화면의 production 준비 코드/API wiring만 맞추고 별도 컨트랙트 메뉴의 production 제외는 유지한다.
