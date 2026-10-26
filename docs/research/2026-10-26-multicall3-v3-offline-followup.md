# Multicall3 v3 저장 결과 오프라인 후속 검토

## 수행 범위와 결과

[이전 인계문](../handoff/2026-10-26-contract-runtime-read-v3-infura-result.md)의 다음 행동 중 저장 자료 오프라인 검토를 수행했다. 새 대화의 후속 진행 지시에 따라 기존 검증기를 실행했으며 새 RPC·공급자 API·compiler 실행·키 변경·운영 데이터 변경은 없다. Local Router shadow 추천은 제공돼 재호출하지 않았고, 단순 저장 근거 검토이므로 Lead/하위 Agent를 실행하지 않았다.

`node .state/agent-logs/contract-runtime-infura-live-v3-offline-verify.mjs`는 rc0, checks26/pass26/fail0/externalRPC0이었다. 로그는 `.state/agent-logs/contract-runtime-v3-followup-offline.log`에 보존했다. 저장 v3 runtime의 길이·keccak256·공급자 두 artifact 전체 바이트, 기준 블록/종료 확인 receipt, 실제 요청 순서/한도, 입력 pin, v2/v3 보존 파일 hash, 비공개 권한과 소비 marker를 재확인했다. 이번 검토 실패나 수정은 없다. 과거 최초 실패 원인 UNKNOWN과 v2 TLS_FAILURE는 그대로 보존하며 이번 오프라인 성공으로 원인을 재판정하지 않는다.

이번 검토는 저장 근거의 재확인이다. 새 시점의 체인 관측이나 독립 재컴파일이 아니다. 원본 compiler NOT_RUN·소스 진위 UNKNOWN·실제 Proxy/권한 NOT_TESTED·비용 UNKNOWN과 기존 토큰 호환성 판정을 유지한다. 자세한 실제 실행 시각·한도·근거는 [원래 v3 결과](2026-10-26-multicall3-infura-runtime-result.md)를 따른다.

## 웹 요약에 반영할 수 있는 검토안

다음은 별도 수동 반영 확인을 위한 검토안이며 현재 웹에는 적용하지 않았다. `web/contract-review-data.js`는 최초 연구 요약을 계속 제공한다. 과거 연구를 현재 결과로 자동 덮어쓰지 않는다.

| 표시 항목 | 검토한 후속 요약 |
| --- | --- |
| 전체 검토 상태 | UNKNOWN 유지. 고정 블록 runtime 관측 OBSERVED와 개별 artifact equality PASS를 분리 표시 |
| 실제 관측 범위 | Ethereum chainId1, 기존 Multicall3 주소, 블록26275729 |
| 기준 블록 hash | `0x043690036588b1cbf06047d1962f591732a4f984882790c18f6cf94bf068179e` |
| runtime | 3808바이트, 저장 공급자 onchain/recompiled artifact 두 개와 전체 바이트 일치 |
| runtime keccak256 | `0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891` |
| 실제 실행 시간 | 2026-10-26T08:40:38.561Z~08:40:39.755Z. header timestamp와 구분 |
| 실패 이력 | 최초 실패 UNKNOWN·v2 TLS_FAILURE·각 소비 완료를 별도로 보존 |
| 도구·한계 | 원본 compiler NOT_RUN, 소스 진위 UNKNOWN, 실제 Proxy/권한 NOT_TESTED. 사설 시험 PASS와 구분 |
| 근거 | 최초 연구 기록과 v2/v3 결과를 각각 표기. 원문 snapshot/report·URL·키는 게시하지 않음 |

수동 웹 반영 시 개요·소스·구조/Proxy·근거의 문구와 관측 시각 의미를 함께 맞춰야 한다. 전체 상태를 PASS로 변경하거나 현재 Proxy 부재·현재 배포의 소스 진위·자산 안전성을 인증하는 문구를 사용하지 않는다. 원본 최초 연구 요약을 이력으로 보존하는 표시 방식은 반영 단계에서 결정한다.

## 재현과 다음 경계

`npm run check > .state/agent-logs/contract-runtime-v3-followup-check.log 2>&1`는 rc0, tests650/pass650/fail0/cancelled0/skipped0이었다. `git diff --check`도 rc0이었다. 변경은 이 연구 기록과 후속 인계문 두 파일이다.

기존 비공개 자료가 있는 동일 workspace에서 위 오프라인 검증 명령으로 재현한다. `--execute` 또는 새 슬롯은 필요하지 않다. 입력 부족/불일치 시 새 외부 조회로 보충하지 않고 해당 실패를 기록한다. 웹 수동 반영은 후속 확인을 받은 뒤 진행한다. 새로운 실제 조회·compiler/Slither·Proxy/권한 검증·운영 반영은 각각 별도 범위/계획 승인이 필요하다.
