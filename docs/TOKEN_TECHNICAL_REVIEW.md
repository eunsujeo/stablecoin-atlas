# 읽기 전용 토큰 기술 검토 CLI

새 기준은 [ADR0090](adr/0090-readonly-token-technical-review.md), 후속1.1은 [ADR0091](adr/0091-offline-token-static-path-analysis.md), 고정 legacy compiler·저장 관측 대조1.2는 [ADR0092](adr/0092-pinned-legacy-compiler-and-archived-review.md)다. 기존 실행 시나리오 PASS/FAIL·연구 판정·대시보드와 별도로 사용한다. 코드의 정적 권한/특수 동작 경로, 명시 getter의 현재 값, 소스/runtime·감사 source snapshot 대조를 JSON·Markdown으로 보존한다. 보안 감사나 안전성/지원 승인이 아니다.

## 실행

Node.js24.5 이상과 `npm ci`로 설치한 기존 의존성을 사용한다. 실제 조회에는 EIP-1898을 지원하는 EVM RPC가 필요하다. RPC와 인증은 `RPC_URL` 환경변수로 전달한다. CLI 인자·JSON 설정에 인증 URL/키를 넣지 않는다. 다음 명령은 사용자가 선택한 RPC에 실제 읽기 요청을 보내므로 구현 검사에서 외부 RPC를 호출한 것으로 혼동하지 않는다.

```sh
mkdir -p reports/token-reviews
# RPC_URL은 현재 셸에 안전하게 설정한 상태
npm run review:token -- --config /private/intake/token.json --out reports/token-reviews/review-001
# 외부 호출 없이 로컬 소스·감사 동봉 소스만 분석 (RPC_URL 불필요)
npm run review:token -- --offline --config /private/intake/token.json --out reports/token-reviews/offline-001
# 원래 보고서를 보존하며 원래 블록의 코드와 오프라인 대조
npm run review:token -- --offline --observations /private/previous/report.json --config /private/intake/token.json --out reports/token-reviews/archived-001
```

`--out`은 아직 존재하지 않는 디렉터리여야 한다. 재실행 시 새 경로를 선택한다. 종료코드0은 분석 절차 완료,2는 수집/분석 일부 실패로 보고서가 생성됨,1은 입력/출력 등으로 절차를 완료하지 못함이다. 0이어도 확인 불가 항목이 남을 수 있으며 안전함을 뜻하지 않는다. `bundle.json`이 없으면 완성된 묶음으로 사용하지 않는다.

`--offline`이면 환경변수에 RPC가 있어도 사용하지 않고 체인 조회·재검증을 실행하지 않는다. 보고서 mode=OFFLINE, 기준 블록/체인 관측과 배포 연결은 미확인이다. 명시 chainId/주소는 제출 식별자이며 검증된 현재 배포로 표현하지 않는다.

`--observations`는 명시적인 `--offline`에서만 받는다. 기존 TokenTechnicalReview1.0/1.1/1.2의 실제 READ_ONLY 보고서를32MiB 한도·UTF8·구조/깊이·schema·근거 참조로 검사하고 config의 chainId/주소/명시 블록과 대조한다. 원래 블록/chain 재확인 기록, CONTRACT_CODE의 hash와 동일 EIP-1898 RPC의 반환 바이트를 확인한다. 보고서 안의 경로·URL은 따라가지 않는다. 원본 파일은 새 artifact로 그대로 보존하며 archive에 원래 시각/블록·SHA256을 기록한다. hash·내부 일관성은 원본 진위 인증이 아니므로 `SUPPLIED_REPORT_NOT_INDEPENDENTLY_ATTESTED`다. 새 보고서는 OFFLINE/현재 블록 null이고 정확 byte 일치도 현재 배포 binding UNKNOWN을 유지한다.

## 입력

새 설정은 [1.1 JSON Schema](../schemas/token-review-config.v1.1.schema.json)를 따른다. 기존 [1.0 설정](../schemas/token-review-config.v1.schema.json)도 그대로 받되 새 필드를 섞으면 거절한다. 아래의 주소와 chainId는 설명용 자리표시자이며 실제 값으로 교체해야 한다. 이름만 입력하거나 주소를 생략하는 경로는 없다.

