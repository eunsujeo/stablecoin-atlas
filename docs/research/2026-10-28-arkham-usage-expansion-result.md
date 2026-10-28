# Arkham 추가13조합 histogram 단발 수집 결과

후속: 추가사용자요청으로v2 Supabase/로컬UI반영을완료하고운영자동수집을준비했다. [후속기록](2026-10-28-usage-v2-supabase-auto.md)을따른다. 아래DB/UI미반영은당시수집단계기록이다.

상태: 승인된13GET 완료·소비. 새 DB/Supabase/UI 반영·Collector/FX·운영 배포는 수행하지 않았다.

## 승인·실제 소비

사용자 “네 승인할께”는 직전 제시한13후보의 정확주소/기간·최대13GET/26MiB/300초/재시도0/비용UNKNOWN 계획 승인이다. 실제 승인 원문/문맥은 `.state/usage-expansion-live-20261028/approval.txt`에 비공개 보존했다.

고정 계획 `data/arkham-network-usage-expansion-20261028-plan.json`, 파일SHA256 `2914dcf96dc7f28c2abd6b8704498c6fae3925cbe8a0a6234c0eebf490934031`. 승인 전 status를 포함한 당시 bytes는 증거로 유지하며 수정하지 않았다. 실제 완료/소비 상태는 이 기록과 receipt를 따른다.

새 슬롯 `.state/allium-executor/arkham-network-usage-expansion-20261028-v2`와 기존 공통 송신 lock을 사용했다. 송신 전에 exclusive 슬롯/승인/authorization/intent를 영속 기록했다. 기존 키hash와 discovery receipt hash, 소스4파일pin을 대조했고 Node --use-env-proxy로 실행했다. 관리형 proxy/NO_PROXY·endpoint/CA를 변경하지 않았다.

실제13GET 전부HTTP200·총6266bytes, 비용UNKNOWN. 응답별2MiB/총26MiB·300초·요청20초·간격1초·재시도/redirect/추가페이지/전환0을 지켰다. 기존 root 전체 manifest가 실행 전후 같았다. 기존5GET/4GET을 재실행하지 않았다. 현재13GET도 소비 완료이며 재사용하지 않는다.

| 자산·네트워크 | HTTP | 날짜별 관측 | 응답 bytes |
| --- | --- | ---: | ---: |
| USDT BSC | 200 | 7 | 514 |
| USDT Arbitrum | 200 | 7 | 505 |
| USDT Polygon | 200 | 7 | 502 |
| USDC Base | 200 | 7 | 509 |
| USDC Arbitrum | 200 | 7 | 508 |
| USDC Polygon | 200 | 7 | 499 |
| USDC BSC | 200 | 7 | 500 |
| USDC Avalanche | 200 | 7 | 498 |
| RLUSD Ethereum | 200 | 7 | 486 |
| JPYC Ethereum | 200 | 7 | 477 |
| JPYC Polygon | 200 | 7 | 489 |
| JPYC Avalanche | 200 | 7 | 473 |
| JPYSC Ethereum | 200 | 5 | 306 |

receiptSHA256 `8504a1045cfac430507f00ba25fbdf5ddfb2202eb3304aab5939a5b5b43d39a1`. 원문/URL/키는 Git·웹에 게시하지 않는다.

## 정규화·기존 자료 재사용

기간은 원래2026-10-21~27이다. 새13쌍×7일=91개 논리 행 중 OBSERVED89/MISSING2다. JPYSC Ethereum의 2026-10-24와25 bucket이 응답에 없어 두 행의 금액/건수/providerTime을 null로 보존했다. 원인이나 실제 전송0을 단정하지 않는다. 실제 응답의 0은 그대로 보존하고 누락에0을 생성하지 않았다.

strict parser로 숫자 lexeme을 검증해 USD 십진 문자열과 전송 건수 정수 문자열을 유지했다. 원래 providerTime/queriedAt/sourceHash를 보존하고 transfer-containing transaction count는 null이다. PROVIDER_DAY·집계시간대UNKNOWN·일말 하위초 경계미확인을 유지한다. 전송건수를 사용자 수/활성지갑/DEX/결제량으로 해석하지 않는다. 각 주소는 저장 검토 후보/브리지 범위를 유지하며 현행 발행사/배포 지원 인증으로 승격하지 않는다.

확보 원문의hash/receipt/authorization/승인/intent/HTTP상태/정확인자와 rows를 오프라인 대조해 새91행을 사설 저장했다. 검토본hash `ace3445eb0cddcf3e46895883a10310cc2941a325196e4a2fa7a619a0245e65b`.

기존5쌍/35관측은 기존 projectUsageArchive로 원본부터 재검증했고, 실제 DB 입력에 사용했던 기존 reviewed-input.json과 canonical 전체가 같았다. 네트워크/DB 호출 없이 재사용해 총18쌍/126논리행 = OBSERVED124/MISSING2의 사설 통합 검토본을 만들었다. 통합hash `21f32e127bc89237fa136b331c17cd8e4a1317eec1045f36e7d14191e99554fc`. 등록33 중 나머지15쌍은 chain목록미등재13/정확주소미확보2로 NOT_TESTED 상태를 유지한다.

## 구현·검증·실패

`tools/arkham-usage-expansion.mjs`는 정확한 고정 계획 hash와 소스4pin만 허용한다. 기존 검증된 경계를 유지해 intent/소비·상한·첫 실패 종료·partial 보존·getReader·strict UTF-8/중복키/금액 정밀도를 검사한다. public 자동 실행 CLI/웹/스케줄 경로를 추가하지 않았다.

- 관련 회귀: `node --use-env-proxy --import tsx --test tests/arkham-usage-expansion.test.mjs tests/network-usage.test.mjs` → 26pass/0fail.
- 전체: `npm run check` → 일반672 + net차단74 = 총746pass/0fail.
- 검증: 고정13 URL/주소/기간/간격/AbortSignal, 403/429/redirect/timeout/partial/oversize/UTF-8/중복키/proxy, 제3요청실패 후 미송신, 만료/잠금/승인변조/재소비거절, 정확2MiB/빈배열/2^53초과 정수·십진 정밀도, 원본 보존.
- Lead39a3bfafac404a949756f9540027430d는 가상14회귀 통과와 한도 검토 proceed를 확인했다. 실제 사용자 승인과 구분했다.
- 이번 구현/실행의 실패는 없었다. JPYSC 두 bucket 부재는 수집 도구 실패/실제0과 구분했다.

사설 재현 경로 `.state/usage-expansion-live-20261028`의 approval/collect/review/combine 스크립트와 로그·reviewed-rows.json·combined-review.json, 위 슬롯의 원문/intent/receipt다. collect는 소비 완료이므로 다시 실행하지 않는다. review/combine은 새 사설 출력 경로로만 오프라인 재현하고 원본을 덮어쓰지 않는다.

## 남은 범위

Supabase의 기존 schemaVersion1/5쌍·35행 snapshot과 reader/UI는 그대로다. 새 사설 검토본은 DB 입력payload가 아니다. 18쌍/미확보15쌍/누락2일을 표시하는 후속 DB/UI 확장은 기존v1/원본/권한을 보존할 별도 설계·사설PG 검증·실제 적용 승인 범위다. 추가 지원/정확주소 조사·새 endpoint 호출·자동수집도 이13GET 승인에 포함하지 않는다. Allium 신규수집 차단과 키전달 제거를 유지하며 운영 Mac mini에 배포하지 않았다.
