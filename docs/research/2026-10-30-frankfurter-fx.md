# Frankfurter FX 준비 및 승인된 단발 수집 실패

후속 상태: 기존 실패를 보존한 [추가 승인 조회·실제 DB/웹 반영 완료](2026-10-30-frankfurter-live-completion.md). 아래는 최초 준비/실패 시점의 기록이다.

사용자가 키 없는 일별 USD/KRW 대안을 조사하도록 요청했다. 공식 문서로 다음을 비교했다.

| 후보 | 조사 결과 |
|---|---|
| [Frankfurter](https://frankfurter.dev/) | 키 불필요·일별·무료·DB 저장/캐시 허용. 기본 혼합 참고환율이며 KRW 지원 |
| [ExchangeRate-API Open](https://www.exchangerate-api.com/docs/free) | 키 불필요·일별·출처 링크 필요. [약관](https://www.exchangerate-api.com/terms)의 programmatic 환율 재배포 제한 때문에 현재 JSON API 구조에 바로 채택하지 않음 |
| [Fawaz Exchange API](https://github.com/fawazahmed0/exchange-api) | 무료/일별 CDN JSON. 공식 README의 원천 환율 출처 설명은 추가 확인 필요 |

Frankfurter의 [라이선스 설명](https://frankfurter.dev/license/)은 기본 혼합환율이 기관의 공식 환율이 아니며 지연/누락/수정될 수 있음을 구분한다. 이 의미를 출처 표시와 저장 형식에 반영했다. 문서 확인을 실제 API 수집 성공으로 취급하지 않았다.

## 승인과 구현

최대1GET/64KiB/20초/재시도0 표본 확인 뒤 DB·웹 반영, 운영 자동수집 활성화 제외를 제안했고 사용자가 `그렇게 해`로 승인했다. [ADR0122](../adr/0122-frankfurter-daily-fx.md)의 별도 공급자 root/별도 private 스키마/직접 USD→KRW schemaVersion2를 준비했다. 기존 ECB DDL/자료/미확정 claim은 변경하지 않는다.

JSON 숫자를 Number로 계산하지 않도록 기존 엄격한 numeric lexeme/중복 키 parser를 재사용했다. 소스의 rate는 십진 문자열, 환산은 bigint다. 원문/hash/제공일자/원수집시각을 검증하고 웹은 projection만 읽는다. 수집 성공과 검증 실패를 구분하며 원문을 받은 오류는 bounded archive, 본문이 없는 연결 실패는 코드만 보존한다. 정상 자료 부재 시 자동 ECB fallback은 없다. UI에 Frankfurter 일별 참고환율/기준일을 표시하도록 변경했다.

새 private `atlas_fx_frankfurter`의 DDL은 소유 PG17에서 구조 hash를 pin했다. 실제 역할/RLS/API경계·동시중복/충돌·rollback·미래/만료/손상·십진 문자열·HTTP200/503을 검증했다. 이 시험의 환율과 날짜는 가상이며 실제 환율 자료가 아니다. 기존 ECB 모듈의 회귀 검사도 수행했다.

## 검토 도구 장애

Lead 요청8ff2246a7a484b8d946cee4676229874는 delivered 뒤 응답하지 않았다. 45초 파일 대기 후 사설 구현/시험을 진행했고, Herdr skill에 따라 현재 환경을 확인한 뒤 기존 router-lead를 읽었다. idle 상태의 기존 pane w9:p2에 `Selected model is at capacity. Please try a different model.`가 있었다. 모델/인증 변경·새 Agent·재전송 없이 요청을 사유와 함께 cancelled로 보존했다. Lead 응답/승인은 없다. 이전 검증된 FX 패턴의 직접 검토와 소유 PG17 시험으로 보완했으며 실제 DB/운영 변경은 수행하지 않았다. 기존 pane은 유지했다.

## 실제 단발 결과

`node --use-env-proxy .state/frankfurter-fx-20261030/collect.mjs` rc1/STOPPED. Node25.2.1과 기존 관리형 proxy/NO_PROXY/TLS 검증을 그대로 사용했다.

- 고정 `https://api.frankfurter.dev/v2/rate/usd/krw` 연결 시도1, 정상HTTP응답0·본문수신0, `UND_ERR_CONNECT_TIMEOUT`. 유효 raw/projection은 확보하지 못했다. 다른 도구/브라우저/endpoint/프록시·TLS 전환과 재시도는0이다.
- 전용 UTC2026-10-30 claim과 사설 실패 receipt를 보존한다. 성공 receipt/snapshot은 없다. 코드 보완 후의 실패 저장 기능을 확인하기 위해 실제 요청을 다시 실행하지 않았다.
- 기존 ECB snapshot/XML의 hash·원시각과 ECB 당일 미확정 claim hash가 실행 전후 같다. 실제 새 공급자 root는 승인된 신규 공급자용이며 이전 소비의 재시도가 아니다.
- ECB와 같은 연결 오류지만 구체 실패 지점/네트워크 원인은 UNKNOWN이다. HTTP/proxy 거절 응답이 없어 정책 차단으로 단정하지 않는다.
- 유효 표본이 없어 실제 Supabase init/grant/import/접근과 운영 배포·timer 활성화는0이다. 새 스키마와 유효 자료의 실제 적용은 미완료이며 사설 시험 결과로 대체하지 않는다. 현재4173의 기존 웹 프로세스를 재시작하지 않았고 기존 만료 환율 상태를 보존했다.

승인/시도/실패 상세는 Git 제외 `.state/frankfurter-fx-20261030`, 소비 claim은 `.state/frankfurter-fx-store`에 보존한다. 기존 실패 기록은 `.state/fx-refresh-20261030`에 그대로 둔다. 원문·연결정보·관리형 proxy 값은 Git/웹에 기록하지 않는다. 실제 새 브라우저 렌더링은 미실행이다.

## 검증과 재현

`node --use-env-proxy --import tsx --test tests/frankfurter-fx.test.mjs tests/fx-db.test.mjs tests/production.test.mjs web/fx-model.test.mjs`: rc0/18pass/0fail.

`node --test --test-concurrency=1 tests/postgres/frankfurter-fx.test.mjs tests/postgres/fx.test.mjs`: rc0/2pass/0fail.

최종 `npm run check`: rc0/734+74=808pass/0fail/cancelled0/skipped0. 앞선 검사도 rc0/733+74=807pass였고, 이후 실패 보존/선택 출처 거절 검사를 보완해 최종 전체 검사를 다시 실행했다. `git diff --check`: rc0.

최종 PG 회귀 `node --test --test-concurrency=1 tests/postgres/frankfurter-fx.test.mjs tests/postgres/fx.test.mjs tests/postgres/production.test.mjs`: rc0/3pass/0fail. `python3 -m unittest discover -s tools/intelligent-router/evaluation -p 'test_*.py'`: rc0/56pass/0fail. 시험 로그는 `.state/agent-logs/frankfurter-*`에 보존한다.

향후 이미 승인된 유효 자료를 준비한 뒤 수동 CLI 경로는 다음과 같다. 아래 collect는 외부 요청이므로 이번 소비된 실행을 재사용하지 않는다. 실제 재조회 전 새 계획/승인을 확인한다. 최초 init/grant는 검증된 기존 admin/역할과 기존 definer 검토본/hash를 사용한다. 스케줄은 설치하지 않는다.

```sh
npm run fx:frankfurter -- collect --directory .state/frankfurter-fx-store
npm run fx:frankfurter -- init --env-file <admin.env> --reviewed-definers <검토본> --reviewed-sha256 <hash>
npm run fx:frankfurter -- grant --role <기존-role> --mode <writer-or-reader> --env-file <admin.env> --reviewed-definers <검토본> --reviewed-sha256 <hash>
npm run fx:frankfurter -- import --directory .state/frankfurter-fx-store --env-file <writer.env> --reviewed-definers <검토본> --reviewed-sha256 <hash>
npm run fx:frankfurter -- read --env-file <reader.env>
```

개발 DB/production/preflight 코드의 기본 reader는 Frankfurter다. 새 스키마/유효 자료가 없으면503이며 ECB로 대체하지 않는다. 따라서 현재 push할 코드는 공급자 연결 준비 상태이고 실제 운영 적용/최신 환율 표시 완료가 아니다. 기본 JSON 모드는 과거 오프라인 ECB 자료 읽기를 유지한다.