```json
{
  "schemaVersion": "TokenReviewConfig1.1",
  "network": { "chainId": "<명시한 양의 정수 chainId>" },
  "token": { "address": "<확인한 0x 배포 주소>", "label": "USDC" },
  "dependencies": [],
  "sources": [
    {
      "address": "<소스를 연결할 정확한 배포 주소>",
      "contract": "Token.sol:Token",
      "compilerVersion": "<설치된 compiler의 전체 버전>",
      "inputFile": "./source.standard.json"
    }
  ],
  "probes": [
    {
      "id": "owner",
      "address": "<조회할 정확한 배포 주소>",
      "signature": "function owner() view returns (address)",
      "args": []
    }
  ],
  "audits": [
    {
      "file": "./audit.pdf",
      "title": "제출된 감사 자료",
      "publisher": "제출자가 기재한 발행자",
      "reference": "https://example.org/audit.pdf",
      "declaredTarget": { "version": "<자료에 기재된 버전>", "commit": "<자료에 기재된 commit>", "scope": ["Token.sol:Token"] },
      "sourceSnapshotFile": "./audit-sources.standard.json",
      "compareToAddress": "<대조할 분석 소스의 배포 주소>"
    }
  ]
}
```

- `sources`·`probes`·`audits`·`dependencies`는 선택 사항이다. 생략하면 해당 부분은 확인 불가다. reference는 HTTPS의 인증·query·fragment 없는 참고 URL만 받으며 자동으로 열지 않는다. 자료 경로는 설정 파일의 위치를 기준으로 해석한다.
- 블록을 명시하려면 `network.blockNumber`에 십진 문자열을 넣는다. 생략하면 시작 시 높이를 고정하고 헤더 해시를 확보한다. 체인/블록 불일치나 EIP-1898 미지원 시 대체 endpoint·높이·latest로 전환하지 않는다.
- 프록시와 구현체의 소스는 각각의 주소로 별도 등록한다. 고정 프록시 관측으로 찾은 구현체·beacon 외의 외부 의존성은 `dependencies`에 명시한다. 동적 의존성 자동 탐색·중첩 프록시 해석은 하지 않는다.
- 이름은 보고서 표시에만 쓴다. USDC·USDT·RLUSD·JPYSC·JPYC 및 다른 EVM 토큰은 동일 설정 경로를 사용하지만, 각 주소·소스·compiler·구조의 확보 여부에 따라 분석 가능 범위가 다르다. 이름이 지원/검증을 보증하지 않는다.

compiler 전체 버전은 외부 호출 없이 다음으로 확인한다.

보고서 `tools.compiler`는 설치된 버전이며, 소스별 `compilerUsed`는 반환된 실제 compiler 버전이다. 실행 전 입력 실패/미지원 버전이면 NOT_RUN, worker 실패로 사용 버전을 확정하지 못하면 UNCONFIRMED로 구분한다.

compilerVersion이 `0.6.12+commit.27d51765.Emscripten.clang`이면 고정 registry의 기존 `.state/usdc-source/compiler/soljson.js` 캐시를 사용할 수 있다. SHA256 `3e1956c550ca48e289044c7c0bd892403081b4b5e17e77ce707c815ce6c4228f`와 소유자·regular file·nofollow/32MiB 조건을 확인한 바이트만 전용0700 임시 디렉터리/0600 CJS로 staging한다. worker에서 hash·전체 버전을 재확인하고 parent가 종료/오류/timeout에 정리한다. 캐시가 없거나 다르면 다운로드·다른 버전으로 대체하지 않는다. `COMPILER_PROFILE` 근거에 pin·provenance·독립 인증 NOT_TESTED를 기록한다. 임의 실행 파일/URL/해시를 입력하는 옵션은 없다.

[ADR0094](adr/0094-pinned-solc-0811-browser-artifact.md)의 사용자 승인으로 확보한 `0.8.11+commit.d7f03943.Emscripten.clang`도 명시 고정 profile이다. 경로는 `.state/jpyc-solc-browser-artifact/soljson.js`, SHA256은 `64117d4b13bfc5bc6e5f80823519b140e753a0c09e99edd756772dc3029bc1f8`이며 같은 파일/staging/worker 경계를 적용한다. provenance는 `BROWSER_ACQUIRED_PINNED_CACHE`, 독립 인증은 NOT_TESTED다. CLI가 파일을 취득하거나 미확보 cache를 대체하지 않는다. 이 버전의 내장 require/assert/msg uint32 참조는 정확한 compiler 버전·이름·타입·선언 부재 조건으로만 인식한다.

