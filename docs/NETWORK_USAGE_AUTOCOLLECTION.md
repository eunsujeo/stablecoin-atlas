2026-10-31 변경: [ADR0126](adr/0126-collection-runtime-boundaries.md)에 따라 reviewed-definers 검토본은 설치/권한 변경 및 별도 boundary 점검에 사용한다. 일별 check/run/claim/import에는 이 파일이 필요 없다. 기존6필드 config를 그대로 읽을 수 있으며 review 두 필드는 런타임에서 사용하지 않는다. writer 최소권한·스키마/RLS·직접 공개 접근·API-role membership·승인기간/예산/일별 claim은 유지한다. 아래 review 파일 필수 안내와 비활성 기록은 변경 전 이력이며 운영 적용 결과는 [복구 기록](research/2026-10-31-collection-runtime-recovery.md)을 따른다.

# 네트워크 활동 자동 수집 운영

초기30일 예산은 사용자 추가 승인으로 확정했다. 2026-10-29~11-27 UTC·하루18GET/총540GET·총1080MiB·비용UNKNOWN 수용이며 [승인 기록](research/2026-10-28-usage-period-authorization.md)을 따른다. 실제 운영서버 설치/활성화는 아직 미실행이다.

사용자는 Supabase/UI 반영과 운영 자동 수집을 요청했다. 이 도구는 기존 시장/등록자산/FX 수집과 독립된 daily job이다. 기존 주기·예약·키·원문을 변경하지 않는다. 실제 운영 서버 설치나 timer 활성화는 이 저장소 변경으로 실행되지 않는다.

## 수집 계약

고정18개 자산×네트워크 조합, 직전의 완결된 UTC7일, 각 GET /transfers/histogram 1회다. 초기수집의13후보와기존5개를합친 같은 정확주소를 사용한다. 등록33 중 나머지15는 NOT_TESTED로 남기며 자동으로 새체인/주소/endpoint/공급자로 전환하지 않는다.

UTC00:20 하루1회(systemd timer), 최대18GET/0run·응답2MiB/하루36MiB·420초·요청20초·송신간격1초·재시도/redirect/추가페이지0. 기존 시장/FX의 한도에 이 새 호출을 숨겨 합치지 않는다. 별도 수집 예산이며 전체 계정/조직 청구 상한은 보장하지 않는다. 비용 UNKNOWN을 명시적으로 수용한 기간 authorization이 있어야 한다. 실제새provider호출은 이번작업에서0이다.

기간은 최대31일이다. `fromDay` 포함/`untilExclusive` 제외, 18×날짜수 GET 및36MiB×날짜수의 누적 상한을 검사한다. 만료 시 자동 갱신/수집을 하지 않고 마지막 정상 snapshot을 유지한다. 한 번의 승인기간 안에서는 운영자가 매일 승인할 필요가 없다.

- DB의 불변 collection_day PK(day)와 실제 DB UTC 날짜로 하루1개만 선점한다. 다른 PC/프로세스·새 로컬 root로도 같은 날짜를 재소비하지 못한다.
- 기존 공통 송신 lock 구현과 소유/격리된 영속 root를 사용한다. root나 원문을 임의로 초기화하지 않는다. 다른 시장 수집기까지 포함한 전체 공급자 RPS/조직 배타성을 주장하지 않는다.
- 선점 후 crash/타임아웃/429/첫 실패는 그 날의 남은 호출을 하지 않는다. `Restart=no`, `Persistent=false`라서 자동 재시도/중단일 몰아 수집을 하지 않는다.
- intent/receipt 영속화 후 fetch 직전에도 UTC day/lease를 재검사한다. 자정 또는420초를 넘으면 새 HTTP0으로 종료한다.
- 18건 모두 정상인 원문을 재검증한 뒤 새126행 snapshot을 append한다. 누락 bucket은 null이며0이 아니다. 전부누락이면 새snapshot을게시하지않는다.
- DB 입력 실패 후 같은날재시작은 완결된 원문을 재검증해 게시만 복구(0GET)한다. 불완전 원문은 다시 호출하지 않는다. 다음날은 그날의7일창만 수집한다.

## 배포 준비와 자격증명

기존 검토 SHA release를 `/opt/stablecoin-atlas/collector-current`로 가리키는 [수집기 배포 절차](COLLECTOR_PRODUCTION_RECOVERY.md)를 따른다. git archive 기반 release에는 새 tools/web/data/deploy 파일도 포함된다. 설치 도구가 production에 코드를 복사하기 전 고정 SHA와 의존성을 검토한다. symlink 경유 CLI는 별도 회귀로 검증한다. 운영 Mac mini에 이 작업으로 직접 접속/배포하지 않는다.

