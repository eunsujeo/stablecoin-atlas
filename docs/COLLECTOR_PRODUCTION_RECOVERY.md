# Mac mini 수집기 준비와 FX 복구

2026-10-30 변경: 새 웹 코드의 FX는 [ADR0121](adr/0121-shared-fx-database.md)의 공통 Supabase reader를 사용한다. 아래 공개 파일 게시 절차는 이전 파일 기반 버전의 복구 기록이다. 새 코드에서는 파일 게시만으로 웹 환율이 갱신되지 않으며 검토한 writer로 `fx:db import`가 필요하다. 기존 원문/claim 복구와 실제 운영 적용은 분리한다.

2026-10-30: 신규 설치와 배포 자동화의 정본은 [자동 CI/CD와 최초 bootstrap](AUTOMATED_DEPLOYMENT.md)이다. 아래 수동 설치·부분 helper 복사·Git/npm stage 명령은 이전 운영 기록이다. 새 bootstrap 이후에는 고정 제어면과 CI artifact 기반 `atlas-release`를 사용하며, 기존 부분 helper 설치 명령을 재실행하지 않는다. 기존 수집 계약·보존 데이터·설정은 유지한다.

Arkham의 현재 기본 주기는1h/24예약이다. 새 schedule.env·별도 정책 설치·미래 UTC일 전환·Arkham만의 포인터/설정/호환 코드 롤백은 [스케줄 운영 정본](ARKHAM_SCHEDULER.md)을 먼저 따른다. 아래 기존 복구 절차의 FX/등록 unit 재설치·전체 서비스 정지는 이번 Arkham 설정 전환에 적용하지 않는다. Web/FX/등록 서비스는 유지한다.

이 절차는 운영자가 서버에서 적용할 인계 지침이다. 이번 구현 작업은 로컬 수정·시험·Git push만 수행하며, 서버 접속·DB 변경·공급자 호출·서비스 활성화는 하지 않는다. 사용자가 보고한 웹/Reader/Tunnel 정상과 FX503·공개 파일0바이트는 사용자 관측이다. 여기서 직접 재관측한 결과가 아니다. [배포 정본](PRODUCTION_DEPLOYMENT.md)과 [기존 수집 계약](COLLECTOR_SERVICE.md)을 함께 따른다.

## 1. 수집하지 않는 준비

`SHA`는 이번 수정이 포함된 검증된40자리 commit, `SELECTION`은 기존 검토된64자리 소문자 selection hash로 설정한다. 비밀값은 shell 인자에 넣지 않는다. `atlas-release stage`는 Git/npm 설치 네트워크를 사용하지만 공급자 데이터 수집과 DB 변경은 하지 않는다. 이미 stage된 SHA는 덮어쓰지 않는다.

```sh
SHA=<검증된-40자리-SHA>
SELECTION=<기존-64자리-selection>
sudo /usr/local/sbin/atlas-release stage "$SHA"
RELEASE=/opt/stablecoin-atlas/releases/$SHA
uname -m
getconf PAGE_SIZE
/usr/bin/node --version
/usr/bin/node -p 'process.platform + "/" + process.arch'
id atlasweb
id atlascollector
sudo namei -l "$RELEASE/tools/collector-worker.mjs" /etc/atlas-collector/writer.env /etc/atlas-collector/registered-writer.env
```

aarch64·Node24.5 이상·proxy flag 지원·root 관리0755 release와 서비스 사용자의 읽기/탐색 접근을 확인한다. 수집 unit은 atlascollector, 웹은 atlasweb다. production drop-in의 WorkingDirectory는 `/opt/stablecoin-atlas/collector-current`로 base의 `/opt/multi-chain-asset-compatibility`를 대체한다. 세 unit 모두 같은 collector 포인터를 사용한다. `/usr/bin/env node`의 PATH 선택과 FX 게시의 `/usr/bin/node`가 같은 지원 버전인지 확인한다. root 관리 코드와 의존성은 서비스 계정이 쓸 수 없어야 한다. 홈의 Node 설치에 의존하지 않는다.

기존 서비스 계정/디렉터리는 재생성하지 않는다. 필요한 비공개 디렉터리만 준비하고 기존 파일은 지우지 않는다.

```sh
sudo install -d -m 0700 -o atlascollector -g atlascollector /etc/atlas-collector /var/lib/atlas-collector /var/lib/atlas-collector/receipts /var/lib/atlas-collector/archive /var/lib/atlas-collector/market-store
sudo install -d -m 2750 -o atlascollector -g atlasweb /var/lib/atlas-public
sudo -u atlasweb test ! -r /etc/atlas-collector/writer.env
sudo -u atlasweb test ! -r /etc/atlas-collector/registered-writer.env
sudo -u atlasweb test ! -r /var/lib/atlas-collector/archive
```

