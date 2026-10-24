# 읽기 전용 토큰 기술 검토 CLI

새 기준은 [ADR0090](adr/0090-readonly-token-technical-review.md)이다. 기존 실행 시나리오 PASS/FAIL·연구 판정·대시보드와 별도로 사용한다. 코드의 관리 기능·비표준 동작 검토 자료, 명시한 getter의 현재 값, 소스와 배포 코드의 대응을 JSON·Markdown으로 보존한다. 보안 감사나 안전성/지원 승인이 아니다.

## 실행

Node.js24.5 이상과 `npm ci`로 설치한 기존 의존성을 사용한다. 실제 조회에는 EIP-1898을 지원하는 EVM RPC가 필요하다. RPC와 인증은 `RPC_URL` 환경변수로 전달한다. CLI 인자·JSON 설정에 인증 URL/키를 넣지 않는다. 다음 명령은 사용자가 선택한 RPC에 실제 읽기 요청을 보내므로 구현 검사에서 외부 RPC를 호출한 것으로 혼동하지 않는다.

```sh
mkdir -p reports/token-reviews
# RPC_URL은 현재 셸에 안전하게 설정한 상태
npm run review:token -- --config /private/intake/token.json --out reports/token-reviews/review-001
```

`--out`은 아직 존재하지 않는 디렉터리여야 한다. 재실행 시 새 경로를 선택한다. 종료코드0은 분석 절차 완료,2는 수집/분석 일부 실패로 보고서가 생성됨,1은 입력/출력 등으로 절차를 완료하지 못함이다. 0이어도 확인 불가 항목이 남을 수 있으며 안전함을 뜻하지 않는다. `bundle.json`이 없으면 완성된 묶음으로 사용하지 않는다.

## 입력

설정 형식은 [JSON Schema](../schemas/token-review-config.v1.schema.json)를 따른다. 아래의 주소와 chainId는 설명용 자리표시자이며 실제 값으로 교체해야 한다. 이름만 입력하거나 주소를 생략하는 경로는 없다.

```json
{
  "schemaVersion": "TokenReviewConfig1.0",
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
      "declaredTarget": { "version": "<자료에 기재된 버전>", "commit": "<자료에 기재된 commit>", "scope": ["Token.sol:Token"] }
    }
  ]
}
```

- `sources`·`probes`·`audits`·`dependencies`는 선택 사항이다. 생략하면 해당 부분은 확인 불가다. reference는 HTTPS의 인증·query·fragment 없는 참고 URL만 받으며 자동으로 열지 않는다. 자료 경로는 설정 파일의 위치를 기준으로 해석한다.
- 블록을 명시하려면 `network.blockNumber`에 십진 문자열을 넣는다. 생략하면 시작 시 높이를 고정하고 헤더 해시를 확보한다. 체인/블록 불일치나 EIP-1898 미지원 시 대체 endpoint·높이·latest로 전환하지 않는다.
- 프록시와 구현체의 소스는 각각의 주소로 별도 등록한다. 고정 프록시 관측으로 찾은 구현체·beacon 외의 외부 의존성은 `dependencies`에 명시한다. 동적 의존성 자동 탐색·중첩 프록시 해석은 하지 않는다.
- 이름은 보고서 표시에만 쓴다. USDC·USDT·RLUSD·JPYSC·JPYC 및 다른 EVM 토큰은 동일 설정 경로를 사용하지만, 각 주소·소스·compiler·구조의 확보 여부에 따라 분석 가능 범위가 다르다. 이름이 지원/검증을 보증하지 않는다.

compiler 전체 버전은 외부 호출 없이 다음으로 확인한다.

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

실제 배포에 사용한 compiler·optimizer·EVM target·libraries·metadata 등의 설정을 제공해야 한다. outputSelection만 도구가 AST·ABI·runtime 출력용으로 교체하며 실효 입력도 저장한다. 설치 버전과 다르거나 컴파일 실패, 전체 runtime 불일치, 미확정 링크/immutable은 배포 연결 UNKNOWN이다. 오래된 Solidity 버전을 자동 다운로드하거나 pragma를 수정하지 않는다.

Getter는 `owner/pendingOwner/admin/masterMinter/blacklister/pauser/feeRecipient() → address`, `paused() → bool`, `totalSupply/cap/maxSupply/fee/feeBps() → uint256`, `decimals() → uint8`, `getRoleAdmin(bytes32) → bytes32`, `hasRole(bytes32,address) → bool`, `isMinter/isBlacklisted/blacklisted/whitelisted/allowlisted(address) → bool`, `minterAllowance/minters(address) → uint256`만 허용한다. 명시한 ABI가 이 형식과 정확히 맞아야 한다. 이름이 같아도 실패할 수 있으며 실패는 기능 부재가 아니다. 새 getter는 코드의 허용목록을 검토해서 추가한다. 전체 권한자 열거·로그 전수 조회는 하지 않는다.

## 결과와 해석

