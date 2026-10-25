# Arkham Configurable Collection Scheduler

기본은 UTC1시간/하루24예약이다. Arkham 시장 수집 본체의 슬롯당 최대7GET·retry0·Receipt/Archive·DB 중복 방지는 유지한다. 기본 요청 상한은24×7=168GET/UTC일이며 실제 성공 횟수/공급자 과금 보장은 아니다. 실패·UNCONFIRMED도 사용 예약으로 남는다. FX·등록 일별·Web/Tunnel은 변경하지 않는다. [ADR0108](adr/0108-configurable-arkham-scheduler.md)·[검증 기록](research/2026-10-25-configurable-arkham-scheduler.md).

## 설정과 검증

`/etc/atlas-collector/schedule.env`에는 비밀이 아닌 다음 두 값만 둔다. 키/DB URL은 기존 private `writer.env`에 유지한다.

```dotenv
ARKHAM_COLLECTION_INTERVAL=1h
ARKHAM_DAILY_RUN_LIMIT=24
```

| 주기 | UTC 슬롯 수/일 | 허용 예약 상한 |
|---|---:|---:|
| 5m | 288 | 1~288 |
| 15m | 96 | 1~96 |
| 30m | 48 | 1~48 |
| 1h | 24 | 1~24 |
| 2h | 12 | 1~12 |
| 6h | 4 | 1~4 |
| 12h | 2 | 1~2 |
| 24h | 1 | 1 |

모든 주기는 UTC00:00을 기준으로 정렬한다. 5분의 정수배이며 UTC 하루를 나누므로 기존 DB 슬롯 제약과 호환된다.

주기와 예약 상한은 독립적이다. 예:1h/12는 당일 먼저 확보한12슬롯까지만 허용한다. 2h만 설정하고 상한24를 생략하면 기본24가12슬롯보다 커서 거절하므로 두 값을 함께 지정한다. 0은 기존 CLI와 같은 Arkham 비활성 스위치이며 DB 정책을0으로 바꾸지 않는다. 비활성 상태에서 남은 Arkham CLAIMED 복구에는 활성 정책과 일치하는 양수 설정이 필요하다.

우선순위는 **CLI > 프로세스 환경변수 > 명시 `--schedule-file` > 기본1h/24**다. CLI는 `--arkham-interval`·기존 `--arkham-runs-per-day`를 run/status에서 받는다. 이전288 인자만 쓰면1h와 충돌하므로 legacy 실행에는 `--arkham-interval 5m --arkham-runs-per-day 288`을 함께 지정한다. 자동5분 fallback은 없다. 지원하지 않는 문자열·단위·0/음수 주기·소수/음수/초과 상한·중복 인자를 거절한다. 환경/파일의 빈 값도 오류다.

systemd는 필수 `EnvironmentFile=/etc/atlas-collector/schedule.env`를 읽는다. 서비스의 하드코딩된288 인자를 제거했다. 명시 writer `--env-file`은 기존처럼 상속된 자격증명을 무시하지만, 스케줄 변수는 별도로 읽어 잃지 않는다. 수동 doctor/status는 같은 파일을 `--schedule-file`로 지정한다. writer.env에는 스케줄 변수를 넣지 않는다. 코드 배포 후 설정 변경은 파일 편집·Collector 재시작만 필요하나, 다른 DB 정책 적용에는 아래 owner 절차가 필요하다.

## DB 정책과 읽기 전용 진단

`schedule-upgrade`는 history v4에서 별도 `atlas_scheduler`를 설치한다. 기존 migration bytes·예약·예산·권한·관측값은 유지하고 history v4의 guard 추가 fingerprint만 갱신하며 원 hash를 보존한다. Web Reader에게 새 스키마 권한을 주지 않는다. 기존 Reader의 v4 검사와 호환된다. 스키마 변경은 명시 owner 명령만 수행하며 runtime/doctor/status는 DDL을 수행하지 않는다.

초기 활성 정책은 legacy5m/288이다.1h/24로의 전환은 **다음 UTC 날짜 이후** 정책 추기다. 과거54회/288예산이나 UNCONFIRMED를 정리할 필요가 없다. 당일 변경·기존 예산 축소/확대·예약 초기화는 제공하지 않는다. worker가405 lock을 보유하거나 Arkham CLAIMED가 남으면 owner 변경을 거절한다. 적용일 이후 미리 생성된 day·같은/뒤 날짜의 충돌 정책도 거절한다. 오류 시 파일/정책을 자동 수정하지 않는다.

status는 외부 공급자 호출·예약·파일 생성 없이 다음 JSON을 반환한다. 정책 불일치는 진단 결과 `MISMATCH`로 반환하며 run은 오류로 종료한다.