마지막 세 명령은 파일/디렉터리가 **존재하는 것을 먼저 확인한 뒤** 수행한다. 성공은 웹 계정이 읽을 수 없음을 뜻한다. writer 두 파일은 atlascollector 소유0600, 상위 디렉터리0700이다. CA만 root 소유0644로 분리한다. writer는 LoadCredential로 옮기지 않으며 기존 env-file 읽기 정책을 유지한다. Web unit/reader 파일에 writer·공급자 키를 넣지 않는다. 환경 파일 내용이나 URI를 출력하지 않는다.

기존 DB에 연결했던 수집기가 있다면 모든 호스트의 해당 worker와 legacy `market:watch`를 정상 정지한 뒤 receipts·archive·market-store를 한 묶음으로 이관한다. 원래 hash·파일명·시각과 미완료 예약을 보존한다. 비어 있는 archive로 기존 DB 수집을 시작하지 않는다. 로컬 파일과 DB 상태의 일관성이 불명확하면 활성화하지 않는다. 상세 복구는 수집 정본을 따른다. FX 복구 자체는 migration·grant·continuous·예약 초기화를 요구하지 않는다. 새 Arkham 스케줄 전환에는 별도 정본의 owner migration을 따른다.

```sh
sudo -u atlascollector /usr/bin/node "$RELEASE/tools/collector-deploy.mjs" check --kind arkham --env-file /etc/atlas-collector/writer.env --schedule-file /etc/atlas-collector/schedule.env --state-root /var/lib/atlas-collector
sudo -u atlascollector /usr/bin/node "$RELEASE/tools/collector-deploy.mjs" check --kind registered --selection "$SELECTION" --env-file /etc/atlas-collector/registered-writer.env --state-root /var/lib/atlas-collector
```

doctor는 DB/HTTP/파일 생성0의 로컬 검사다. 실제 DB 상태 확인은 별도 운영자 승인 후 기존 `collector-worker.mjs status`와 `registered-collector.mjs status --selection ...`에 각각의 `--env-file`을 전달한다. 두 명령은 조회만 하며 수집을 실행하지 않는다. session/direct 연결을 사용한다. transaction pooler는 지원하지 않는다. 동일 DB의 worker 잠금405(Arkham)·407(등록 일별)은 호스트/selection이 달라도 같은 종류의 두 번째 실행을 거부한다. 서로 다른 두 종류는 의도한 구성이다. 잠금 보유는 건강 보장이 아니며, status 한 번으로 미래 중복 실행 부재를 보장하지 않는다.

## 2. 기존 FX 저장본의 오프라인 복구

초기 설치의0바이트 `fx.json`은 정상 데이터가 아니다. `{}`·임의 환율·0을 넣거나 shell redirect로 파일을 미리 생성하지 않는다. 공개 파일이 없거나 손상/만료되면 API는 고정 `FX_UNAVAILABLE` 503을 반환한다. 생존 health는 이 상태에서도200일 수 있다.

기존 `.state/fx-store`가 있는 호스트에서 아래 check를 먼저 실행한다. 네트워크·claim·파일 생성이 없으며 snapshot을 원본 XML/hash와 대조하고 실제 기준일/7일 유효기간을 검사한다. `fetchedAt`/`importedAt`은 저장된 값을 그대로 출력한다.

```sh
node tools/fx-store.mjs check --directory .state/fx-store
```

| 코드 | 조치 |
|---|---|
| `FX_STORE_MISSING` | 저장소가 없음. 이전 정상 전체 저장본 확보 또는 별도 ECB 호출 승인 필요 |
| `FX_STORE_EMPTY` | snapshot 없음. claim/receipt를 보존하고 미완료 실행부터 조사 |
| `FX_STORE_EXPIRED` | 검증본이7일 초과. 원래 날짜를 유지하고 새 관측으로 둔갑시키지 않음 |
| `FX_STORE_INVALID` | 경로/권한·빈 파일·JSON·archive 손상/누락 등. 원본 보존 후 원인 확인 |
| `READY` | 현재 사용 가능한 저장본. 서버 계정으로 다시 확인 후 게시 가능 |

수집이 정지된 상태의 **전체 fx-store**(claims/receipts/snapshots/archive)를 비공개 전송한다. XML만 `fx:import`하면 새 import 시각/당일 claim이 만들어지므로 기존 저장본 이전에 사용하지 않는다. 아래 `FX_BACKUP`은 운영자가 별도 확보한 전체 트리다. symlink 없는 정상 저장본을 사용하고 기존 서버 트리가 있으면 덮어쓰거나 합치지 말고 먼저 복구 상태를 조사한다.

