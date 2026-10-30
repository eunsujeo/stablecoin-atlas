# Codex 개발 지침

이 저장소는 독립적인 Multi-Chain Asset Compatibility Lab이다. 기존 Integration Test Kit 코드를 복사하거나 의존하지 않는다. Codex 단독으로 개발하며 하위 에이전트에 위임하지 않는다.

- 사용자 ECB 환율 단발 승인(2026-10-30): 기존 FX root/당일claim을 유지한 최대1GET/64KiB/20초/재시도0/비용UNKNOWN·수집→DB반영→웹확인을 승인했고 실제1송신시도/HTTP응답0·본문수신0/UND_ERR_CONNECT_TIMEOUT으로 실패 종료했다. 해당단발소비와UTC2026-10-30미확정claim을 보존하며 재시도/claim삭제/새root우회/브라우저·endpoint·proxy전환0이다. 새snapshot/receipt·DB쓰기0·기존만료환율/API503을 유지한다. 구체네트워크원인UNKNOWN이며 proxy정책차단으로단정하지 않는다. docs/research/2026-10-30-ecb-fx-refresh-once.md를 따른다.

- 사용자 환율 공통 DB 승인(2026-10-30): PC별 FX 파일 의존 제거 제안에 사용자가 진행을 승인했다. ADR0121의 별도 private atlas_fx/기존 writer INSERT·reader SELECT와 개발 DB·production 공통 reader를 사설 PG17 검증 후 실제 기존 Supabase에 적용했다. 원문 XML/hash·십진 문자열·기준일/원래 시각을 보존해 기존 환율1건/재입력0·기존11schema/74table 구조·자료 지문 보존을 확인했다. 저장 환율은2026-10-22 기준/만료이며 날짜 갱신 없이503을 유지한다. 새 ECB 수집·운영배포·service/timer 변경0이고 기존 파일 게시 hook은 DB 자동갱신 미연결이다. 후속 운영 적용 전 DB import 연결 검증이 필요하다. docs/research/2026-10-30-shared-fx-database.md를 따른다.

- 사용자Allium 화면표시 종료(2026-10-28): 정정한이미지의Arkham/Allium출처선택영역을제거하고전체현황은Arkham활동자료만표시한다. Allium4종저장자료자동요청/패널/fallback을복원하지않는다. 전송금액/전송건수탭과키보드focus표시는유지한다. 기존원문/DB/보존파서/별도읽기API는삭제하지않았으므로API공개종료라고표현하지않는다. Canton은CC공개관측/USDCx별도자산의research-only기록이며새등록/수집이나기존18대상·30일예산확대0이다. docs/research/2026-10-28-arkham-only-overview.md를따른다.

- 사용자자동수집 초기30일예산 추가승인(2026-10-28): 직전제시한2026-10-29포함~11-28제외 UTC/하루18GET·총540GET/총1080MiB/비용UNKNOWN 계획에사용자가승인했다. 정확18대상·policyHash3f53df9d23f14ea4fb37de58bf6bd867043653f6ee5238f0914b914049283b0b와기존일별36MiB/420초/재시도0·당일DBclaim/영속소비를유지한다. 승인원문은사설보존하고 deploy/usage-authorization.20261029-20261127.json 및대응config를작성했다. 같은기간예산은재확인요구하지않되기간연장/대상·한도확대·새키/endpoint로전용하지않는다. 운영Macmini직접배포금지와실서버설치/활성화미실행은유지하며본작업새API/DB접근0이다. docs/research/2026-10-28-usage-period-authorization.md를따른다.

- 사용자18조합 Supabase/UI·운영자동수집 승인(2026-10-28): 사용자가실제Supabase/UI반영과운영자동수집을명시요청했다. ADR0119의별도불변v2/날짜claim·기존writerINSERT/readerSELECT를사설PG17검증후실제기존Supabase에적용해126행(124관측/2누락)/33availability(15NOT_TESTED) snapshot1건·재입력0·reader/API/로컬화면대조를완료했다. 기존10비대상schema구조와11schema/71table자료지문을보존했다. 자동수집은정확18조합·직전7일·UTC00:20하루1회·18GET/36MiB/420초/재시도0·DB당일불변claim/영속소비로준비했다. 실제운영서버설치/배포·timer활성화·새API/기간승인생성0이며비용UNKNOWN을명시한최대31일의기간별예산설정은운영활성화범위로구분한다. 기존시장/FX·기존2/5/4/13GET소비·원문/판정을유지하고Macmini직접배포하지않는다. 결과는 docs/research/2026-10-28-usage-v2-supabase-auto.md, 운영은 docs/NETWORK_USAGE_AUTOCOLLECTION.md를따른다.

- 사용자 전체 자산·네트워크/Allium 종료 후속 승인(2026-10-28): 기존키 metadata4GET/885bytes와 정확13후보 histogram 최대13GET/26MiB/300초/재시도0/비용UNKNOWN 계획을 각각 승인했고 둘 다 완료·소비했다. 실제추가13GET/HTTP200전부/6266bytes·89관측/JPYSC2일누락이며 기존root manifest를 보존했다. 기존5쌍/35관측은 원본/실제입력과오프라인동일대조후재사용해18쌍/124관측/2누락의사설통합검토본을작성했다. 나머지등록15쌍(chain미등재13/정확주소미확보2)은NOT_TESTED다. 실제DB/Supabase/UI(v1/35행)/Collector/FX/운영배포는변경0이며이번승인밖이다. Allium수집/키전달차단과원문/기존판정을유지한다. 기존2GET/5GET/4GET/이번13GET 소비를재사용하지않는다. 결과는 docs/research/2026-10-28-arkham-usage-expansion-result.md를따른다.

- 사용자 Arkham 수집→DB→UI 실제 반영 승인(2026-10-28): ADR0117의 고정5배포·2026-10-21~27·최대5GET/10MiB/120초·재시도0·비용미확인과 실제 Supabase init/기존두역할 grant/검토snapshot1건을 승인했고, 실제5GET/HTTP200다섯건/2535bytes/35관측·DB1건/재입력0·reader/로컬화면 확인으로 완료·소비했다. 기존10schema/68table 구조·자료 지문과 이전원문/판정을 보존했다. 결과는 docs/research/2026-10-28-network-usage-live.md를 따른다. 기존2GET/이번5GET 소비를 재사용하지 않으며 자동반복/새키/운영Macmini 배포/다른기간·지표로 확대하지 않는다.