- `runtime`: 주기·일일 예약 상한·하루 슬롯 수·슬롯당7GET·예약 기준 일일 GET 최대치.
- `databaseNow`, `activePolicy`, `futurePolicies`: DB 기준 시각과 저장 정책.
- `dayBudget`: 오늘 기존 예산/사용 예약 수. 없는 날짜는null이며 만들지 않는다.
- `latestStoredSlot`: 마지막 DB STORED 슬롯. 공급자 개별 성공 판정은 아니다.
- `pending`, `currentSlot`, `currentJobState`: 미완료 예약과 현재 슬롯 상태. 서비스 실행 여부를 뜻하지 않는다.
- `nextScheduledSlot`: 예산이 남았을 때 다음 경계, 소진 시 다음 UTC00:00. 실행 보장이 아니며 미래 정책 변경으로 다음 tick이 거절될 수 있다. 재시작은 아직 예약하지 않은 현재 슬롯부터 가능하다.
- `providerSuccess=NOT_OBSERVED_BY_STATUS`: 개별 공급자 응답 성공과 상태 조회를 구분한다. 기존 `runs` 목록도 유지한다.

10:00 성공→10:30 종료→13:20 재시작이면13:00 슬롯만 새로 검토한다.11:00/12:00은 생성하지 않는다. 기존 CLAIMED의 Receipt 기반 import-only 복구는 이 누락 슬롯 처리와 다르다. 구버전 writer는 새 INSERT 표식이 없어 거절된다. 표식은 권한 증명이 아니며 DB 정책·유일키·기존 원장 한도가 실제 통제다.

## Mac mini 전환 명령 — 운영자 별도 승인 후

아래는 준비된 절차이며 이 개발 작업에서 실행하지 않았다. 실제 운영 DB 변경·자동 수집 활성화는 사용자 별도 승인 대상이다. 현재 비활성 Arkham만 대상으로 하며 **Web activate·FX/등록 서비스 stop/install·timer 변경을 실행하지 않는다.** 서버에 이미 이전한 receipts/archive/market-store/fx-store1051개는 덮어쓰거나 다시 import하지 않는다. 원본 hash·관측시각을 유지한다.

1. 최종 보고의40자리 SHA로 stage한다. 기존 동일 SHA를 덮어쓰지 않는다.

```sh
SHA=<최종-보고의-40자리-SHA>
sudo /usr/local/sbin/atlas-release stage "$SHA"
RELEASE=/opt/stablecoin-atlas/releases/$SHA
sudo readlink /opt/stablecoin-atlas/collector-current
sudo systemctl is-active atlas-collector.service
```

기존 collector 포인터/상태를 비공개 운영 기록에 보존한다. 다른 호스트의 Arkham worker/legacy market-watch도 정지해 있어야 한다. 활성 worker를 발견하면 별도 승인 없이 다음 단계로 넘어가지 않는다.

2. 첫 설치에만 schedule 예제를 복사한다. 기존 파일이 있으면 test가 실패하며 덮어쓰지 말고 `sudoedit`로 검토한다. 두 변수 모두 명시한다.

```sh
sudo test ! -e /etc/atlas-collector/schedule.env
# 바로 위 test가 성공한 경우에만:
sudo install -m 0644 -o root -g root "$RELEASE/deploy/atlas-collector.schedule.env" /etc/atlas-collector/schedule.env
sudo -u atlascollector /usr/bin/node "$RELEASE/tools/collector-deploy.mjs" check --kind arkham --env-file /etc/atlas-collector/writer.env --schedule-file /etc/atlas-collector/schedule.env --state-root /var/lib/atlas-collector
sudo -u atlascollector /usr/bin/node "$RELEASE/tools/collector-worker.mjs" status --env-file /etc/atlas-collector/writer.env --schedule-file /etc/atlas-collector/schedule.env
```

doctor READY는 로컬 구성만 뜻한다. 최초 status는 `UPGRADE_REQUIRED`, 전환 전에는 `MISMATCH`가 정상 진단이다. 출력의DB UTC 날짜를 확인하고 다음 적용일을 정한다. 현재 날짜 예산/과거 UNCONFIRMED는 수정하지 않는다. 상속된 ARKHAM_*가 있으면 파일보다 우선하므로 수동 실행에서 해당 환경을 제거하거나 CLI로 명시하고 `runtime`을 대조한다.

3. **운영 DB 변경 승인 후에만** 관리자 파일을 기존 안전 경로로 지정하고 명령을 실행한다. 관리자 파일을 서비스 EnvironmentFile/인자로 된 URL로 전달하지 않는다. 예시 날짜는 실제 DB 현재 UTC 날짜보다 뒤로 바꾼다. 기존 history v4에는 continuous/normalize를 재실행하지 않는다.

```sh
ADMIN_ENV=<기존-관리자-env의-비공개-절대경로>
EFFECTIVE_DAY=<DB-현재-UTC-날짜보다-뒤인-YYYY-MM-DD>
/usr/bin/node "$RELEASE/tools/market-db/history-cli.mjs" schedule-upgrade --env-file "$ADMIN_ENV"
/usr/bin/node "$RELEASE/tools/market-db/history-cli.mjs" schedule-policy --env-file "$ADMIN_ENV" --effective-day "$EFFECTIVE_DAY" --interval 1h --daily-run-limit 24
```