```sh
FX_BACKUP=<비공개로-전달한-전체-fx-store-경로>
sudo test ! -e /var/lib/atlas-collector/fx-store
# 위 검사가 성공했을 때만 복사. 기존 트리/claim은 삭제하지 않는다.
sudo cp -a -- "$FX_BACKUP" /var/lib/atlas-collector/fx-store
sudo chown -R atlascollector:atlascollector /var/lib/atlas-collector/fx-store
sudo find /var/lib/atlas-collector/fx-store -type d -exec chmod 0700 {} +
sudo find /var/lib/atlas-collector/fx-store -type f -exec chmod 0600 {} +
sudo -u atlascollector /usr/bin/node "$RELEASE/tools/fx-store.mjs" check --directory /var/lib/atlas-collector/fx-store
# READY일 때만 실행: ECB/DB 호출 없이 검증된 projection만 게시한다.
sudo -u atlascollector /usr/bin/node "$RELEASE/tools/publish-production-fx.mjs" /var/lib/atlas-collector/fx-store /var/lib/atlas-public/fx.json
sudo stat -c '%U %G %a %s' /var/lib/atlas-public/fx.json
sudo -u atlasweb test -r /var/lib/atlas-public/fx.json
curl --fail -H 'Host: atlas.whatto.me' http://127.0.0.1:4173/fx-data.json
```

공개 디렉터리의 setgid2750으로 새 파일이 atlasweb 그룹을 상속하며 파일은0640이다. 기존 `fx.json` 소유권을 신뢰하지 않고 게시 시 새 파일로 교체한다. 웹 재시작 없이 다음 읽기부터 반영된다. 게시기는 임시 파일에 검증 projection을 쓰고 fsync→rename→부모 fsync한다. 검증/rename 이전 실패는 이전 공개 파일 바이트를 보존한다. `PUBLIC_FX_DURABILITY_UNCONFIRMED`는 rename 후 부모 sync 실패로, 파일은 교체됐으나 전원 손실 내구성은 미확인이다. 이 경우 이전 파일 보존이라고 보고하지 않는다. 정상본이 만료되면 보관 파일을 지우지는 않되 환산에는 사용하지 않는다.

정상 저장본이 없다면 여기서 복구를 중단한다. **별도 사용자 승인 전에는 다음 collect나 timer 활성화를 실행하지 않는다.** 승인 후 최초 단발은 기존 코드를 그대로 사용한다.

```sh
sudo -u atlascollector /usr/bin/node --use-env-proxy "$RELEASE/tools/fx-store.mjs" collect --directory /var/lib/atlas-collector/fx-store
# 성공 후 위 check와 publish를 실행한다.
```

ECB는 기존 UTC일 claim·최대1GET/64KiB/20초·redirect/retry0을 유지한다. 같은 날 미완료 claim을 지워 재요청하지 않는다. 실패하면 이전 정상 공개본/실제 기준일을 유지한다. 다음 날짜 관측은 기존 timer 정책을 따른다. FX의 claim은 이관된 한 저장소 기준이며 다중 호스트 전역 잠금이 아니다. FX도 한 호스트에서만 활성화한다.

## 3. unit 설치·별도 collector SHA와 롤백

정확 SHA의 파일을 설치한다. 설치/verify는 활성화와 구분한다.

```sh
sudo install -m 0644 "$RELEASE"/deploy/atlas-collector.service "$RELEASE"/deploy/atlas-registered-collector@.service "$RELEASE"/deploy/atlas-fx.service "$RELEASE"/deploy/atlas-fx.timer /etc/systemd/system/
sudo install -d /etc/systemd/system/atlas-collector.service.d /etc/systemd/system/atlas-registered-collector@.service.d /etc/systemd/system/atlas-fx.service.d
sudo install -m 0644 "$RELEASE/deploy/atlas-collector.service.d/production.conf" /etc/systemd/system/atlas-collector.service.d/
sudo install -m 0644 "$RELEASE/deploy/atlas-registered-collector@.service.d/production.conf" /etc/systemd/system/atlas-registered-collector@.service.d/
sudo install -m 0644 "$RELEASE/deploy/atlas-fx.service.d/production.conf" /etc/systemd/system/atlas-fx.service.d/
sudo systemctl daemon-reload
sudo systemd-analyze verify /etc/systemd/system/atlas-collector.service /etc/systemd/system/atlas-registered-collector@.service /etc/systemd/system/atlas-fx.service /etc/systemd/system/atlas-fx.timer
sudo systemctl show atlas-collector.service atlas-registered-collector@"$SELECTION".service atlas-fx.service -p User -p Group -p WorkingDirectory -p ReadWritePaths -p StateDirectory -p UMask
```