[ADR0097](adr/0097-pinned-solc0418-visible-browser-profile.md)의 `0.4.18+commit.9cf6e910.Emscripten.clang`도 명시 고정 profile이다. 경로는 `.state/usdt-solc-0418-visible-browser-v2/soljson.js`, SHA256은 `905e3d253406973f545666d79cd64c5c85985992f68fa35935f60249e311d74f`이며 같은 검사/staging/worker 경계를 사용한다. [사용자 승인 브라우저 취득·사설 검증](research/2026-10-25-usdt-solc0418-browser-success.md)을 완료했고 provenance는 `BROWSER_ACQUIRED_PINNED_CACHE`, 독립 인증은 NOT_TESTED다. 구버전의 isConstructor/name과 선언 없는 양수 builtin 참조는 정확한 전체 버전·이름/type 조건으로만 처리한다. AST selector 없는 선언은 ID별 보존하고 override 진입 선택 미확정을 남기며 `evm.methodIdentifiers`에서 추정 연결하지 않는다.

개발용 공식 compiler 취득이 거절될 때의 후속 기본 경로는 사용자 지시로 [새 임시 브라우저 창 가이드](COMPILER_BROWSER_ACQUISITION.md)에 정리했다([ADR0096](adr/0096-browser-compiler-acquisition-guidance.md)). CLI의 자동 다운로드 기능은 아니다. 0.4.18의 [이전 직접 실패](research/2026-10-25-usdt-compiler-acquisition.md)와 첫 브라우저 준비 실패는 보존하고, 수정본의 새 승인 취득/검증과 구분한다.

```sh
node --input-type=module -e 'import solc from "solc"; console.log(solc.version())'
```

소스 파일은 Solidity standard JSON이며 모든 import 내용을 `sources[가상경로].content`로 제공한다. 가상경로의 절대경로·`..`·URL 항목을 거절한다. 외부 파일/URL import callback이나 빌드 스크립트는 실행하지 않는다. 예:

```json
{
  "language": "Solidity",
  "sources": {
    "Token.sol": { "content": "<선택 계약 및 모든 의존성의 실제 Solidity 원문>" }
  },
  "settings": {
    "optimizer": { "enabled": true, "runs": 200 },
    "evmVersion": "shanghai"
  }
}
```

실제 배포에 사용한 compiler·optimizer·EVM target·libraries·metadata 등의 설정을 제공해야 한다. outputSelection만 도구가 AST·ABI·runtime 출력용으로 교체하며 실효 입력도 저장한다. library는 `settings.libraries[소스 경로][library 이름]`에 정확한 주소를 주고 compiler로 링크한다. 관련 주소의 코드 관측은 명시 `dependencies`를 사용한다. library 코드의 소스 연결·외부 효과는 별도 확인 대상이다. 허용 compiler profile이 없거나 컴파일 실패, 전체 runtime 불일치, 미확정 링크는 배포 연결 UNKNOWN이다. 오래된 Solidity 버전을 자동 다운로드하거나 pragma를 수정하지 않는다.

1.1 소스 항목의 선택 `immutableValues`는 compiler가 낸 immutable AST ID를 키로, 정확히32바이트인 `0x` hex를 값으로 받는다. 예: `"immutableValues": { "123": "0x000000000000000000000000000000000000000000000000000000000000002a" }`. 실제 ID는 저장된 compiler 결과를 확인하며 추측하지 않는다. 원본 offset·길이·범위·중첩·0 placeholder·누락/추가 입력을 검사하고 원본/제출값/전체 치환 결과를 저장한다. 배포 코드를 가리거나 metadata를 제거하지 않는다. 전체 일치해도 `SUBMITTED_IMMUTABLE_VALUES` 비교이며 생성자 실행과 값 근거가 미증명이라 배포 연결은 UNKNOWN이다. 값이 없으면 임의로 배포 코드에서 추출하지 않는다.