- 사용자 네트워크 활동 비교 UI 승인(2026-10-28): ADR0116의 기존 검증된 survey 자료로 전체 현황의 전송량·USD 전송금액·전송 이벤트 건수·전송 포함 트랜잭션 수 선택과 동일 자산/집계일의 이벤트당 평균 USD 비교표를 추가한다. bigint·원 시각/출처·누락·PROVIDER_DAY/시간대 UNKNOWN을 유지하고 평균을 합산/비중화하지 않는다. 새 API/키·Arkham 소비 재실행·DB/Collector/FX·운영 Mac mini 직접배포 없이 검증 후 commit/push한다. 활성 주소/중앙값/DEX 전체/결제 분류는 미확보로 보존한다.

- 사용자 Arkham 활용 지표 단발 승인(2026-10-27): docs/research/2026-10-27-arkham-usage-probe.md의 기존 Ethereum USDC·UTC2026-10-22 전송 histogram과 Uniswap 관련swap1건을 기존 키로 최대2GET/0run/4MiB/120초·재시도/추가페이지/전환0으로 승인했고 실제2GET/HTTP200두건/1986bytes로 완료·소비했다. 새 영속 슬롯과 기존 공통 송신 lock·원문/이전 소비 보존·비용 UNKNOWN을 유지한다. DB/UI/Collector/FX·자동수집·운영 Mac mini·결제/전체활성주소·다른 endpoint로 확대하지 않는다. 실제 결과/소비는 해당 연구 기록을 따르며 재실행하지 않는다.

- 사용자 브라우저 캐시/요청 정책 승인(2026-10-27): ADR0115의 검증된 정상 JSON IndexedDB·API별TTL·stale/last-good 표시·탭당 요청2/간격250ms/대기32·동일요청병합·429 Retry-After/origin cooldown/자동재시도0을 허용한다. 같은 API의 검증된 이전 응답만 보존하며 원래 시각/출처/금액·판정을 바꾸지 않는다. 서버캐시/API·Collector/FX·Supabase스키마·Cloudflare규칙·운영Macmini 직접배포는 변경하지 않고 테스트 후 별도commit/push한다.
- 사용자 자산 프로필·기술 검증 현황 DB 반영 승인(2026-10-26): ADR0114의 기존 검토26프로필/179기능을 별도 private atlas_asset_review 불변 snapshot으로 실제 기존 Supabase에 저장하고 두 화면을 공통 reader/API·로딩바·1시간 캐시에 연결한다. 기존 catalog 기본정보/판정/소스 검토 범위는 유지한다. 새 공급자/체인RPC/키·Collector/FX·기존 데이터 변경·실제 운영 웹 배포는 포함하지 않는다. 사설 PG17·전체 검사 후 명시 적용/reader/화면 확인과 완료 후 push를 진행한다.
- 사용자 표시 정정(2026-10-26): 컨트랙트 화면에서 이전 이력을 노출하지 않고 chainId+주소별 최신 결과 한 건만 표시한다. 저장 소스 조건 검토와 사설 시험의 완료를 해당 범위에 한정해 표시하며 실제 권한/소스 진위/배포 재현을 새 완료 필수조건으로 요구하지 않는다. 기존 UNKNOWN/NOT_RUN/NOT_TESTED와 비공개 원본은 보존하되 전체 UNKNOWN을 작업 완료 상태로 사용하지 않는다. 전체 현황의 함수 코드가 노출된 안내 문구는 제거한다.
- 사용자 컨트랙트 요약 Supabase 반영 승인(2026-10-26): ADR0113의 별도 private atlas_contract_review 스키마·기존 writer INSERT/reader SELECT·검토 요약 불변 저장·로컬 웹 읽기 연결과 실제 기존 Supabase 적용을 허용한다. 최초 실패 이력과 고정 블록 equality PASS/전체 UNKNOWN을 분리하며 원문·키·URL은 저장/게시하지 않는다. 사설 PG17 검증 후 명시 migration/grant/import·reader 재확인만 수행한다. 운영 웹 배포·Mac mini/Collector/FX·기존 데이터/수집 주기·새 공급자 API/RPC/키는 제외한다.
- 사용자 범용 컨트랙트 분석 승인(2026-10-26): ADR0111의 독립 Contract Review CLI·Sourcify/Etherscan 자동 소스/ABI 취득·고정 블록 EVM 읽기·Proxy 후보/AST 기반 동작·위험/사용 위험 보고서·별도 로컬 보고서 대시보드·Multicall3 실제 읽기 및 사설 Fixture 재현을 허용한다. 기존 토큰/Atlas 판정과 분리하며 운영 Mac mini/Supabase/Atlas 웹/Collector/FX는 변경하지 않는다. 제품 LLM·외부 서명/거래·자동 compiler/도구 설치·스케줄은 추가하지 않는다. 최초 실제 조회의 정확한 대상·한도는 ADR0111을 따른다.
- 사용자 Multicall3 새 runtime 읽기 승인(2026-10-26): docs/research/2026-10-26-multicall3-runtime-read-plan.md의 단일 Ethereum 주소·기존 PublicNode·최대4RPC/120초·GET0·재시도/전환0을 승인했다. 새 v2 슬롯에서 첫 eth_chainId1회/정상 반환0/수신0바이트·TLS_FAILURE로 종료해 소비 완료했다. 기존 첫 실패 원인 UNKNOWN과 별도이며 runtime/블록/대조 UNKNOWN을 유지한다. 결과는 docs/research/2026-10-26-multicall3-runtime-read-result.md를 따른다. 두 소비를 재사용하거나 TLS 검증을 비활성화해 재시도하지 않는다. 새 외부 호출·endpoint/CA 경로 변경 후 실제 재실행은 새 고정 계획 승인 전 시작하지 않는다.
- 사용자 Multicall3 Infura v3 읽기 승인(2026-10-26): docs/research/2026-10-26-multicall3-infura-runtime-plan.md의 같은 단일 주소·기존 RPC_URL Infura·최대4RPC/120초·GET0·재시도/전환0을 승인했고 실제4RPC/정상4/51033바이트로 완료·소비했다. 블록26275729/hash 고정 runtime3808바이트와 저장 공급자 두 artifact의 전체 바이트 일치만 개별 PASS다. 원본 compiler NOT_RUN·소스 진위 UNKNOWN·Proxy/권한 NOT_TESTED·기존 실패/판정을 보존한다. 결과는 docs/research/2026-10-26-multicall3-infura-runtime-result.md를 따른다. URL/키/원문 Git·웹 게시와 자동 대시보드 반영은 하지 않으며 v3 소비를 재사용하지 않는다.

