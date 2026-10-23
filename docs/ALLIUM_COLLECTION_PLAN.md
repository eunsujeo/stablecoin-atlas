# Allium 조사 계획과 단발 실행

[ADR0060](adr/0060-allium-survey-and-collection-plan.md)의 CLI는 기존 등록 자료에서 검토 가능한 SELECT 세 개를 생성한다. 후속 [ADR0061](adr/0061-bounded-allium-survey-executor.md)의 단발 실행기·영속 예약은 구현했으며, 새 수집기·공급량 전환은 아직 없다. 현재 대상은 Ethereum5개, JPYC Polygon/Avalanche/Kaia3개, TRON USDT1개, Solana USDC/USDT2개다. XRPL2개는 매핑 미확인으로 보류한다. 사용자 수동 예외로 실행한 실제 범위는 [11배포 조사 결과](research/allium-samples/survey-2026-10-23.md)를 따른다. OBSERVED는 해당 응답 관측이며 제품 지원 인증이 아니다.

```sh
npm run allium:plan -- plan --day 2026-10-23
```

stdout JSON의 jobs에 registry/supply/volume SQL과 각 해시·예상 최대 행수·sentinel resultLimit가 있다. 직접 파일로 저장할 때 순수 JSON이 필요하면 `node tools/allium-plan-cli.mjs plan --day 2026-10-23`을 사용한다. 날짜는 자동 선택하지 않는다. SQL은 외부로 전송하지 않고 비밀 설정도 읽지 않는다.

별도로 확보한 **동일 SQL**의 원문은 비공개 경로에 보존하고, 검토한 SHA256으로 projection을 확인한다:

```sh
node tools/allium-plan-cli.mjs review --day 2026-10-23 --kind supply \
  --source <private-response.json> --reviewed-sha256 <reviewed-64-hex-sha256>
```

kind는 registry/supply/volume 중 하나다. 원문 형식은 Explorer results의 sql·data·meta.row_count·queried_at이다. 조회 시각은 예약일 이후여야 한다. 현재 등록 자료/계획과 다른 SQL, 누락된 배포, 중복, sentinel 행, 기간 밖 날짜, Number 수량은 오류다. 이 명령은 DB import나 외부 실행 성공을 인증하지 않으며 실제 요청 횟수 영수증을 생성하지 않는다. stdout에는 공개용 선별 필드만 반환하고 원문의 계정 query/run 식별자는 버린다.

일곱 날짜 겹침·지연/수정과 보조 공급자 조건은 ADR0060을 따른다. 실제 실행 경계는 ADR0061과 후속 수동 예외 ADR0065/0066을 따른다. [별도 공급량 저장/조회](ALLIUM_SUPPLY_DATA.md)는 기존 검토 Ethereum 두 자산14행을 유지한다. 실제11배포 조사 결과는 아래 기록을 따르며 전체 공급량 전환·일별 자동 수집은 아직 미완료다.

## 단발 실행 CLI

사용자 승인 예외인 수동 단발 실행과 GET 지수 백오프는 [ADR0065](adr/0065-manual-allium-survey-with-backoff.md)를 따른다. 기존 strict `execute`의 과금 통제 검사는 유지한다. `execute-manual --day D --authorization <private-json> --reviewed-authorization-sha256 <hash> --usage <saved-original-usage> --approval <private-user-approval>`은 별도 수동 authorization을 요구하며 웹·일별 스케줄과 연결하지 않는다. 일별 26HTTP 계획과 수동 조사 재시도 상한은 서로 다른 실행 정책이다.

공급자 SQL echo 차이의 특정 원문 검토와 같은 묶음의 미전송 작업 재개는 [ADR0066](adr/0066-reviewed-sql-echo-and-survey-checkpoints.md)를 따른다. `resume-manual`은 위 수동 인자에 `--sql-review <private-manifest> --reviewed-sql-review-sha256 <hash>`를 추가한다. 새 실행·접수 불명 POST의 재전송·예약 초기화 경로가 아니다.

```sh
npm run allium:execute -- usage
npm run allium:execute -- status --day 2026-10-23
```