Getter는 `owner/pendingOwner/admin/masterMinter/blacklister/pauser/feeRecipient() → address`, `paused() → bool`, `totalSupply/cap/maxSupply/fee/feeBps() → uint256`, `decimals() → uint8`, `getRoleAdmin(bytes32) → bytes32`, `hasRole(bytes32,address) → bool`, `isMinter/isBlacklisted/blacklisted/whitelisted/allowlisted(address) → bool`, `minterAllowance/minters(address) → uint256`만 허용한다. 명시한 ABI가 이 형식과 정확히 맞아야 한다. 이름이 같아도 실패할 수 있으며 실패는 기능 부재가 아니다. 새 getter는 코드의 허용목록을 검토해서 추가한다. 전체 권한자 열거·로그 전수 조회는 하지 않는다.

## 결과와 해석

[ADR0098](adr/0098-legacy-runtime-omitted-immutable-ranges.md)에 따라 정확한 고정 solc0.4.18 전체 버전에서만 `immutableReferences` 필드 자체의 생략을 내부 빈 범위로 해석한다. 원본 compiler artifact는 그대로 저장한다. 다른/미지정 버전의 누락과 명시 undefined/null/배열·잘못된 범위·linkReferences 누락은 계속 거절한다. 제출값 초과·미해결 링크·전체 바이트 대조와 기존 UNKNOWN/binding 규칙은 유지한다. 이 보완은 사설 Fixture로만 검증했으며 기존 USDT 보고서를 재판정하지 않았다.

- `report.json`: [1.2 결과 Schema](../schemas/token-technical-review.v1.2.schema.json), 모드·시각·블록·주소·코드 해시·도구/규칙 버전·archive·분류·확인 상태·실패·근거 참조. 기존 [1.0](../schemas/token-technical-review.v1.schema.json)/[1.1](../schemas/token-technical-review.v1.1.schema.json) 결과와 schema도 보존하고 검증에서 구분한다.
- `report.md`: 배포 구조, 소스/runtime 대조, 소스 선언·정적 진입 경로·저장값별 변경 진입점·동작 후보·감사 동봉 소스 차이·실패·한계.
- `artifacts/`: 제공된 소스 standard JSON·실효 compiler 요청·compiler 결과·감사 원문. JSON evidence에 각 SHA256/바이트 수와 RPC 요청/검증된 반환값을 기록한다.
- `bundle.json`: 위 파일들의 SHA256과 길이. 완료 시 마지막으로 기록한다. 소유 디렉터리0700/파일0600이며 Git이나 웹에 자동 게시하지 않는다.

분류와 확인 상태는 별도다. 관리 기능·비표준 동작·취약점 후보·현재 상태를 중복 분류할 수 있다. 이름으로 찾은 관리 기능과 저수준 호출 검토 지점은 UNKNOWN이며 취약점 확정이 아니다. 선언·ABI 차이·정적 관계와 내장 require의 직접 `msg.sender == 주소형 저장값` 구문은 SOURCE 사실로 확인한다. 이 조건이 모든 경로에 적용된다는 뜻은 아니다. OR 우회와 사용자 함수 require는 같은 직접 caller 조건으로 확정하지 않는다.

`sources[].staticAnalysis`는 compiler 선언 ID·타입·상속 순서로 진입 함수에서 modifier·내부 호출·조건·저장값 변경을 추적한다. 같은 selector는 가장 구체적인 상속 선언을 진입점으로 선택한다. 관련 선언/조건과 저장값별 변경 진입점이 보고서에 함께 나타난다. virtual/super·인자 미치환·외부 호출·storage alias·assembly·순환·modifier _ 전후/다중 실행·절단은 `uncertainties`에 남기고 `authorityConclusion=UNKNOWN`을 유지한다. 연관 선언 목록은 실제 실행 순서나 도달성 증명이 아니다.

compiler가 selector를 제공하지 않는 함수는 서로 합치거나 transfer 여부를 추측하지 않고 별도 진입점·SELECTOR_NOT_ESTABLISHED로 남긴다. sourceUnit/ABI의 미지원 형태를 기능 부재로 판정하지 않는다.