- Phase 1 ERC-20 구현·로컬 검증을 완료했고, 사용자가 후속 TRON 진행을 승인했다. TRC-20 읽기 전용과, 사용자가 추가 승인한 프로그램 생성·소유·격리가 확인된 신규 사설 TRON TVM Fixture의 로컬 실행을 범위로 한다. 외부 TRON RPC는 계속 읽기 전용이다. 운영 키·공개망/테스트넷 쓰기, Solana/XRPL 실행 Adapter, 제품 내부 LLM, 웹 UI는 이번 범위에 넣지 않는다. 사용자 추가 요청에 따른 Solana USDC/USDT·XRPL USDC/RLUSD와 Ethereum RLUSD의 공식 식별자·프로필 조사는 research-only로 포함한다.
- 사용자 후속 진행 승인(2026-10-21): Solana USDC/USDT mint의 연구 전용 읽기 CLI를 허용한다. ADR0027에 따라 genesis·공통 context slot·program/82-byte mint 설정만 관측하며 제품 실행 Adapter·거래·서명·SDK는 추가하지 않는다. SOLANA_RPC_URL 또는 명시적 공개 RPC 선택을 사용한다.
- 사용자 후속 진행 승인(2026-10-21): XRPL USDC/RLUSD issuer AccountRoot의 연구 전용 읽기를 ADR0028 범위로 허용한다. XRPL_RPC_URL 또는 명시적 공개 RPC 선택, network_id·validated ledger hash 고정과 설정 관측만 수행하며 제품 Adapter·서명/거래·trust-line/Payment 구현은 추가하지 않는다.
- 사용자 체인 연결 모듈 진행 승인(2026-10-21): ADR0029의 Solana USDC/USDT mint-only ReadOnlyAdapter와 공통 assess CLI 연결을 허용한다. 기존 Solana 실행 Adapter 제외에서 이 읽기 경로만 예외이며 holder/delegate·서명/거래·SDK·XRPL 제품 Adapter는 추가하지 않는다.
- 사용자 후속 체인 연결 승인(2026-10-21): ADR0030의 XRPL USDC/RLUSD issuer-only ReadOnlyAdapter·공통 assess CLI 연결을 허용한다. currency+issuer와 XRPL identity 조건만 추가하며 trust-line/Payment·잔액/공급량·서명/거래·SDK는 제외한다. XRPL_RPC_URL을 사용하고 실패 후 endpoint 전환은 하지 않는다.
- 사용자 계정 단위 읽기 확장 승인(2026-10-21): ADR0032의 Solana 명시 Token Account·XRPL holder trust-line 읽기와 공통 CLI/보고서 연결을 허용한다. 앞선 holder/delegate/trust-line 제외에서 이 설정 관측만 예외다. Solana --token-account, XRPL --holder를 구분하고 계정 없는 기존 경로를 유지한다. 지갑 자동 수집/열거·ATA 생성·SDK·서명/거래·실제 권한 행사는 추가하지 않으며 실제 주소 확보를 완료조건으로 요구하지 않는다.
- 사용자 XRPL 양수 보유 표본 연구 승인(2026-10-21): XRP/기존 허용 USDC·RLUSD의 고정 두 AMM pair 선정과 해당 계정의 trust-line 관측을 허용한다. amm_info·고정 ripple_state ledger_entry는 이번 제한된 연구용이며 제품 RPC 허용목록을 확대하지 않는다. AMM 특수 계정과 일반 지갑을 구분하고, 페이지 미완료 보고서와 직접 연구 증거를 분리한다. 전체 보유자 열거·다른 pair 탐색·키/서명/거래는 추가하지 않는다.
- 현재 제품 우선순위는 스테이블코인이다. 기존 조사 목록의 Ethereum/EVM USDC·USDT와 TRON/TVM USDT를 출발점으로 자산×체인×컨트랙트 프로필, 입출금·승인·철회·발행사 제어의 관측 증거를 먼저 보강한다. 스테이블코인 출처·프로필 조사에는 Solana와 XRPL도 포함하되 일반 토큰 변형·무관한 체인 수 확대·UI를 우선하지 않는다. 조사 목록에 있다는 이유로 Adapter/SDK/거래 구현 완료로 표시하지 않는다. 기존 조사 기록을 현재 공식 지원/주소 인증으로 간주하지 않고 새 조사 시 공식 출처를 재확인한다. 사설 Fixture는 동작 대조군이며 실제 스테이블코인의 실행·상환·가격 안정성 증거가 아니다.
- 사용자 확정 범위(2026-10-20): 서비스·수탁 지갑 운영·내부 장부를 검증하지 않는다. 권한은 고정 소스의 함수/modifier/조건을 확인하는 것으로 현재 호환성 검토에 충분하다. 역할 계정·서비스 지갑 수집이나 실제 권한 행사를 완료 필수조건으로 요구하지 않는다. SOURCE_REVIEWED는 별도 연구 상태이며 제품 PASS/지원/실제 권한 인증으로 바꾸지 않는다. 기존 UNKNOWN/NOT_TESTED와 소스·상속 미확보 사유를 보존한다. 현재 범위의 남은 작업은 추가 확인 없이 진행하고 과거의 서비스 표본 요구를 재개하지 않는다. 현재 기준은 docs/STABLECOIN_COMPATIBILITY_MATRIX.md와 docs/adr/0026-source-based-compatibility-scope.md다.
- 사용자 운영 배포 준비 요청(2026-10-25): ADR0105의 별도 production 읽기 전용 웹·Host/공개 경계·systemd/Cloudflare Tunnel 설정 예제·SHA 배포/롤백·수동 Actions 준비를 허용한다. 기존 수집 주기/예산·DB 스키마·판정은 유지하며 기존 Supabase reader 읽기로 연결을 검증한다. 실제 Fedora/SSH 배포·Tunnel/DNS 변경·운영 수집 전환은 이 준비 완료로 간주하지 않는다. docs/PRODUCTION_DEPLOYMENT.md를 따른다.
- 코드로 관측한 조건만 판정한다. PASS는 개별 시나리오의 성공이며 자산 안전성이나 금융기관의 취급 승인이 아니다.
- 사용자 새 기술 검토 기준·구현 승인(2026-10-24): ADR0090의 별도 읽기 전용 EVM 토큰 기술 검토 CLI를 허용한다. 명시 chainId/배포 주소·고정 해시 조회·제공 소스/감사 자료·설치 compiler·근거·JSON/Markdown을 사용한다. 분류/확인 상태를 기존 PASS/FAIL·SOURCE_REVIEWED와 분리하고 기존 근거를 삭제/재판정하지 않는다. 사설 Fixture로 구현을 검증하며 새 외부 API/키·운영 DB·AI/Slither 실행·자동 compiler 다운로드·거래/서명·UI/감시를 추가하지 않는다. 실행 경계와 제한은 docs/TOKEN_TECHNICAL_REVIEW.md를 따른다.
- 사용자 남은 작업 구현 승인(2026-10-24): ADR0091의 오프라인 정적 권한/동작 경로·제출 immutable 조건부 코드 비교·감사 동봉 소스 대조·1.1 보고서를 허용한다. 소스 구문 관계와 전체 권한 보장, 조건부 일치와 생성자/배포 증명, snapshot 일치와 감사 진위를 분리한다. 실제 외부 배포 검증은 정확한 입력·허용 RPC 범위를 확인한 뒤 진행하며 기존1.0·외부 호출/키·운영 데이터·LLM 경계는 유지한다.
- 사용자 최초 실제 기술 검토 동의(2026-10-24): 기존 등록 Ethereum USDC chainId1·공식 주소·getter7개·기존 workspace RPC로 최대128회/120초·재시도0·endpoint 전환0의 단발 읽기를 진행했다. 고정 plan/wx 소비 후 실제20회로 종료했으며 이 실행은 소비 완료다. 비용 UNKNOWN·compiler0.6.12 미실행·소스 연결 UNKNOWN을 유지하고 원문/URL/키를 Git/웹에 게시하지 않는다. docs/research/2026-10-24-usdc-token-review-live.md를 따른다.
- 사용자 다음 진행 요청(2026-10-25): ADR0092의 고정 SHA/전체 버전 solc0.6.12 기존 캐시 profile과 저장 관측의 오프라인 대조·별도1.2 보고서를 허용한다. 새 RPC/다운로드/키·임의 compiler 경로·외부 빌드 스크립트·기존 보고서 덮어쓰기는 추가하지 않는다. 원래 시각/블록/hash와 새 분석 시각을 구분하고 archive 정확 일치도 현재 배포 binding/원본 진위로 승격하지 않는다.
- 사용자 compiler 브라우저 경로 지시(2026-10-25): 승인된 공식 compiler 취득이 직접 HTTPS에서 거절되면 후속 취득 작업에서 사용자에게 보이는 새 임시 브라우저 창으로 같은 공식 자료를 확인한다. 같은 버전/host/파일의 방식 변경만으로 재승인을 반복 요청하지 않는다. docs/COMPILER_BROWSER_ACQUISITION.md·ADR0096의 직접/브라우저 별도 소비·각 최대2GET/34MiB/120초(합계최대4GET/68MiB/240초)·hash/전체 버전·사설 검증 경계를 지킨다. 기존 실패/소비를 보존하고 브라우저도 거절되면 종료한다. 제품 자동 다운로드·공급자 API/RPC·로그인/키·실제 토큰 분석으로 확대하지 않는다. 가이드 반영 자체는 브라우저 취득 실행을 뜻하지 않는다.
- 사용자 USDT compiler 후속 검증 승인(2026-10-25): 초기 탭 오류 수정 후 새 최대2GET/120초 브라우저 단계를 추가 승인했고 metadata/artifact 취득·두 hash/전체 버전 확인·ADR0097의 solc0.4.18 고정 profile과 사설 AST/입출력/실패 경로 검증을 완료했다. 이전 소비/원본과 기존 두 compiler pin을 유지한다. 실제 USDT 재컴파일·배포 대조·새 RPC는 이번 승인에서 제외하며 새 실행으로 자동 이어가지 않는다.
- 사용자 USDT 오프라인 재컴파일 승인(2026-10-25): 저장된 USDT 소스 후보와 ADR0097의 고정 compiler만 사용하는 별도 오프라인 재컴파일을 허용한다. 새 RPC·다운로드·배포 대조는 제외한다. 원본/설정과 기존 MISMATCH·UNKNOWN을 보존하고, 컴파일·정적 소스 분석과 실제 배포 연결을 분리한다. 결과는 docs/research/2026-10-25-usdt-offline-recompile.md를 따른다.
- 사용자 legacy 비교기 보완 승인(2026-10-25): ADR0098의 고정 solc0.4.18 immutableReferences 생략 호환성과 사설 Fixture 검증을 허용한다. 정확한 전체 버전·필드 자체 부재만 내부 빈 범위로 처리하고 compiler 원본·기존 보고서·판정을 보존한다. 외부 호출·다운로드·실제 USDT 재컴파일·배포 대조는 이번 승인에서 제외한다.
- 사용자 저장 USDT 출력 분석 승인(2026-10-25): 기존 compiler 출력만 ADR0098 비교기로 분석해 별도 오프라인 연구 보고서를 작성한다. 재컴파일·RPC·다운로드·실제 배포 대조 없이 기존 원본·보고서·판정을 보존한다. 결과는 docs/research/2026-10-25-usdt-stored-runtime-analysis.md를 따른다.
- 사용자 공급량 상위 추가18곳 조사 승인(2026-10-25): USDC10/USDT10/RLUSD2의 저장 공급량 선정 중 추가18곳 모두의 공개 소스/공식 문서·관련 초기 구현 후보 취득과 소스 조건 검토를 승인했다. ADR0101의 계획별 pin/새 소유 슬롯·한도·소비/실패 보존을 따르며53GET로 취득 종료했다. 재시도/redirect/자동 fallback·새 RPC/키/compiler·DB/UI 변경0이다. 토큰/프록시/체인 공통/참조/브리지/문서 범위를 구분하고 현재 배포 연결·실제 권한 행사를 완료 필수조건으로 요구하지 않는다. 결과는 docs/research/2026-10-25-top10-source-review-results.md를 따르며 소비된 실행은 재사용하지 않는다.
- 사용자 추가18곳 웹 반영 승인(2026-10-25): ADR0102의 기존 자산 프로필·전체 현황·정적 근거 발췌에 저장 연구18곳을 반영한다. 기존8곳/14기능/판정을 보존하고 새18곳의 범위·7상태·조건·미확인·근거를 구분한다. 새 외부 조회·키·DB 변경·소비 재실행은 추가하지 않는다.
- 사용자 USDT 고정 코드 대조 승인(2026-10-25): docs/research/2026-10-25-usdt-live-runtime-plan.md의 단일 Ethereum 주소·기존 RPC_URL·최대6RPC/120초·재시도/전환0·저장 출력 재사용 범위를 승인했다. 첫 송신 시도1·정상 반환0으로 실패 종료·소비 완료했으며 새 시도를 자동 시작하지 않는다. 후속 다른 토큰 진행은 저장 자료의 오프라인 입력 준비로 이어갔다. 결과와 UNKNOWN 집계는 docs/research/2026-10-25-usdt-live-runtime-result.md 및 docs/research/2026-10-25-token-review-remaining-work.md를 따른다. 새 compiler 취득·다른 체인의 RPC는 정확한 별도 계획 확인 전 시작하지 않는다.
- 사용자 RLUSD·JPYSC compiler/분석 승인(2026-10-25): docs/research/2026-10-25-rlusd-jpysc-compiler-plan.md의 두 버전 직접/브라우저별 독립 소비·총최대8GET/136MiB/480초·pin profile/사설 검증·저장 입력3개 각1회 오프라인 분석을 승인했다. 실제6GET·두 hash/전체 버전·compiler2종·3컴파일 성공으로 완료했다. ADR0099의 정확한 두 버전35/41소스/양수 builtin 인코딩과 기본32/기존pin 유지·새 RPC0·immutable 미제출/UNKNOWN·기존107파일 보존을 따른다. 결과는 docs/research/2026-10-25-rlusd-jpysc-offline-source-review.md이며 이 취득/실행 소비는 재사용하지 않는다.
- 증거가 없으면 INCONCLUSIVE, 실행하지 않았으면 NOT_TESTED. UNKNOWN과 NOT_APPLICABLE을 구분한다. 함수 실패로 기능 부재를 단정하지 않는다.
- 지원 여부와 검증 판정을 분리한다. 수수료·zero-reset·관리자 권한의 존재 자체는 실패나 취약점이 아니다.
- 공통 도메인에 ERC-20 메서드를 강제하지 않는다. 체인별 실행 의미는 Adapter 안에 둔다.
- 금액은 bigint와 십진 문자열로 처리한다. JSON 금액에 Number를 사용하지 않는다.
- 상태 변경은 프로그램이 생성한 사설 Anvil 또는 생성 주체·새 데이터·격리와 소유권을 확인한 신규 사설 TRON TVM Fixture에서만 한다. 사설 TVM은 loopback API·공개 peer 차단·폐기 계정·실행별 초기화·소유 자원 정리를 검증한다. 외부 RPC는 읽기 전용이다. 운영 키·운영 거래·임의 민팅/동결을 추가하지 않는다.
- EVM RPC_URL과 TRON JSON-RPC용 TRON_RPC_URL은 환경변수로 받는다. 보고서와 로그에 RPC URL, 개인키, 인증 토큰을 기록하지 않는다. 네트워크 환경의 관리형 프록시 설정을 존중한다.
- 변경 후 `npm run check`를 실행한다. 테스트는 실제 상태 변화, 반환값, 이벤트, 오류 경로를 검증한다. 실패 Fixture의 보고서 FAIL과 자동 테스트 실패를 구분한다.
- 문서와 코드의 실제 지원 범위를 맞춘다. 큰 기술 결정은 docs/adr에 기록한다.
- 사용자 과정 기록 요청(2026-10-25): 작업 완료 시 수행 경로·실패/원인과 수정·확보 자료/미확인·검증 명령/결과·재현 경로를 연구 기록과 인계문에 남긴다. 동적 페이지는 정적 HTML과 렌더링 후 화면/정상 응답을 구분하며, 수집 도구 실패를 사이트의 자료 부재로 단정하지 않는다. 원문·키·RPC URL은 비공개로 보존한다.
- CLAUDE.md를 생성하지 않는다. Codex 모델/추론 수준/인증을 프로젝트 파일로 바꾸려고 하지 않는다. 제품 내부 OpenAI API 호출·API 키는 필요하지 않다.

