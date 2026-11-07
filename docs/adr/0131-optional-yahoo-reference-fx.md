# ADR0131 — Yahoo 참고 환율과 웹 가용성 분리

2026-11-07 사용자 ‘좋아 모두 승인할께 진행해줘’에 따라 Yahoo USD/KRW 수집, 마지막 정상 환율 표시, FX 장애와 웹 배포 분리를 진행한다. 과거 Frankfurter 단발 승인/실패 기록은 재사용하지 않는다.

## 결정

- 환율은 가격을 원화로 환산하는 보조 자료다. 시장/등록/활동 DB, SHA, 자산 hash, reader 권한, TLS 검사는 유지한다. 정확한 `503 FX_UNAVAILABLE`만 웹 health에서 보조 기능 미확보로 보고한다. 잘못된 200 JSON, 다른 오류, 필수 DB 장애는 계속 실패다.
- Yahoo Finance chart의 고정 USD/KRW 요청 하나만 사용한다. `KRW=X` 요청에 실제 응답은 `USDKRW=X`였으며 이 두 정확한 이름만 허용한다. currency KRW와 CURRENCY 유형을 함께 검사한다. 일반 임의 종목 조회 기능을 만들지 않는다.
- 단일 통화쌍이므로 yahoo-finance2 의존성/자동 cookie/crumb 요청을 추가하지 않고 Node fetch를 사용한다. 새 패키지 다운로드0. 비공식 공급 경로이므로 지속 가용성을 보장하지 않는다.
- 하루 최대1GET,64KiB,20초,redirect/retry0. 기본 운영 일정 UTC00:15, Persistent=false. 운영 주기는 승인된 자동 수집 범위이며 첫 설치시 명시 오프라인 게시를 사용한다. 실패한 당일 claim 삭제/재요청0. 웹 요청에서 외부 수집0.
- 원문 numeric token을 십진 문자열로 보존하고 금액 환산은 bigint. 관측시각과 수집시각을 구분하며 미래시각/잘못된 값은 거부한다. 실패 응답은 원문/hash/claim으로 보존한다.
- schemaVersion3/YAHOO_FINANCE를 기존 ECB1/Frankfurter2와 구분한다. 새 DB DDL 없이 별도 사설 archive와 `/var/lib/atlas-public/yahoo-fx.json`을 atomic publish한다. 기존 `fxFile`과 같은 디렉터리의 별도 파일이다. 기존 ECB 공개 파일이나 DB를 덮어쓰지 않는다.
- 웹은 Yahoo 정상 게시본을 우선 사용하고, 없거나 읽을 수 없으면 명시적 마이그레이션 fallback으로 기존 Frankfurter DB 정상 저장본을 읽는다. 출처/날짜는 그대로 표시한다. 이는 과거 무fallback 정책에 대한 이번 사용자 승인의 변경이다.
- 7일 초과는 삭제/무효가 아니라 ‘갱신 지연 · 마지막 정상 환율’ 표시다. 유효 환율이 전혀 없으면 KRW 선택 상태에서도 가격 열을 USD로 명시하고 달러 금액을 표시한다. FX 실패를 시장 자료 전체 오류로 표시하지 않는다.
- 새 서비스는 기존 atlascollector 사용자/atlasweb 그룹으로 기존 공개 디렉터리에 기록한다. 디렉터리 소유권·권한 변경0. 기존 ECB timer 종료는 Yahoo 설치/게시 확인 이후 명시 실행한다. Collector·Usage·DB 서비스 재시작0.

## 운영 한계

고정 Bootstrap의 runtime-probe/web-health도 바뀌므로 일반 웹 Git Push만으로 설치된 Bootstrap 코드를 갱신할 수 없다. 기존 검증된 Bootstrap install/verify/enable 경로로 갱신해야 한다. 현재 SSH는 연결되나 sudo 인증이 필요하다. 비밀번호 저장·NOPASSWD 변경이나 설치 파일 수동 덮어쓰기로 우회하지 않는다.

기존 DB 중심 FX와 달리 Yahoo 수집/게시 상태는 Mac mini에 저장된다. 다른 개발 PC는 기존 reader fallback 또는 명시 `ATLAS_YAHOO_FX_FILE`로 로컬 게시본을 선택할 수 있다. 신규 공통 DB 스키마는 이번에 추가하지 않는다.