타입 기반 구문 패턴은 false 반환, 승인 경로의 중첩 mapping0비교, 주소 조건, 곱셈/나눗셈, 외부 호출/assembly, 전송 selector 밖의 address→uint mapping 대입을 표시한다. 수수료·rebase·잔액 의미·주소 제한·콜백 취약점은 여전히 후보이며 UNKNOWN이다. snippet400자, 기존 선언 inventory의 호출·조건·대입·반환 각32개/modifier16개 제한이 있다. 정적 그래프는 진입64개·선언32/진입·조건32/진입·쓰기64/진입·호출64/진입·패턴64/진입·저장 변수256을 제한한다. 한도 도달은 별도 실패로 보존하며 전체 소스는 유지한다. 추출되지 않음을 미발견/안전으로 바꾸지 않는다.

SOURCE 사실은 제공된 소스 범위이며 배포 연결과 다르다. CHAIN 사실은 블록 일관성 확인이 필요하다. `contracts`·`proxy`·RPC evidence는 원래 관측이며, 재조직/오류 뒤에도 이를 삭제하지 않는다. 유효한 결론은 `block.consistency`와 findings의 확인 상태를 함께 읽는다. getter 반환값은 실제 권한 행사나 EOA의 단일 개인 소유 증명이 아니다. 감사 파일의 hash도 진위·대상 commit/범위·배포 대응을 증명하지 않는다. 현재 감사 의미 분석은 미지원이며 UNKNOWN이다.

감사의 `declaredTarget`은 선택적인 제출 메타데이터다. 버전·commit·범위를 기록할 수 있지만 문서에서 자동 추출하거나 사실로 인증하지 않는다. 소스 이름/버전 문자열이 맞는다는 이유로 현재 배포와 대응한다고 판정하지 않는다.

1.1의 `sourceSnapshotFile`과 `compareToAddress`는 함께 주거나 함께 생략한다. 동봉 snapshot은 인라인 Solidity standard JSON이며 자동 다운로드/빌드하지 않는다. `sourceComparison`에 두 소스의 정확한 경로 집합·content UTF8 바이트 hash·SAME/DIFFERENT/누락/추가와 빌드 설정 객체의 MATCH/MISMATCH를 기록한다. 원시 JSON 포장 공백·키 순서는 소스 바이트 비교에 포함하지 않고, compiler 기본값의 의미상 동등성은 추정하지 않는다. snapshot이 실제 감사 대상이라는 연관·진위·감사 범위·현재 배포 대응은 UNKNOWN이다. 현재 감사 문서의 의미 분석은 미지원이다.

초기 자동 분석에는 `분석 범위에서 미발견`을 안전성의 대용으로 사용하지 않는다. 분석 커버리지·미확인과 실행 실패를 별도 기록한다. `COMPLETED`는 누락된 분석의 완료나 전문 감사 완료가 아니다.

## 한도와 미지원

RPC 최대128회·120초·각 응답2MiB/합계8MiB·요청10초·재시도0·redirect 거절이다. eth_call은 인식한 주소·고정 getter/프록시 조회만, gas500,000/value0/고정 해시로 실행한다. 설정64KiB·소스 최대8묶음/각1MiB/가상 소스32개·감사4개/각2MiB·명시 의존성8개·getter24개다. 컴파일 worker는 각20초·V8 heap256MiB·입력2MiB/출력8MiB다. heap 한도는 전체 RSS/보안 sandbox 보장이 아니다. child의 NODE_OPTIONS/NODE_PATH 주입을 제거하며 관리형 proxy 변수는 유지한다. 외부 빌드 스크립트·package hook을 실행하지 않는다. 함수256개/묶음·소스 분석 근거 합계4MiB·최종 JSON32MiB를 제한한다. 저장 관측은32MiB·깊이128·노드500,000으로 제한한다. 실패 원문·RPC 인증정보를 로그에 출력하지 않는다.