ReadWritePaths는 collector 영속 경로에 더해 FX에만 공개 경로를 허용한다. FX unit에 DB 환경을 전달하지 않는다. 실제 mount/ACL·SELinux 거절은 서버에서 확인한다.

기존 worker/FX timer를 모두 정지하고 실행 종료를 확인한 뒤 collector 포인터를 전환한다. 아래는 운영 예시이며 **stop/start를 포함한 운영 변경과 외부 수집은 별도 사용자 승인 후에만** 실행한다. 로컬/다른 호스트 worker 정지·상태 이관도 먼저 완료한다.

```sh
sudo systemctl stop atlas-fx.timer atlas-fx.service atlas-collector.service atlas-registered-collector@"$SELECTION".service
sudo systemctl is-active atlas-fx.service atlas-collector.service atlas-registered-collector@"$SELECTION".service
# inactive/failed와 실제 종료를 확인. 기존 collector-current의 옛 SHA를 운영 기록에 보존.
sudo readlink /opt/stablecoin-atlas/collector-current
# 운영자가 동시 작업 부재를 확인. 기존 .collector-next는 덮어쓰지 않고 조사.
sudo ln -s "$RELEASE" /opt/stablecoin-atlas/.collector-next
sudo mv -T /opt/stablecoin-atlas/.collector-next /opt/stablecoin-atlas/collector-current
# 준비·DB/receipt 복구·다른 호스트 정지·외부 호출 승인 완료 후에만:
sudo systemctl enable --now atlas-collector.service atlas-registered-collector@"$SELECTION".service atlas-fx.timer
sudo systemctl list-timers atlas-fx.timer
```

최초 설치는 옛 포인터가 없어 readlink가 실패한다. 그 사실을 기록하고 기존 포인터를 무조건 삭제하지 않는다. 등록 서비스는 selection 하나만 시작한다. timer의 `Persistent=true`는 예정 시각이 지난 최초 활성화에 즉시 ECB 요청을 일으킬 수 있어 timer 활성화도 수집 승인 대상이다. FX는 UTC00:10, Arkham은 기본1시간/하루24예약/최대168GET, 등록은 하루5GET을 유지한다.

Arkham은 스케줄 정본의 DB 정책 호환 조건을 먼저 만족해야 한다. collector 롤백은 같은 stop/종료 확인→doctor를 통과한 옛 release로 같은 원자적 포인터 전환→같은 서비스 재개 순서다. DB/receipt/archive/market-store/fx-store/claim은 되돌리지 않으며 옛 코드와 호환성을 확인한다. 최초 실패는 정지 상태에서 원인을 조사하고 존재하지 않는 옛 버전으로 돌리지 않는다. `.writer-lock`를 자동 삭제하지 않는다.

Web 갱신은 `sudo /usr/local/sbin/atlas-release activate "$SHA"`, Web 롤백은 `sudo /usr/local/sbin/atlas-release rollback previous`이며 collector-current·timer는 바꾸지 않는다. collector 포인터 전환은 Web current를 바꾸지 않는다. Web 변경 후 health SHA와6API를 확인하고 FX만503이면 다른 정상 자료·USD 표시·FX 안내를 확인한다.

## 실제 서버 검증 항목

- `collector-current` 경유 CLI와 실제 경로의 출력·종료 코드 일치. 기존 SHA의 무출력 종료 문제와 로컬 수정 검증은 [진입점 수정 기록](research/2026-10-25-collector-symlink-entrypoint.md)을 따른다. 운영 DB status 확인도 기존 별도 승인 경계를 유지한다.
- Fedora aarch64/Node·unit merge/verify·실제 UID/모드/ACL·SELinux·쓰기 허용·writer 격리.
- 독립 Web/collector SHA, 동일 DB의 다른 호스트 정지와405/407, 미완료 receipt 복구·파일hash/시각.
- FX 실제 저장본 check·공개0640/atlasweb 읽기·6API 응답과 원래 관측시각, Overview USD/KRW/실패 안내.
- 승인 후 timer 실행·부팅/재시작·SIGTERM·전원 장애 복구·같은 영속 경로로 rollback과 private 백업 복원.
- 8GB 환경의 MemoryCurrent/Peak·디스크 용량. journal은 고정 코드를 확인하고 키/접속 문자열을 공유하지 않는다.

이번 Mac의 fixture 시험만으로 이 항목들을 검증 완료로 표시하지 않는다. 실제 시험과 미검증은 [작업 기록](research/2026-10-25-collector-fx-recovery.md)에서 구분한다.