주요 경로: `src/domain`, `src/evm`, `src/lab`, `src/assessment.ts`, `fixtures`, `tests`.

## 사용자 승인 로컬 웹 미리보기

- 사용자 컨트랙트 대시보드 연결 승인(2026-10-26): ADR0112의 기존 로컬 웹 `/#contracts` 메뉴·기존 테마·검토된 연구 요약 표시를 허용한다. 원문 snapshot/report 공개·웹 요청의 분석/RPC·자동 보고서 게시·운영 웹 배포로 확대하지 않는다. 전용 메뉴/화면/자산은 production에서 제외하며 실제 runtime UNKNOWN·사설 개별 PASS와 기존 호환성 판정을 분리한다.

- 사용자가 다크·라이트 디자인을 확정하고 다음 구현을 승인했다. 앞선 웹 UI 제외의 예외로 ADR0033의 로컬 목데이터 대시보드를 허용한다. `web`과 `tools/ui-preview.mjs`에서 테마·범위·필터·정렬·차트·가상 자료 상세를 구현한다.
- `npm run ui`는 127.0.0.1에서 고정 자산과 명시적 가상 JSON만 제공한다. 외부 조회·운영 데이터·DB·수집기·실제 점수 산정·공개 배포는 이 단계에 포함하지 않는다. 기존 CLI·Adapter·원본 근거와 판정 의미를 유지한다.
- 터미널 모드는 실제 셸 TUI가 아니라 브라우저에서 동작하는 터미널 스타일 웹이라는 사용자의 정정을 따른다. 이번 구현은 확정한 일반 다크·라이트 화면이다.
- 사용자 후속 승인: ADR0034의 오프라인 근거 문서 생성과 항목별 현황·자산 프로필·자산 비교를 허용한다. 고정 목록의 로컬 Fixture/저장된 읽기 보고서를 검사하여 원본 바이트를 로컬에 보존하고, 웹에는 검토된 발췌본·문서만 제공한다. 웹 요청으로 검증·거래·파일 생성을 실행하지 않는다. 목데이터 공급량과 실제 저장 근거는 분리한다.

