# ADR0045: DB 기본정보 카탈로그와 토큰 설명 툴팁

2026-10-22 · 사용자 요청: 토큰/네트워크의 기본정보를 DB에 저장하고 마우스오버로 설명한다.

## 저장과 검토 범위

기존 `atlas_market.deployment`는 주소·mint·issuer/currency를 이미 저장한다. 별도 private `atlas_catalog`에 표준·짧은 자산/네트워크 설명·식별자 스냅샷·공식 출처 URL·확인시각·revision·내용 hash를 append-only로 보관한다. 수집 fact/시장 지표/시나리오 판정과 분리하며 SOURCE_REVIEWED 성격의 연구 메타다. 기본정보가 있다고 지원/PASS로 바꾸지 않는다. 기존 market v1 SQL/hash/권한은 유지하고 catalog FK 추가 후에도 기존 fingerprint가 일치해야 한다.

고정8개 프로필은 [검토 JSON](../../data/token-profiles.json)에 보관한다. 2026-10-22 [Circle 주소](https://developers.circle.com/stablecoins/usdc-contract-addresses), [Tether 프로토콜](https://tether.to/en/supported-protocols/), [Ripple 주소](https://docs.ripple.com/products/stablecoin/overview/token-addresses)와 [표준](https://docs.ripple.com/products/stablecoin/overview/supported-chains-and-networks)을 재확인했다. Tether 본문 렌더링에서 빠진 주소는 같은 공식 페이지의 HTTP200 HTML에서 현재3개 주소를 확인했다. Solana 표준은 기존 mint 관측의 Token program 범위와 일치한다. 출처 확인은 문서 검토이며 새 체인 실행/원장 인증이나 현재 관리자 권한 행사가 아니다.

## 명시 관리와 읽기

`market:catalog:init/import/grant`는 명시 owner CLI다. schema 자체 hash/구조/정책·PUBLIC/Supabase API 역할·함수 EXECUTE를 검사하고 FORCE RLS를 적용한다. reader는 SELECT만, 기존 market writer는 catalog 권한을 받지 않는다. 웹/collector는 설치·갱신·권한 상승을 하지 않는다. private schema를 Data API exposed schemas에 넣지 않는다. 관리자 URL은 비공개 env 파일에서만 읽으며 현재 writer `.env.local`을 바꾸지 않는다.

import는 advisory lock/transaction/고유키로 동일 revision의 동일 내용만 UNCHANGED로 인정한다. 내용이 다르면 전체 rollback한다. 새 revision은 기존보다 커야 하고 확인시각이 역행하지 않아야 한다. 동시 import는 하나만 새 행을 등록한다. 갱신은 새 revision이며 fact/이전 metadata를 덮어쓰지 않는다.

기존 DB market snapshot의 같은 READ ONLY REPEATABLE READ transaction에서 최신 revision을 읽어 core identity/registry와 내용 hash를 대조한다. 최대256개+1 검출/256KiB DTO/공식 HTTPS URL allowlist/문자열 길이를 검증한다. catalog schema 없음만 빈 프로필이며, 설치 후 권한·정책·구조·식별자·내용 오류는503이다. 서버에서 출처 URL을 자동 호출하지 않는다. 기본 JSON 모드는 DB 프로필로 가장하지 않으며 정보 버튼이 없을 수 있다.

## 화면

Overview 네트워크별 차트 범례와 시장의 네트워크/원본 목록에 정보 버튼을 둔다. hover/focus는 설명 패널을, 클릭·터치는 고정 패널을 연다. 출처 링크가 있으므로 비모달 dialog로 표시한다. Escape·바깥 클릭으로 닫고 키보드 focus를 복원한다. 뷰포트에 위치/폭/높이를 제한하고 선택 변경으로 원래 버튼이 없어지면 닫는다. DOM textContent로만 설명/주소를 표시하며 HTML을 주입하지 않는다. 공식 URL만 링크한다.

## 검증

PG17 실제 owner/reader/writer와 RLS/열 권한·PUBLIC 함수·trigger 변조·동시 import/충돌 rollback/새 revision snapshot 일관성 및 core fingerprint 유지 시험을 수행한다. 실제 Supabase 등록/재등록/reader 조회와 시장 fact 보존, UI pointer/focus/Enter/Escape/mobile/XSS는 인계문에 결과를 기록한다.
