# ADR 0007 — 관측 블록 참조의 형식과 일치 확인

날짜: 2026-10-19. 상태: 채택.

## 문제

기존 Rpc.pin은 eth_blockNumber를 bigint로 변환해 상태에 넣은 뒤 eth_getBlockByNumber를 호출했지만 헤더 응답을 검사하지 않았다. null·번호 불일치·해시 누락 응답도 후속 메타데이터/Proxy 조회를 허용할 수 있었다. 이는 고정한 관측 기준을 보고서 증거로 설명하기에 부족하다.

## 결정

pin 시작 시 이전 rpc.block을 UNKNOWN으로 지운다. eth_blockNumber는 0x 접두어와 불필요한 선행 0이 없는 비음수 hex quantity여야 한다. 0은 0x0이며 Number 변환은 사용하지 않는다. 해당 번호로 조회한 헤더는 null/배열이 아닌 객체여야 하며, 헤더 number도 유효한 quantity로 같은 정수를 가리켜야 한다. hash는 32바이트 hex 형식이어야 한다.

모든 검사를 통과한 뒤에만 십진 문자열 rpc.block을 설정하고 BLOCK_REFERENCE 증거에 number/hash를 기록한다. 잘못된 번호/헤더는 고정된 진단과 BLOCK_REFERENCE_ERROR 사유로 남기고 실행을 중단한다. RPC/전송 실패도 이전 pin 상태를 유지하지 않는다. 초기 블록 확인이 실패하면 메타데이터·Proxy 조회와 완료 보고서를 생성하지 않는다.

블록 확인 전의 원시 RPC 증거는 observedBlockOrSlot이 UNKNOWN일 수 있다. 검증된 BLOCK_REFERENCE가 요청 번호와 반환 헤더의 연결을 제공하며, 재확인해도 앞선 증거와 시나리오의 참조를 덮어쓰지 않는다. 공유 Rpc의 Fixture 실행은 순차 실행을 유지한다.

## 범위와 한계

해시의 존재·형식과 번호 일치만 검사한다. 전체 헤더 재계산, 합의 검증, 발행사 인증, 최종성, 조회 중 재조직 탐지는 제공하지 않는다. 상태 조회에는 기존 숫자 블록 태그를 사용하므로 같은 높이의 블록이 조회 사이에 바뀔 수 있다. EIP-1898 hash 기반 요청이나 safe/finalized 정책은 이 결정의 범위가 아니다. FINALITY는 계속 NOT_TESTED다.

JSON schemaVersion과 시나리오 버전은 유지한다. BLOCK_REFERENCE는 추가 증거 kind이며 소비자는 고정 evidence 개수에 의존하지 않는다. 기존 보고서를 소급 검증/수정하거나 과거 관측이 무효라고 단정하지 않는다. 성공적인 블록 원시 응답은 기존 성공 RPC 증거 정책을 따른다. 잘못된 참조의 CLI 진단에는 원문이나 endpoint를 삽입하지 않는다.

## 검증 조건

로컬 HTTP에서 genesis, Number.MAX_SAFE_INTEGER 초과 높이, 번호/해시 형식 오류, null/불일치 헤더, RPC 실패 후 UNKNOWN 상태와 복구를 확인한다. 잘못된 초기 참조에서는 계약 코드·metadata·storage 요청이 없어야 한다. CLI는 종료 코드 1, 빈 stdout, 기존 보고서 유지와 고정된 오류를 검증한다. 기존 사설 Anvil 회귀 테스트로 실제 헤더와 모든 Fixture 판정 호환성을 확인한다. 외부 상태 변경은 없다.

Lead 요청 `e449a84c980043fcaaf4392fba678b41`의 proceed 응답을 회수했다. 형식·일치 검증, 상태 초기화, 재확인 증거 분리, 고정 진단과 테스트 조건을 적용하며 재조직/최종성 검증으로 확대하지 않는다. Lead 검토 자체는 테스트 실행이나 자산 취급 승인이 아니다.

## 근거

- [Ethereum JSON-RPC 문서](https://ethereum.org/en/developers/docs/apis/json-rpc/): quantity/data 인코딩, eth_blockNumber 및 eth_getBlockByNumber 응답.