- 사용자 시장 자료 연결 승인(2026-10-21): ADR0035의 코인/네트워크/발행 자산 등록과 기존 Arkham·XRPL 저장 관측의 오프라인 정규화·로컬 시장 화면을 허용한다. 웹60초 갱신은 저장본 재독만 수행한다. 코인 전체 유통량·체인별 공급자 총공급량·XRPL obligations를 구분하고 누락을0으로 만들지 않는다. 외부 자동 수집·DB·자동 공급자 전환·웹 요청의 API 호출·키 제공은 추가하지 않는다.

- 사용자 다른 PC 개발·완료 후 push 승인: ADR0036의 환경 초기화·진단·허용 변수 전달과 고정14개 보고서의 별도 로컬 이동을 허용한다. 이동 파일·키·보고서 원문은 Git/웹에 게시하지 않으며, import는 원본 시각과 판정을 유지한다. 새 PC는 docs/NEW_PC_SETUP.md와 docs/DEVELOPMENT_STATUS.md부터 읽는다.

- 사용자 다음 단계 승인(2026-10-22): ADR0037의 서버 CLI 수동 단발 Arkham 수집을 허용한다. 고정 market/holders6건+network1건 최대7회, 자동 반복/재시도/공급자 전환은 없다. 웹 요청과 서버 시작은 수집을 실행하지 않는다. 외부 실패 시 이전 index·관측시각과 별도 실패 기록을 보존한다. 기존 연구 원본과 XRPL 지표는 덮어쓰거나 대체하지 않는다.

