# TRONSCAN 저장 HTML 진단과 후속 소스 확보

사용자가 제공한 TRON USDT 계약 HTML을 정적으로 확인했다. 원본은2,462,770 bytes, SHA-256 `1e56c3624c543494e54e4f5eee9b823a30cd9f3d413437d0e6fe9332a4c71151`이며 변경하지 않았다. HTML/JavaScript를 실행하거나 페이지 자원을 외부에서 가져오지 않았다.

## 당시 HTML은 전체 소스가 아니었다

10개 Monaco editor의 DOM에는 각각1~17번 줄만 저장돼 있다. 이름은 BasicToken, BlackList, Migrations, MultiSigWallet, Ownable, Pausable, SafeMath, StandardToken, StandardTokenWithFees, TetherToken.sol이다. 총170개 렌더 줄이며 나머지 함수 본문을 복원할 전체 소스 데이터는 찾지 못했다. 저장된 Next hydration 데이터에도 Solidity pragma/source bundle이 없었다.

RLUSD의 저장 HTML에는 원문 source bundle이 있었지만 이번 TRONSCAN 파일은 편집기의 보이는 줄 조각만 담고 있다. 이를 완전한 `.sol` 파일로 저장하거나 Ethereum USDT 소스로 빈 부분을 채우지 않았다. 당시에는 함수 내부·권한 조건·import closure가 미확인이었다. [부분 자료 진단](research/tron-html-intake.json)의 SOURCE_NOT_AVAILABLE을 유지한다. 이 상태는 계약의 소스/기능 부재를 의미하지 않는다.

## 원본 페이지에서 한 번에 내보내기

[로컬 내보내기 도우미](../tools/research/export-tron-editor-sources.js)를 준비했고, 같은 파일을 [사용자 폴더](../source-intake/tron-usdt/export-tron-sources.js)에도 복사했다.

1. 저장 HTML이 아닌, 현재 열려 있는 원본 TRONSCAN USDT Code 페이지에서 개발자 도구 Console을 연다(Chrome/macOS: ⌥⌘J).
2. `export-tron-sources.js` 내용을 한 번 실행한다.
3. 정상적으로 내보내지면 내려받은 `tron-usdt-editor-sources.json`을 `source-intake/tron-usdt/`에 넣는다.

helper는 정확한 HTTPS origin·계약 route를 확인하고, **이미 존재하는** global Monaco의 Solidity model만 읽어 로컬 Blob JSON을 만든다. helper 자체에는 fetch/XHR·외부 script/import/require·페이지 reload/자동 스크롤·쿠키/storage/지갑 접근·업로드가 없다. 임시 anchor/Blob URL은 정리한다. 페이지 자체의 별도 백그라운드 통신까지 제어한다는 뜻은 아니다.

기존 Monaco 전역 API가 없거나 모델/파일 수가 예상과 다르면 오류로 종료하며 다른 방법으로 자동 접근하지 않는다. file URI의 query/credentials와 전체 HTML은 export하지 않는다. UI 파일명과 model의 연결은 미확인 후보로 구분하고 본문을 재포맷하지 않는다. 이전 방문 model이나 lazy loading 등의 가능성 때문에 실제 도착 JSON의 파일·내용·import 연결을 후속 로컬 대조해야 한다. helper mock 테스트는 실제 브라우저 실행 검증과 구분한다. 이후 사용자가 내보낸 JSON이 도착했으며 아래 후속 결과를 따른다.

## 검증

로컬 mock DOM/Monaco에서 정확한 origin/route·주소, Solidity 필터, 내용 escape 보존, API 없음/빈 값/읽기 오류/중복/과대/누락·파일명 이상 거부, 다운로드·정리와 오류 경로를 확인했다. 비Solidity 모델 내용·네트워크·지갑·storage/cookie 접근은0건이었다. `node --check`도 통과했다. 제공된 HTML을 브라우저에서 실행한 테스트는 아니다.

기존 소스/판정과 보고서는 그대로다. 서비스 지갑 자료·실제 권한 행사·운영 키는 이 작업에 필요하지 않다.

전체 `npm run check`는184개 통과, 실패·skip0이다. 이는 helper의 로컬 검증을 포함한 저장소 검사이며 실제 사용자 브라우저 export 성공을 뜻하지 않는다. 원본 HTML·부분 상태·helper 사본·기존15개 보고서/catalog hash와 문서 링크를 대조했다.

## 후속 JSON 확보 완료

2026-10-21 사용자가 내보낸 JSON에서10개 전체 소스·9개 로컬 import·토큰 경로8개 파일을 확인했다. [새 소스 검토](TRON_EXPORTED_SOURCE_REVIEW.md)와 [별도 JSON](research/tron-export-source-review.json)에 출처/hash·추론 파일명·10개 findings를 기록했다. 새 snapshot의 선택 경로는 SOURCE_REVIEWED이며 위 HTML 단독 SOURCE_NOT_AVAILABLE은 당시 입력 진단으로 보존한다. 배포 동일성 UNKNOWN·실제 권한 행사 NOT_TESTED는 유지한다.
