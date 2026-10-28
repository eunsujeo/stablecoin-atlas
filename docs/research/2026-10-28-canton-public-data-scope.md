# Canton 공개 자료 범위 — 연구 후보

사용자는 Canton 자료 존재를 물었고 CC와USDCx를 구분하는 방향에 동의했다. 이 기록은 앞선2026-10-28 공식문서 확인 내용을 정리한 것이다. 제품 등록/Adapter/DB/UI데이터/자동수집 대상은 추가하지 않았으며 Canton API 실호출0이다. 기존33등록조합·18수집대상·30일540GET 승인 정책은 변경하지 않는다.

## 확인한 공개 자료

[공식 Splice Scan APIs](https://docs.sync.global/app_dev/scan_api/index.html)는 SV participant가 DSO party 관점에서 보는 이력/상태를 제공한다. CC 전송·거버넌스가 포함되지만 CC와 상호작용하지 않는 대부분의 custom Daml app 데이터는 제외될 수 있다. bulk API의 ‘full history’는 해당SV/party의 관측 범위이며 Canton 전체 거래 그래프라는 뜻이 아니다.

[공식 Scan Aggregates](https://docs.sync.global/app_dev/scan_api/scan_aggregates_api.html)는 Amulet(CC) holdings/fees/ANS 등 읽기 예시를 설명한다. 이것을 USDCx 공급량·전체 전송량으로 바꾸지 않는다. party별 조회 예시가 있다고 해서 전체 계정/보유자 열거를 승인한 것도 아니다.

[Circle 공식 USDCx 공지](https://www.circle.com/blog/usdcx-on-canton-now-available-via-circle-xreserve)는 Ethereum의 xReserve에 USDC를 예치하면 Canton의 protocol이 USDCx mint를 시작하는 구조와 mainnet InstrumentId를 제시한다. USDCx는 별도 자산 후보로 취급하며 기존 USDC 수치와 무조건 합치지 않는다. 해당 공지의 식별자 설명은 최신 live binding/전체 공급량/전송 index 검증이 아니다.

## 구분할 연구 지표

| 후보 | 현재 근거 | 미확인 |
| --- | --- | --- |
| CC 공개 활동 | DSO 관측 Scan 이력·운영 reference 문서 | 실제 mainnet endpoint/접근/응답/기간·중복제거·집계 의미 |
| USDCx | 공식 자산 설명과 InstrumentId | 전체 공급/전송 자료의 공개 범위·API 접근·정확한 집계 |
| Canton 전체 결제/활성 사용자/거래량 | 이 공개문서로 인증하지 않음 | private app을 포함한 전체 관측 범위 |

전송 이벤트/ledger update/event tree의 의미와 중복을 먼저 확인해야 한다. CC 공개 전송 수를 사람 수/결제 수로, xReserve 입출금을 Canton 내부 전체 활동으로 바꾸지 않는다. Ethereum/TRON/Solana의 같은 토큰·지표와 비교할 때도 자산/관측 범위 차이를 명시해야 한다.

후속 실제 수집에는 mainnet 공식 Scan 위치·정확한endpoint/인자/기간/요청·bytes·시간·비용 상태·새 영속 슬롯과 실패 종료를 고정한 별도 계획이 필요하다. 기존 Arkham 단발 소비나 18대상 자동수집 예산을 Canton 조회로 전용하지 않는다. 현재는 문서 연구이며 수집 가능/미지원 여부를 실제 결과로 확정하지 않았다.

## 수집 가능성 재확인 — 공식 문서 기준

추가 질문에 따라 공식 [Scan Bulk Data](https://docs.sync.global/app_dev/scan_api/scan_bulk_data_api.html)와 [OpenAPI Reference](https://docs.sync.global/app_dev/scan_api/scan_openapi.html)를 다시 확인했다. `POST /v2/updates`는 관측된 거래/event tree 이력을 읽고, `GET /v2/updates/{update_id}`는 단건 이력, `GET /v0/state/acs/snapshot-timestamp`와`POST /v0/state/acs`는 상태snapshot 조회 경로다. 읽기POST를 ledger 명령 제출/거래서명과 구분한다. 문서상 CC 공개자료 수집 경로가 있으며 실제메인넷 응답·인증·비용·페이지/완전성은 아직 확인하지 않았다.

Scan의 공개범위는 DSO 관측으로 제한되므로 이를 Canton 전체기관결제/전체자산전송으로 일반화하지 않는다. USDCx의 전체 공급/전송 공개자료는 여전히 별도확인이 필요하다.

[공식 SV 디렉터리](https://sync.global/sv-network/)는 Canton Foundation 상태페이지로 연결되고 정적 HTML의 mainnet node 표는 Loading이었다. 렌더링된endpoint목록을 확보한 것으로 표시하지 않으며 자료부재로 단정하지 않는다. 문서 예시의 unknown_cluster host/의도적으로변형된DSOpartyID는 실입력으로 쓰지 않는다. 문서가 가리키는 pinned scan.yaml GitHub 조회는 도구에서404였으나 공식 HTML OpenAPI Reference는 읽었으며 API 부재를 뜻하지 않는다. 이번에도 Canton live API·키·DB·등록·수집대상확대는0이다.