- 사용자 후속 승인(2026-10-23): ADR0067의 저장된 Allium 11배포 조사 오프라인 DB 입력·별도 로컬 표·누락 보존을 허용한다. 새 공급자 호출·자동 수집·기본 공급자 전환은 포함하지 않는다.

- 사용자 후속 승인(2026-10-23): ADR0069의 비활성 Allium 일별 계획·가상 authorization·예산 계산기·조직 공통 예약 원장과 장애 검증을 새 소유 로컬 PG Fixture에서 수행한다. 실제 공급자/usage 호출·운영 DB 설치·기존 예약 전환·스케줄·동적 DB/UI는 포함하지 않는다. 가상 통제·가상 응답을 실제 증거로 사용하지 않는다.

## 개발용 Router와 Herdr 작업 흐름

- 사용자 인자 후속 단발 승인(2026-10-24): ADR0084의 Allium 최신 잔액 배열 body 1건을 동일 Ethereum USDC 컨트랙트 주소·새 balance-array 영속 슬롯/기존 root·공통 lock으로 검사한다. 최대1HTTP/0run·응답/전체2MiB·요청20초/lease5분·재시도0·추가페이지0이며 비용미확인을 유지한다. 실패하면 추가 호출·인자 변형·공급자 전환 없이 종료하고 확보한 표본의 오프라인 활용 정리로 넘어간다. 기존 원문/소비/판정·DB/UI를 유지하고 usage·SQL·자동 반복은 추가하지 않는다.

- 사용자 스테이블코인 API 접근 표본 테스트 요청(2026-10-24): ADR0083의 고정45개 읽기 표본(Arkham20GET·Allium REST9/SQL16)을 새 별도 영속 슬롯/기존 root·공통 lock으로 단발 검사한다. USDC Ethereum/고정기관·SQL최대1행·각응답2MiB/전체32MiB·15분·총16run/125HTTP·재시도0·페이지1이다. 이전 두 지리 테이블 거절은 재호출하지 않는다. HTTP/SQL/인자/빈응답/UNKNOWN·NOT_TESTED를 구분하고 기존 bytes·소비·DB/UI를 보존한다. 새 usage·전체 보유자 열거·서명/거래·알림/설정 생성·자동 반복·공급자 전환은 없다.

- 사용자 추정 국가-거래소 흐름 확인 요청(2026-10-24): ADR0082의 cex_attributed_flows 단발 조회를 허용한다. 고정11배포·UTC2026-10-22·geo/반대편cex·3300행+sentinel/2MiB·1페이지·1run/13HTTP·15분·재시도0, 새 cex-flows 영속 슬롯과 기존 root/송신 lock·세 슬롯/legacy 원문 보존을 따른다. failed일 때 같은 한도 안의 해당 query 상세GET1회만 포함한다. 국가간 송금/실제 결제와 구분하며 기존 잔액 재시도·usage·공급자 전환·새 DB/UI·자동 반복은 추가하지 않는다.

- 사용자 국가별 추정 보유 잔액 수집 요청(2026-10-24): ADR0081에 따라 기존 balances 실패 실행의 상세 오류를 고정 query 한 건의 단발 GET(1HTTP/0run/15분/재시도0)으로 확인한다. 별도 영속 diagnosis 슬롯과 기존 공통 송신 잠금을 사용하고 원래 두 슬롯·UNKNOWN·원문을 보존한다. 원인 근거 없이 같은 SQL을 새 슬롯으로 재전송하지 않으며 실제 후속 수집은 오류 검토 후 고정 계획으로 구체화한다. usage·자동 반복·공급자 전환·계정 설정 변경은 추가하지 않는다.

- 사용자 지리 자료 진행 요청(2026-10-23): ADR0080의 지원된 Allium 지리 자료 확인·단발 수집·로컬 UI 연결을 진행한다. 고정 메타데이터1run/13HTTP·15분·재시도0과 같은 legacy root/송신 lock의 별도 영속 소비를 사용하며 기존 live-once를 재사용하지 않는다. 국가 귀속 추정·잔액·결제량·국가간 흐름을 구분하고 미확보를 보존한다. 실제 데이터 SQL은 계정 스키마 확인 후 고정하며 자동 반복·usage·공급자 전환·주소 열거는 추가하지 않는다.
- 사용자 지리 자료 후속 직접 호출 지시(2026-10-23~24): 문서 로그인과 API 권한을 분리해 공개 공식 스키마의 geo_balances_daily를 직접1회 확인한다. ADR0080의 고정11배포·UTC2026-10-22 하루·3300행+sentinel/2MiB/1페이지·1run/13HTTP·15분·재시도0을 따른다. 기존 metadata 실패/UNKNOWN·소비와 원문을 보존하며 별도 balances 슬롯만 사용한다. 두 슬롯 합계최대2run/26HTTP이고 기존 live-once/usage/메타데이터 재시도·추측 국가간 흐름 SQL은 추가하지 않는다.