`usage`는 `.env.local` 또는 환경변수의 ALLIUM_API_KEY로 공식 조직 사용량 API를 UTC 날짜당1회만 조회한다. 원문은 `.state/allium-executor/usage-D/response-0.json`, 영수증은 같은 경로의 receipt.json에600권한으로 보존한다. 사용량 확인 성공은 과금 한도 확인이 아니다. key/조직 지문·원문·통제 증거·authorization은 비공개로 유지한다.

`execute`는 다음 조건을 모두 확인한 authorization JSON과 별도 검토된 SHA를 요구한다. 모든 수량 필드는 십진 문자열이다. 테스트의 가상 통제 증거는 실제 실행에 사용할 수 없다.

| 필드 | 검토할 내용 |
| --- | --- |
| schemaVersion/kind/reviewStatus | 1 / ALLIUM_REVIEWED_SURVEY_AUTHORIZATION / MANUALLY_REVIEWED |
| planHash/sqlHashes/resultLimits | 같은 날짜 plan의 해시와 kind별 SQL 해시·API 상한 객체 |
| accountKeyHash/accountScopeHash | 키 바이트 SHA256 / 같은 조직을 안정적으로 식별하는 비공개 SHA256; 키 교체로 조직을 바꾸지 않음 |
| usageHash/usageObservedAt | 이 도구의 같은 날짜 usage 원문 SHA256 / receipt의 요청 시각 |
| controlsHash/reviewedAt | 사람이 검토한 실제 공급자 통제 증거 바이트 SHA256 / 검토 시각 |
| periodStart/periodEnd | usage 원문의 allocation_period_start/end와 일치하는 UTC 시각 |
| capPeriodStart/capPeriodEnd | 검토한 공급자 한도의 유효 UTC 구간; 할당기간과 구별 |
| unit/includedUnits/consumedUnits | EXPLORER_UNIT / usage의 explorer_units 두 값; credits를 환산하지 않음 |
| maxRuns/maxHttpRequests | 정수3 / 정수39 |
| maxUnitsPerRun/surveyBudgetUnits/providerRemainingUnits | 검토한 run당 비용 상한 / 조사 전체 예산 / 공급자 강제 잔여 한도. 3×run상한≤잔여≤조사예산, 포함 할당량−소비량≥3×run상한 |
| providerHardCapIncludingInFlight/exclusiveConsumer/overagesDisabled | 세 조건의 실제 근거를 검토했을 때만 true. 문서·키·usage 응답만으로 true를 만들지 않음 |

사용량은 원래 시각부터1시간 동안만 유효하다. 기간당 조사 한 묶음만 예약하므로 다음 날 같은 할당기간의 새 조사도 차단한다. 예산 잔여를 일별로 나누는 정상 수집기는 아직 없다. 상태 디렉터리를 지워 재시도하지 않는다.

```sh
npm run allium:execute -- execute --day D \
  --authorization <private-authorization.json> \
  --reviewed-authorization-sha256 <reviewed-64-hex-sha256> \
  --usage <private-original-usage.json> --controls <private-reviewed-provider-controls>

node tools/allium-execute-cli.mjs review --day D --kind supply \
  --reviewed-sha256 <reviewed-original-response-sha256>
```

status/review는 네트워크나 환경변수 읽기 없이 동작한다. review는 archive 원문을 검증하는 것뿐이며 receipt/예약/DB를 변경하지 않는다. 공개 요약의 observedExplorerUnits는 확보된 원문 비용 문자열, null은 미확보다. 실패·미완료 job은 후속 job을 실행하지 않는다.

2026-10-23 최초 확인은 usage GET1회뿐이었고 strict 실행 조건은 미확보였다. 후속 사용자 승인 수동 예외로 **create3/run3·총17HTTP**를 수행했다. 등록11·공급량70·전송량67개 OBSERVED와 누락을 구분한 [실제 결과](research/allium-samples/survey-2026-10-23.md)를 따른다. 강제 과금 상한은 계속 UNCONFIRMED이며 원문·영수증은 Git/웹에 게시하지 않는다.

후속 사용자 승인 [다중 체인 저장 조사](ALLIUM_SURVEY_DATA.md)는 별도 atlas_survey와 로컬 표를 사용한다. 기존 표본/조회 경로는 유지하며 새 공급자 호출·자동 수집·기본 공급자 전환은 추가하지 않는다.