해당 파일을 읽을 수 있는 기존 관리자 계정으로 실행한다. schema owner 검증·원 hash 검증·새 hash pin·DDL/권한은 한 transaction이다. 미완료 CLAIMED가 있으면 원 Receipt/Archive로 기존 복구 절차부터 완료한다. claim을 지워 해결하지 않는다. 정책은 미래일에만 추가되므로 오늘1h runtime은 MATCH가 되지 않는다. **적용일 UTC00:00 이후까지 Arkham을 비활성 상태로 유지한다.** KST 기준은09:00이다.

4. 비활성 Arkham unit/drop-in만 설치하고 collector 포인터만 바꾼다. 기존 `.collector-next`가 있으면 조사하며 덮어쓰지 않는다. FX·등록 unit은 같은 collector 포인터를 참조하므로 변경 코드의 회귀 검증을 전제로 하고, 그 서비스의 재시작/수집 정책은 바꾸지 않는다.

```sh
sudo install -m 0644 "$RELEASE/deploy/atlas-collector.service" /etc/systemd/system/atlas-collector.service
sudo install -d /etc/systemd/system/atlas-collector.service.d
sudo install -m 0644 "$RELEASE/deploy/atlas-collector.service.d/production.conf" /etc/systemd/system/atlas-collector.service.d/production.conf
sudo systemctl daemon-reload
sudo systemd-analyze verify /etc/systemd/system/atlas-collector.service
sudo ln -s "$RELEASE" /opt/stablecoin-atlas/.collector-next
sudo mv -T /opt/stablecoin-atlas/.collector-next /opt/stablecoin-atlas/collector-current
sudo systemctl show atlas-collector.service -p User -p Group -p EnvironmentFiles -p WorkingDirectory -p MemoryHigh -p MemoryMax -p CPUQuotaPerSecUSec -p Restart -p TimeoutStopUSec
```

5. 적용일 이후, 링크/실제 경로로 동일 설정을 진단한다. `runtime=1h/24`, `activePolicy=3600000/24`, `policyState=MATCH`, 현재 day budget이null 또는24인지 확인한다. 조회 시각은 서로 다를 수 있다. 두 명령은 예약/공급자 호출0이다.

```sh
sudo -u atlascollector /usr/bin/node "$RELEASE/tools/collector-deploy.mjs" check --kind arkham --env-file /etc/atlas-collector/writer.env --schedule-file /etc/atlas-collector/schedule.env --state-root /var/lib/atlas-collector
sudo -u atlascollector /usr/bin/node /opt/stablecoin-atlas/collector-current/tools/collector-worker.mjs status --env-file /etc/atlas-collector/writer.env --schedule-file /etc/atlas-collector/schedule.env
sudo -u atlascollector /usr/bin/node "$RELEASE/tools/collector-worker.mjs" status --env-file /etc/atlas-collector/writer.env --schedule-file /etc/atlas-collector/schedule.env
```

6. **자동 수집 활성화 승인 후에만** Arkham을 시작한다. 이 명령은 현재 슬롯의 실제 외부 호출을 일으킬 수 있다. 기존 Web/FX/등록 서비스는 건드리지 않는다.

```sh
sudo systemctl enable --now atlas-collector.service
sudo systemctl status atlas-collector.service --no-pager
sudo -u atlascollector /usr/bin/node /opt/stablecoin-atlas/collector-current/tools/collector-worker.mjs status --env-file /etc/atlas-collector/writer.env --schedule-file /etc/atlas-collector/schedule.env
```

실제 신규 STORED·다음 예정 슬롯·기존 마지막 정상 데이터와 private Receipt/Archive hash를 대조한다. 상태 조회 성공만으로 실제 공급자7응답 성공·서버 부팅 복구까지 검증했다고 표시하지 않는다. journal/환경 파일 원문에는 접속정보가 있을 수 있으므로 공유하지 않는다.

## 이후 변경과 롤백

정책 변경 시 Arkham만 정상 정지→CLAIMED 복구 완료→미래 UTC일 정책 추기→schedule.env 두 값 편집→적용일 이후 doctor/status MATCH 확인→승인된 재시작 순서다. code push/redeploy는 필요 없다. 하루 중간에는 기존 예산을 축소하지 않는다. 설정만 바꾸어 불일치하면 실패하고, 서비스 재시작도 예산을 초기화하지 않는다.

스키마 설치 전이면 기존 SHA/config로 복귀할 수 있다. 설치 후에는 **구 SHA로 포인터만 되돌려도 구 writer의 예약 INSERT가 차단된다.** 스키마/trigger 삭제·fingerprint 수동 복구·원장/claim 삭제를 하지 않는다. 새 정책 스키마와 호환되는 검증된 코드와 현재 DB 정책에 맞는 설정으로 복귀하거나, 더 뒤 UTC 날짜의 보상 정책을 추가한다. 당일 예산 변경은 없다. 아직 적용 전인 잘못된 미래 정책도 취소/수정하지 않으므로, 그 날짜에는 수집기를 정지하고 이후 보상 정책부터 재개한다. Receipt import-only 복구는 호환 코드에서 원 식별자로 수행한다. Web 롤백은 이번 절차에 포함하지 않는다.