운영자가 다음을 준비한다. 예시의 경로 외 실제 키/URI/프록시 값을 문서/Git에 넣지 않는다.

```sh
sudo install -d -m 0700 -o atlascollector -g atlascollector /etc/atlas-usage /var/lib/atlas-usage
sudo install -m 0600 -o atlascollector -g atlascollector deploy/usage.config.20261029-20261127.json /etc/atlas-usage/config.json
sudo install -m 0600 -o atlascollector -g atlascollector deploy/usage-authorization.20261029-20261127.json /etc/atlas-usage/authorization.json
```

`/etc/atlas-usage/writer.env`에 기존 DATABASE_URL/필요 CA 경로/ARKM_API_KEY만 atlascollector 소유0600으로 넣는다. 웹 reader나 admin 키를 넣지 않는다. PostgreSQL TLS 검증은 유지한다. 공개 API 노출 경계의 기존 reviewed-definers 검토본을 해당소유0600의 `/etc/atlas-usage/reviewed-definers.json`으로 비공개 이동한다. 새로운 definer를 자동 승인하지 않는다. Web 프로세스에 공급자 키나 writer를 전달하지 않는다.

서버의 기존 project proxy가 필요하면 `/etc/atlas-collector/proxy.env`를 service가 읽는다. 기존 HTTP_PROXY/HTTPS_PROXY/NO_PROXY 정책을 존중한다. 관리형 agent proxy의 값은 복사/게시하지 않는다.

## 기간 승인과 활성화 — 운영자 실행 단계

아래는 실행하지 않은 운영 절차다. 먼저 `npm run collector:usage -- plan --day YYYY-MM-DD`로 정확주소/7일창과 policyHash를 확인한다(외부/DB0). policyHash는 날짜와 독립적이며 대상/한도/등록소스가 바뀌면 달라져 기존 authorization을 거절한다.

초기30일 승인 파일 `deploy/usage-authorization.20261029-20261127.json`은 실제 사용자 추가 승인을 반영했다. 날짜·상한·정책을 수정하지 않고 사용한다. 승인 원문은 비공개 보존했다. 최초 실행 예정은 2026-10-29 00:20 UTC(한국09:20), 마지막은 11-27이며 11-28 UTC부터 만료다. 제안용 `usage-authorization.proposal.json`은 당시 준비본으로 보존하며 승인 파일을 대신하지 않는다. 기간 연장·대상/한도 확대를 자동 승인하지 않는다. 다음 값은 현재 정책이다.

`policyHash=3f53df9d23f14ea4fb37de58bf6bd867043653f6ee5238f0914b914049283b0b`

승인 파일 SHA256은 `a4c3e2c4f911ec38cc236ca632d9a05a4fc59ea887e15b27ca2d47f8e171f4ac`이다. 제공 config에는 승인 hash와 기존 reviewed-definers hash가 반영되어 있으므로 운영자는 실제 파일 hash를 대조한다. 원문을 출력하지 않는다. 읽는파일은 소유·권한·symlink·크기/hash를 검증한다. 10-28은 승인기간 전이므로 check/run이 기간 검증에서 거절되는 것이 정상이다. timer는 미리 설치할 수 있으나 즉시 service를 수동 실행하지 않는다. 기간이 유효한 UTC 날짜에 아래 check는 DB구조 읽기만 수행하며 새 API/선점을 하지 않는다.

```sh
sudo -u atlascollector /usr/bin/node --use-env-proxy /opt/stablecoin-atlas/collector-current/tools/usage-operating-cli.mjs check --config /etc/atlas-usage/config.json
sudo install -m 0644 deploy/atlas-usage.service deploy/atlas-usage.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now atlas-usage.timer
sudo systemctl list-timers atlas-usage.timer
```

`enable --now`는 timer를 켠다. `Persistent=false`라 지나간00:20을즉시따라잡지않는다. 즉시수동service실행은 실제그날18GET 예산을 소비하므로 승인/날짜/선점 상태를 확인한 운영 단계에서만 수행한다. 실패 복구를 위해 service를 반복 시작하거나 root/DB claim을 삭제하지 않는다. 중단은 timer를 disable하며 과거 원문/DB를 지우지 않는다.

API/웹은 DB의 최신 검증된 snapshot만 읽고 웹 요청/서버 시작은 수집하지 않는다. 브라우저 IndexedDB·5분 TTL·중복 병합·429 Retry-After/last-good·Safari getReader 정책을 유지한다.
