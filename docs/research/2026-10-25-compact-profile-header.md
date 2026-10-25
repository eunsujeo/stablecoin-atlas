# 검토 네트워크 범위 설명과 프로필 헤더 축소

## 사용자 요청과 확인

사용자는 USDC/USDT/RLUSD가 Ethereum에만 배포됐는지 질문하고 첨부 화면의 TOKEN PROFILE·JPYC·Ethereum/chainId 영역이 너무 크다고 지적했다. 실제 선택기는 기존 소스 검토5자산8프로필만 포함했는데 배포 네트워크/배포 수로 표시해 전체 배포 목록으로 오해하기 쉬웠다. 큰 자산 헤더도 바로 위 선택 정보와 중복됐다.

2026-10-25 공개 공식 페이지의 웹 텍스트를 확인했다. 아래 예시는 전체 목록이나 새 지원/주소 인증이 아니다.

- [Circle USDC 공식 FAQ](https://www.circle.com/usdc)는 Ethereum 외 Solana·XRPL 등도 명시한다.
- [Tether 공식 Supported Protocols](https://tether.to/en/supported-protocols/)는 USDt의 Ethereum 외 TRON·Solana 등의 네트워크를 명시한다. 종료된 protocol 섹션과 현재 supported 섹션을 구분했다.
- [Ripple RLUSD 공식 FAQ](https://ripple.com/products/stablecoin/)는 Ethereum 외 XRP Ledger·Base·Optimism 등을 명시한다. 전체 설명에는 as available 조건이 있어 모든 네트워크를 같은 native 발행/상환 경로로 일반화하지 않는다.

공식 웹 페이지 텍스트 확인은 새 체인 코드/RPC 관측이나 실제 배포 주소 검증이 아니다. 동적 페이지의 렌더링/정상 API 응답을 새로 확보했다고 주장하지 않는다. provider API/RPC·키·compiler 취득·등록 자산 변경은 하지 않았다.

## 변경과 범위

[ADR0100](../adr/0100-reviewed-source-asset-profiles.md)에 따라 배포 네트워크를 검토 네트워크로 바꾸고 8개 검토 프로필·검토1곳/4곳으로 표시한다. 목록은 전체 네트워크 목록과 다름을 안내한다. 새 체인의 소스 기능을 Ethereum 결과로 복제하지 않는다. 기존 명시 chainId/컨트랙트와14기능 분류/근거·원래 판정은 유지한다.

중복 hero와 TOKEN PROFILE 문구·큰 자산명·반복 network 줄·별도 completion 영역을 삭제했다. toolbar 한 줄에 자산명과 공통14기능·네트워크 선택을 제공한다. 탭은 toolbar 바로 아래에서 시작하고 상단 detail padding을 없앴다. 기본/Atlas 공통 컴포넌트와 모바일에 적용한다. 실제 캡처로 겹침 없이 검증 결과가 위로 이동한 것을 확인했다.

## 검증과 재현

구문/브라우저 검사는 첫 실행부터 통과했고 수집 도구 실패는 없었다. `node tools/source-review-browser-check.mjs http://127.0.0.1:4173`으로 실제 Chrome에서 hero/completion DOM과 TOKEN PROFILE 문구 없음·검토 네트워크 표시·탭이 toolbar 직후 시작함을 검사했다. 8프로필14기능/4필터·체인별 선택·검색·키보드·과거진단 DOM없음·근거503·비교/전체현황 회귀·다크/라이트1440/390px·JS오류0/외부요청0도 유지했다. 공식 페이지 확인에 사용한 웹 도구 요청과 로컬 UI 브라우저의 외부요청0은 별도 범위다.

로그 `.state/agent-logs/compact-profile-header-{browser,check}.log`, 실제 캡처 `.state/profile-redesign-{legacy,atlas}-{dark,light}{,-mobile}.png`와 모바일 헤더 `.state/profile-header-{legacy,atlas}-{dark,light}-mobile.png`. `node --check web/source-review.js`, `node --check tools/source-review-browser-check.mjs`, `npm run check`, `git diff --check` 최종 결과는 [인계문](../handoff/2026-10-25-compact-profile-header.md)에 기록한다. Chrome 종료·사용자용4173 유지.
