# 인계: 추가13조합 histogram 수집 완료

사용자 “네 승인할께”는 직전 정확13조회·기존키·최대13GET/26MiB/300초/재시도0/비용UNKNOWN 고정계획 승인이다. 실제13GET 모두HTTP200/6266bytes로 완료·소비했다. 재시도/redirect/추가페이지/공급자전환0, 기존root manifest/키hash/discovery receipt/소스4pin 대조, Node --use-env-proxy 경계를 지켰다. Allium 신규수집/키전달차단 유지. 운영 Mac mini/DB/UI/Collector/FX 변경0.

원본슬롯 .state/allium-executor/arkham-network-usage-expansion-20261028-v2. PlanSHA2914dcf96dc7f28c2abd6b8704498c6fae3925cbe8a0a6234c0eebf490934031, receiptSHA8504a1045cfac430507f00ba25fbdf5ddfb2202eb3304aab5939a5b5b43d39a1. 원문/승인/authorization/intent/receipt 비공개 보존, 소비 재사용 금지. 계획JSON의승인전status도hash증거로보존했으며 실제상태는본기록/receipt를따른다.

새13쌍: USDT BSC/Arbitrum/Polygon3, USDC Base/Arbitrum/Polygon/BSC/Avalanche5, RLUSD Ethereum1, JPYC Ethereum/Polygon/Avalanche3, JPYSC Ethereum1. 새91논리행 중89OBSERVED/2MISSING. JPYSC Ethereum의2026-10-24/25 bucket은응답없음; null을보존하고0이나원인추정을하지않았다. 원래기간2026-10-21~27, bigint정수/십진문자열·원providerTime/queriedAt/hash·시간대UNKNOWN을유지한다. transfer_count는사람/지갑/결제수아님.

기존5쌍/35관측을 projectUsageArchive로원본재검증했고 실제기존입력reviewed-input.json과canonical전체동일을확인했다. 기존자료를재조회하지않고합쳐18쌍/126논리행=124OBSERVED/2MISSING 사설검토본확보. 등록33중나머지15(chain미등재13/정확주소미확보2)는NOT_TESTED다. 현재Supabase/reader/UI는기존v1/5쌍·35행이며새검토본은DBpayload가아니다. 실제DB/UI확장은별도설계·사설PG검증·적용승인범위다. 추가외부호출/지원주소조사/자동수집도미승인이다.

사설경로 .state/usage-expansion-live-20261028: approval.txt, collect.mjs, review.mjs, combine.mjs, 실행/검증로그, reviewed-rows.json, combined-review.json. 새검토hash ace3445eb0cddcf3e46895883a10310cc2941a325196e4a2fa7a619a0245e65b, 통합hash21f32e127bc89237fa136b331c17cd8e4a1317eec1045f36e7d14191e99554fc. collect재실행금지. review/combine도출력wx이므로재현시새사설출력경로를사용하며기존원문/검토본을덮어쓰지않는다.

관련회귀26pass/0fail, npm run check 총746pass/0fail(일반672+net차단74). 새collector가상14회귀및Lead39a3bfafac404a949756f9540027430d proceed확인. 이번실제실패0; JPYSC누락은별도다. 수행/실패/미확인/재현은 docs/research/2026-10-28-arkham-usage-expansion-result.md. docs/handoff/2026-10-22-router-lead-review.md는별도untracked로건드리지않는다. 기존로컬UI서버는재시작하지않았고과거DB/화면검증은network-usage-live 인계문을따른다. 원문/키/RPC URL을Git/웹에싣지않는다. 완료후commit/push승인을따른다.
