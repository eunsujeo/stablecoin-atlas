# ADR0047: 일별 발행량과 네트워크 증감률 비교

2026-10-22 · 사용자 요청: XRPL이0처럼 보이는 공통 공급량 축을 개선하고, Overview의 최근 공급량 자료를 제거한다. 오늘까지의 자료이므로 화면 이름에 ‘과거’를 붙이지 않는다. 앞선 사용자 단독 검증·DB 적용 승인을 유지한다.

## 화면

Overview는 `일별 유통량`과 `일별 발행량`을 선택한다. 최신 일별 원본 기준일까지의30일/3개월/1년을 보여준다. Arkham의 최근 총공급량은 기존 Market 화면과 원본 저장에 유지하며 Overview 차트에서 자동 fallback으로 사용하지 않는다. 일별 이력이 없으면 미확보 상태다.

기본 비교는 선택 구간의 네트워크별 첫 관측 대비 증감률(%)이다. 작은 네트워크도 자기 규모를 기준으로 변화를 읽을 수 있다. `공급량 규모`는 기존 공통0 기준 tokens 축으로 전환한다. 별도 축을 숨겨 같은 수량으로 오해하게 만들지 않는다. 범례·옆 비교표·tooltip은 실제 수량을 유지하고 tooltip에 원본 기준일·증감률 기준일을 표시한다. 구간/토큰/지표 변경 시 기준 관측도 해당 구간으로 바뀐다.

증감률은 `(관측수량−기준수량)×100/기준수량`을 bigint 고정소수로 계산한다. 감소를 음수로 표시하고0%를 포함하는 공통 축으로 그린다. 원본 수량은 변경하지 않는다. 최초 관측이0이면 해당 네트워크의 증감률을 계산하지 않고 이름과 이유를 알린다. 공급량 규모에서는 그 네트워크의 실제0과 후속 관측을 계속 볼 수 있다. 모든 기준이0이면 빈 상태를 표시한다.

## 지표와 provenance

기존 DeFiLlama 원문의 `minted.peggedUSD`를 별도 NETWORK_MINTED로 정규화한다. 이는 공급자의 네트워크별 발행량이며 특정 계약의 totalSupply나 검증 판정으로 인증하지 않는다. NETWORK_CIRCULATING과 동일 원문 hash를 공유하지만 별도 metric/이력이다. minted 필드가 누락되면 circulating 값으로 대체하지 않는다. 기존 원문을 재사용하므로 이번 추가 등록은 공급자 API0회다.

## DB v2

기존 [ADR0046](0046-daily-network-circulation-history.md)의 v1 SQL/hash와 기존 불변 circulating payload를 보존한다. `002-supply-metric.sql`은 metric 열과 coin+metric+sourcehash+기간 고유키·최신 metric별 인덱스를 추가한다. v1 행은 NETWORK_CIRCULATING으로 유지한다. 정확한 v1 fingerprint를 확인한 뒤 명시 owner `market:history:upgrade`가 advisory lock/transaction 안에서 적용한다. 실패는 전체 rollback하며 동시 upgrade는 한 번만 반영된다.

migration 기록은 원본 v1 hash와 v2 hash/현재 구조 hash를 각각 보존한다. reader는 검증된 v1을 계속 읽을 수 있지만 새 import는 v2를 요구한다. 새 프로젝트 init은 v1/v2를 같은 transaction으로 설치한다. reader의 SELECT/RLS·불변 trigger·PUBLIC/API 역할·함수 권한 검사를 유지한다. 기존 market/catalog 구조·facts·역할은 바꾸지 않는다.

읽기 한도는3자산×2지표, 각4개 이내 등록 네트워크/최대366일, 전체16개 네트워크 시계열/512KiB다. 같은 read-only snapshot에서 최신 coin+metric을 최대6개만 읽으며 metric 필드와 DB 열을 다시 대조한다. 기존2MiB HTTP 제한을 유지한다. 동일 원문/metric/기간 import는 멱등이며 새 지표가 기존 유통량을 덮어쓰지 않는다.

## 검증

서로2000배 다른 수량의 동일20% 변화, 음수 감소·0 기준·평탄/단일/큰 소수값을 시험한다. 실제 PG17 v1→v2 불변 payload 유지·병렬 upgrade·동일 hash의 두 metric 저장/멱등성 및 기존 권한/원자성/snapshot 검사를 수행한다. 실제 Supabase는3개 발행량 snapshot을 추가해6개 snapshot/16개 네트워크 시계열/5856개 일별 값을 보유한다. 원 유통량3개 payload·시장462/네트워크78 facts와 core fingerprint는 그대로다. 화면은16개 시계열의 원본 수량·기준일·증감률/규모 전환·기간/모바일/누락 기준·비Fallback을 확인한다. 최종 검사 수는 최신 인계문에 기록한다.