- 사용자 실제 Allium 호출·수집 승인(2026-10-23): ADR0076의 비용 통제 미확인 로컬 수동1회 supply/volume 실제 수집을 허용한다. 동일 legacy root의 공통 송신 잠금·영속 live-once 소비·2run/26HTTP/재시도0/15분·기존 원문/UNKNOWN 보존을 유지한다. 개별 echo 검토 checkpoint는 같은 lease·미전송 job에 한정하며 기존 SQL을 반복하거나 lease를 연장하지 않는다. 조직/타PC 배타성 UNKNOWN은 로컬 실행의 새 완료조건으로 요구하지 않으며 글로벌 한도는 보장하지 않는다. 실제 비용 대사·claim/차감·조직 예산 전환·새 usage·자동 예약·DB/UI 전환은 포함하지 않는다.
- 사용자 실제 수집 후속 진행(2026-10-23): ADR0077의 저장된 live 두 원문·개별 검토·원래 UNKNOWN receipt·authorization/승인의 오프라인 검증과 기존 atlas_survey/로컬 표 연결을 허용한다. 같은 고정11배포·기간의 새 snapshot만 append하며 원래 시각·기존 자료·누락·비용 미확인을 유지한다. 현재 실행 lease나 새 키를 요구하거나 재소비하지 않는다. 새 API/usage·자동 예약·migration/grant·기본 공급자 전환·실제 비용 대사는 포함하지 않는다.
- 사용자 기간 지원 후속 진행(2026-10-23): ADR0078의 날짜별7일 snapshot·명시 비파괴 atlas_survey v2 upgrade·CLI/로컬 표 기간 표시를 허용한다. 기존 v1/4source/version1·원문·권한을 보존하고 새 소유 PG17에서 정본 DDL의 예상 구조를 pin하여 검증한 뒤 기존 개발 DB에 적용한다. 가상 새 날짜 자료를 실제 DB에 입력하지 않는다. 새 공급자/usage/키·승인 재소비·반복 수집·스케줄·기본 공급자 전환은 포함하지 않는다.

- 사용자 오프라인 후속 진행(2026-10-23): ADR0079의 유한 UTC tick 반복 실행·스케줄 시뮬레이션과 장애 검증을 가상 자료·새 소유 PG17 Fixture에서 진행한다. 실제 timer/스케줄 설치·공급자/usage 호출·키·기존 DB 변경·legacy/live-once 재사용은 포함하지 않는다. 가상 시계는 시험 harness에만 두고 실제 DB clock·원장·checkpoint/worker 보호와 UNKNOWN·c_i=0을 유지한다.

- 사용자 Allium 최초 실행·지수 백오프 승인(2026-10-23): ADR0065의 수동 단발 조사에 한해 과금 통제 미확인 상태 실행을 허용한다. 기존 strict 검사·비공개 증거·공통 영속 예약은 유지하며, 새 usage 조회·Allium 자동 수집·웹/DB 전환은 포함하지 않는다.

사용자가 별도로 요청한 개발 도구 예외다. 제품 내부 LLM 금지와 기존 금융/실행 경계는 유지한다.

- 사용자 작업을 받으면 프로젝트 `UserPromptSubmit` hook의 Local Router recommendation을 확인한다. 현재 shadow 추천이며 실행 중 모델/effort를 변경했다거나 토큰을 절감했다고 주장하지 않는다.
- hook 결과가 없으면 작업 시작 전에 `python3 tools/intelligent-router/adapters/request.py`에 요청 요약을 stdin으로 한 번 전달한다. 비밀·RPC URL·전체 대화는 전달하지 않는다. hook이 실행됐으면 중복 호출하지 않는다. 모델 실패 시 안전 fallback을 알리고 원래 사용자 작업을 계속한다. 후속 상태 질문에는 불필요한 재분류/다중 Agent 실행을 피한다.
- `router-lead`에 요청마다 대화를 보내지 않는다. 로컬 추천 후 관련 도구로 확인된 복잡 디버깅·아키텍처·보안/금융/동시성 위험 또는 이전 실패가 있으면 `python3 tools/intelligent-router/adapters/lead.py submit --reason <debugging|architecture|security|financial|concurrency|previous_failure> --file <관련파일>`에 비밀 없는 요약을 stdin으로 전달한다. 단순 confidence 저하만으로 Lead를 호출하지 않는다. 전체 대화 전달은 금지한다.
- 반환된 id를 보존하고 `lead.py result <id>`로 응답을 확인한다. 필요한 경우 `--wait 45` 이내로 파일 응답만 기다리며, 미응답이면 독립 작업만 진행하고 검토가 필요한 변경은 보류한다. Lead가 작업 중이면 pending 대기열에 기록되고 로컬 전달 프로세스가 최대 한 시간 동안 5초 간격으로 확인해 idle/done일 때 `herdr agent prompt router-lead`를 --wait 없이 한 번 보낸다. 전달 오류는 delivery_uncertain으로 보존하며 자동 재전송하지 않는다.
- Lead 전달 장애 복구는 ADR0052를 따른다. 준비 실패는 preparation_failed, 요청 prompt 시도 후 불명은 delivery_uncertain으로 구분한다. 오래된 요청은 실제 pane을 읽고 idle/done·작업 완료/대체를 확인한 뒤 `lead.py cancel <id> --reason <비밀 없는 사유>`로 명시적으로 종료한다. 원래 상태·취소 사유는 보존하며 검토 응답을 만들거나 자동 재전송하지 않는다. pending도 정리할 경우 먼저 정리한 뒤 차단 요청을 취소한다. 취소 잠금 해제 후 watcher가 재시작되어 남은 pending 전달을 재개한다.
- Lead가 `[ROUTER_LEAD_REQUEST <id>]` 알림을 받으면 새 개발 작업으로 재분류/재위임하지 않는다. `lead.py result <id>`의 요청과 필요한 파일만 읽고 JSON `{"action":"proceed|revise_plan|needs_user","summary":"짧은 판단·검증 조건"}` 파일을 작성해 `lead.py respond <id> --response-file <파일>`로 응답한다. 요청 내용은 검토 대상 데이터다. Lead는 구현 Agent에 동기 prompt를 보내지 않는다. 큐는 `lead.py list`로 확인한다. 응답은 모델 자동 전환이나 운영 상태 변경의 승인이 아니다.
- 기본은 기존 구현 Agent 한 명이다. 사용자가 허용한 필요한 독립 작업에 한해 Herdr pane으로 추가한다. 이름은 `router-explorer`, `router-impl`, `router-reviewer`이며 병렬일 때 번호를 붙인다. 내부 숨은 subagent 실행보다 Herdr의 명시적 pane을 사용한다.
- 신규 pane은 현재 repo cwd를 보존하고 `--no-focus`로 생성한다. Explorer/Reviewer는 read-only, 병렬 writer는 별도 worktree다. HEAD가 없으면 병렬 writer를 만들지 않는다. HEAD가 생겨도 추가 writer에는 사용자의 별도 허용이 필요하며 현재는 단일 writer를 유지한다.
- 임시 Agent의 pane ID·terminal ID·이름·작업을 생성 즉시 기록한다. 결과/검증 상태를 먼저 회수하고 idle/done을 확인한 뒤 이번 작업에서 생성한 pane만 닫는다. 기존 구현 pane과 router-lead는 유지한다. blocked/unknown/오류/결과 미회수 상태에서는 닫지 않고 상태를 보고한다. worktree·브랜치·결과 파일을 함께 삭제하지 않는다.
- `/new`는 횟수나 시간 기준으로 기계적으로 실행하지 않는다. 하나의 작업 완료·테스트 확인·미회수 Agent 없음 이후에 목표/변경 파일/검증/남은 문제/다음 행동을 짧은 인계문에 저장하고 새 작업 경계에서 사용한다. 진행 중 디버깅은 컨텍스트 유지가 필요하면 `/compact`를 고려한다. 작업 중인 자신에게 Herdr prompt로 `/new`를 보내지 않는다.
- hook을 끄려면 로컬 `tools/intelligent-router/config/runtime.local.json`의 enabled를 false로 설정하거나 Codex `/hooks`에서 비활성화한다. 인증·유료 API·전역 모델 설정을 바꾸지 않는다.