AI·Slither는 **NOT_RUN**이다. Trail of Bits [token-integration-analyzer](https://github.com/trailofbits/skills/blob/main/plugins/building-secure-contracts/skills/token-integration-analyzer/SKILL.md)의 관리자 권한·비표준 동작 항목을 참고했다. upstream commit은 이 구현에서 고정/실행하지 않았으며 자체 규칙 버전으로 추적한다. 전체 스킬·분포/상장 평가·예시 위험 등급을 적용하지 않고 Trail of Bits의 직접 감사로 표현하지 않는다.

비EVM·브리지 자동 판별·준비자산·내부 키 관리·합의/최종성·지갑 입출금/원장/sweep·가격/보유자/유동성·전송/승인/서명·퍼징·상시 감시·대시보드는 이 경로에 없다. 새로운 LLM 호출이나 compiler 자동 설치는 추가하지 않았다.

## 실제 검증한 범위

사용자 승인 [USDT 저장 소스 오프라인 재컴파일](research/2026-10-25-usdt-offline-recompile.md)은 고정0.4.18로1회 성공했다. 구버전 출력의 immutableReferences 누락을 현재 비교기가 INVALID_RELOCATION_DATA로 기록하므로 전체 보고서는 PARTIAL·배포 연결 UNKNOWN이다. 누락 필드를 빈 객체로 보충하거나 숫자tag 관측을 archive로 변환하지 않았다. 새 RPC·다운로드·실제 배포 대조는 실행하지 않았으며 기존 MISMATCH/판정을 유지한다.

`tests/token-review.test.ts`는 새로 생성하고 폐기하는 사설 Anvil chainId31337·31338에서 서로 다른 시험 토큰과 프록시/구현체의 전체 경로를 실행한다. 소스·배포 runtime 일치, 상속 modifier, 큰 정수, 비표준 선언 반환형, 읽기 method/gas/hash 고정, 상태 불변을 확인한다. 재조직·최종 조회 실패·다른 체인·소스 불일치·getter 실패/비정상 bool·해시 pin 거절·compiler 미확보/import/문법 오류·immutable·자료 누락·악성 문구·크기 한도·파일 hash/권한·덮어쓰기 거절·CLI·근거 참조를 검사한다.

후속 `tests/token-review-expansion.test.ts`와 사설 배포 시험은 상속 guard/내부 함수·OR 우회/가짜 require·override/super·modifier 실행 순서/중복·순환·storage alias·assembly·그래프 한도, 특수 동작 후보, library 실제 링크, immutable 전체 치환 일치/불일치와 범위 오류, 감사 파일 내용/경로/설정 차이, 무HTTP 오프라인 및1.0 보존을 확인한다. 실제 권한 행사를 실행한 증거로 쓰지 않는다.

`tests/token-review-cache.test.mjs`와 저장 관측 시험은 cache hash/소유·타입·symlink 거절, 변조 파일 미실행, preload 제거, timeout/임시 정리, 로컬 캐시가 있을 때0.6.12 실제 컴파일/AST와 없을 때 미지원 보존, archive identity/hash/헤더 오류·무HTTP·원문 불변·1.0/1.1 보존을 검사한다. 실제 USDC 저장 소스의 [2026-10-25 오프라인 분석](research/2026-10-25-usdc-offline-source-review.md)은 컴파일·정적 분석 성공과 전체 runtime 불일치를 분리한다. 새 RPC는0회이며 배포 연결 UNKNOWN은 해소하지 않았다.

이 사설 시험 자산은 실제 USDC·USDT·RLUSD·JPYSC·JPYC가 아니다. 구현 자동 검사는 외부 RPC/API·새 키·운영 DB를 사용하지 않았다. 후속 사용자 동의로 [Ethereum USDC 실제 단발 읽기](research/2026-10-24-usdc-token-review-live.md)를 별도 수행해 RPC20회·getter7개와 기준 블록/해시 재확인을 확인했다. 소스 compiler0.6.12 미연결로 정적 소스 분석은 NOT_RUN·배포 연결 UNKNOWN, 전체 PARTIAL이며 실제 다섯 토큰 전체의 검증 완료가 아니다. 추가 실제 배포 검토는 명시 입력과 허용된 RPC 범위로 구분한다.

별도 사용자 승인 [JPYC Ethereum 단발 읽기](research/2026-10-25-jpyc-token-review-live.md)는 RPC13회·getter0·고정 블록/종료 재확인으로 완료했다. 고정0.8.11로 저장2입력 컴파일에 성공했고, 해당 블록의 프록시 전체 runtime 일치는 CONFIRMED·구현체 immutable 미제공은 UNKNOWN·전체 PARTIAL이다. 앞선 오프라인 결과를 덮어쓰지 않으며 구현체 소스 연결·실제 dispatch·자산 지원 인증으로 확대하지 않는다.

```sh
node --use-env-proxy --import tsx --test tests/token-review.test.ts tests/token-review-expansion.test.ts tests/token-review-cache.test.mjs
npm run check
```