- `report.json`: [별도 결과 Schema](../schemas/token-technical-review.v1.schema.json), 시각·블록·주소·코드 해시·도구/규칙 버전·분류·확인 상태·실패·근거 참조.
- `report.md`: 배포 구조, 소스 연결, 소스 선언·검토 후보, modifier 본문과 위치·조건·호출 참조·대입·반환문, 감사 자료·실패·한계.
- `artifacts/`: 제공된 소스 standard JSON·실효 compiler 요청·compiler 결과·감사 원문. JSON evidence에 각 SHA256/바이트 수와 RPC 요청/검증된 반환값을 기록한다.
- `bundle.json`: 위 파일들의 SHA256과 길이. 완료 시 마지막으로 기록한다. 소유 디렉터리0700/파일0600이며 Git이나 웹에 자동 게시하지 않는다.

분류와 확인 상태는 별도다. 관리 기능·비표준 동작·취약점 후보·현재 상태를 중복 분류할 수 있다. 이름으로 찾은 관리 기능과 저수준 호출 검토 지점은 UNKNOWN이며 취약점 확정이 아니다. 선언 자체와 정확한 ABI 반환형 차이만 SOURCE 사실로 확인한다. 자동으로 권한의 실행 의미·변경 경로·수수료·rebase·콜백 안전성을 확정하지 않는다. 필요한 코드/함수·modifier·호출 위치를 근거로 후속 검토한다. 추출 snippet400자/호출·조건·대입·반환 각32개/modifier16개 제한이 있으며 전체 소스는 별도로 보존한다. 추출되지 않음을 미발견/안전으로 바꾸지 않는다.

SOURCE 사실은 제공된 소스 범위이며 배포 연결과 다르다. CHAIN 사실은 블록 일관성 확인이 필요하다. `contracts`·`proxy`·RPC evidence는 원래 관측이며, 재조직/오류 뒤에도 이를 삭제하지 않는다. 유효한 결론은 `block.consistency`와 findings의 확인 상태를 함께 읽는다. getter 반환값은 실제 권한 행사나 EOA의 단일 개인 소유 증명이 아니다. 감사 파일의 hash도 진위·대상 commit/범위·배포 대응을 증명하지 않는다. 현재 감사 의미 분석은 미지원이며 UNKNOWN이다.

감사의 `declaredTarget`은 선택적인 제출 메타데이터다. 버전·commit·범위를 기록할 수 있지만 문서에서 자동 추출하거나 사실로 인증하지 않는다. 소스 이름/버전 문자열이 맞는다는 이유로 현재 배포와 대응한다고 판정하지 않는다.

초기 자동 분석에는 `분석 범위에서 미발견`을 안전성의 대용으로 사용하지 않는다. 분석 커버리지·미확인과 실행 실패를 별도 기록한다. `COMPLETED`는 누락된 분석의 완료나 전문 감사 완료가 아니다.

## 한도와 미지원

RPC 최대128회·120초·각 응답2MiB/합계8MiB·요청10초·재시도0·redirect 거절이다. eth_call은 인식한 주소·고정 getter/프록시 조회만, gas500,000/value0/고정 해시로 실행한다. 설정64KiB·소스 최대8묶음/각1MiB/가상 소스32개·감사4개/각2MiB·명시 의존성8개·getter24개다. 컴파일 worker는 각20초·heap256MiB·입력2MiB/출력8MiB이며 외부 스크립트를 실행하지 않는다. 함수256개/묶음·소스 분석 근거 합계4MiB·최종 JSON32MiB를 제한한다. 실패 원문·RPC 인증정보를 로그에 출력하지 않는다.

AI·Slither는 **NOT_RUN**이다. Trail of Bits [token-integration-analyzer](https://github.com/trailofbits/skills/blob/main/plugins/building-secure-contracts/skills/token-integration-analyzer/SKILL.md)의 관리자 권한·비표준 동작 항목을 참고했다. upstream commit은 이 구현에서 고정/실행하지 않았으며 자체 규칙 버전으로 추적한다. 전체 스킬·분포/상장 평가·예시 위험 등급을 적용하지 않고 Trail of Bits의 직접 감사로 표현하지 않는다.

비EVM·브리지 자동 판별·준비자산·내부 키 관리·합의/최종성·지갑 입출금/원장/sweep·가격/보유자/유동성·전송/승인/서명·퍼징·상시 감시·대시보드는 이 경로에 없다. 새로운 LLM 호출이나 compiler 자동 설치는 추가하지 않았다.

## 실제 검증한 범위

`tests/token-review.test.ts`는 새로 생성하고 폐기하는 사설 Anvil chainId31337·31338에서 서로 다른 시험 토큰과 프록시/구현체의 전체 경로를 실행한다. 소스·배포 runtime 일치, 상속 modifier, 큰 정수, 비표준 선언 반환형, 읽기 method/gas/hash 고정, 상태 불변을 확인한다. 재조직·최종 조회 실패·다른 체인·소스 불일치·getter 실패/비정상 bool·해시 pin 거절·compiler 미확보/import/문법 오류·immutable·자료 누락·악성 문구·크기 한도·파일 hash/권한·덮어쓰기 거절·CLI·근거 참조를 검사한다.

이 시험 자산은 실제 USDC·USDT·RLUSD·JPYSC·JPYC가 아니다. 이번 구현 검증은 외부 RPC/API·새 키·운영 DB를 사용하지 않았다. 실제 배포 검토는 사용자가 확인한 네트워크·주소·소스·자료와 허용된 RPC로 별도 실행한다.

```sh
node --use-env-proxy --import tsx --test tests/token-review.test.ts
npm run check
```