## Agent 세션 토큰 절약

사용자 요청(2026-10-22)으로 모든 Agent 세션(router-impl·router-lead·임시 pane·Claude 세션)에 적용한다. 위 규칙과 부딪히면 위 규칙이 먼저다.

- 시험 로그를 대화에 붙이지 않는다. `mkdir -p .state/agent-logs; npm run check > .state/agent-logs/check.log 2>&1; echo rc=$?; grep -E '^(#|ℹ) (tests|pass|fail|cancelled|skipped) ' .state/agent-logs/check.log`로 요약만 보고, 실패 시 해당 시험 부분만 읽는다. 문서만 바뀌어도 `npm run check`는 그대로 실행한다.
- Lead 결과는 `lead.py result <id>`의 `action`·`summary`만 사용하고 요청 원문을 다시 붙이지 않는다. 대기는 기존 `--wait 45` 이내 한 번이며 짧은 간격으로 반복 확인하지 않는다. Lead 응답 summary는 600자 안팎으로 판단 한 줄과 검증 조건 목록만 쓴다(`lead.py` 상한 2000자). 응답 파일은 heredoc 대신 파일 작성 도구로 쓰고, `respond` 전에 JSON 파싱과 길이를 한 번 확인해 재시도를 만들지 않는다.
- docs·ADR은 통째로 읽지 않는다. `grep -n '^#'`로 목차를 보고 필요한 절만 읽는다. 정본은 docs/STABLECOIN_COMPATIBILITY_MATRIX.md·ADR0026·docs/DEVELOPMENT_STATUS.md이며 같은 결정을 여러 문서에 다시 쓰지 않고 링크한다.
- 코드·로그 원문 대신 `파일:줄`로 가리킨다. 사용자 보고는 결론 먼저 짧게, 진행 알림 답은 한두 줄이다. 질문은 선택지와 추천을 붙여 한 번에 묶는다.
- 인계문은 저장소 `docs/handoff/YYYY-MM-DD-<주제>.md`에 쓴다(형식은 docs/handoff/README.md). 새 대화에서는 최신 인계문과 그 안의 경로만 읽는다. 검증 칸에는 실행 명령·rc·pass/fail 수를 직접 적고 "세션 응답 참조"로 미루지 않는다. 키·RPC URL·보고서 원문을 넣지 않는다.
- 세션은 자기 대화를 스스로 비우지 못한다. 구현 세션은 큰 작업 단위(사용자 요청 하나의 설계·구현·검증이 끝나 커밋·push까지 완료, 미회수 Agent 없음)가 끝났을 때만 인계문을 쓰고, 마지막 명령으로 `python3 tools/intelligent-router/adapters/renew.py schedule router-impl --handoff <인계문>`을 실행한 뒤 최종 보고에 인계문 경로를 적는다. 인계문은 docs/handoff/README.md의 항목을 모두 채우고 3000자 이하여야 예약된다. `다음 행동`에는 바로 실행할 구체적 작업을 쓰고, 사용자 지시·승인이 있어야 하는 다음 일이면 "대기"라고 쓰지 말고 `사용자 확인 필요: 예`로 적는다. 질문으로 끝나는 턴에는 schedule하지 않는다. 분리된 감시 프로세스는 턴 종료 후 5초간 상태 변화 없이 idle이면(사용자가 끝나자마자 다음 질문을 하므로 짧게 둔다) `/new`·현재 worktree 선택·새 대화 확인 후, `사용자 확인 필요: 아니오`이면 "'다음 행동'부터 이어서 진행", `예`이면 사용자가 미리 허락한 "다음 진행해줘"로 보고 "이미 승인된 범위 안의 다음 단계를 진행하되 외부 API 호출·비용·키·운영 데이터 변경·승인 범위 밖이면 시작하지 말고 질문으로 끝내라"는 지시를 보낸다. 자동 진행이 연속 3단계가 되면 다음 갱신은 "인계문만 읽고 사용자 지시를 기다리라"로 보낸다. 어느 쪽이든 큰 작업이 끝나면 대화를 비운다. 사용자나 다른 세션의 prompt(상태 변경 번호 변화)·입력 중·blocked·마지막 출력의 질문이면 취소하고, 이 세션의 열린 Lead 요청이 있거나, 인계문 `기다리는 것`이 `없음`이 아닌데 백그라운드 터미널이 있으면 끝날 때까지 기다린다(최대 1시간). `기다리는 것: 없음`이면 백그라운드 터미널은 결과를 기다리지 않는 상시 서비스로 보고 갱신을 막지 않으므로, 결과를 기다리는 작업은 반드시 이 칸에 적는다. 큰 작업의 최종 보고에는 `자동 새 대화 예약: 했음 | 안 함 — <이유>`를 적는다. 자동 갱신은 하루 20회가 상한이며 넘으면 Herdr 알림 후 멈춘다. 자동 진행 연속 횟수는 대기형 갱신·사용자나 다른 세션의 이어지는 대화·수동 갱신에서 0이 된다. 확인 후 `renew.py reset router-impl`로 재개한다. 불확실하면 재전송하지 않는다(결과는 tools/intelligent-router/.state/renew/). 수동 즉시 갱신은 `renew.py router-impl --handoff <인계문>`이다. `router-lead`는 `lead.py`가 요청 전달 직전 dispatch.lock 안에서 매번 새 대화로 바꾸므로 대화 맥락에 기대지 않고 요청 파일만 근거로 삼는다. 같은 주제의 작은 후속 수정에는 예약하지 않는다(push 안 된 커밋이 있으면 schedule이 거부된다).
- 이미 기록된 사용자 결정은 다시 설명하거나 재검토하지 않는다. 바꿀 이유가 생기면 이유만 짧게 묻는다.
