# Phase 1 로컬 Git 기준

2026-10-19. [완료 점검](PHASE1_COMPLETION.md)을 통과한 구현·문서·테스트를 최초 로컬 커밋으로 보존하는 기준이다. 원격 게시·릴리스 태그·배포와는 별개다. `package.json`은 private 0.1.0을 유지한다.

## 포함과 제외

포함 대상은 제품 소스, 독립 작성한 Solidity Fixture, 테스트·명시적 합성 표본, JSON Schema, package/lock/TypeScript 설정, 프로젝트 문서와 개발 지침이다. 사용자 요청으로 구성한 `.codex/hooks.json` 및 `tools/intelligent-router`의 소스·shadow 정책·의도된 평가 표본/측정 스냅샷도 개발 도구로 포함한다. hook 파일의 보존은 다른 환경의 hook 신뢰 승인이나 자동 모델 전환을 의미하지 않는다.

환경 파일, 생성 보고서, 루트/Router `.state`, 모델 가중치·가상환경·cache·의존성은 제외한다. `reports/.gitkeep`만 포함한다. `.state/handoffs/phase1-proxy-readonly.md`와 실제 보고서는 로컬에 남기며 삭제하지 않는다. Router의 로컬 모델/interpreter 설정은 각 환경에서 별도로 준비해야 한다.

후보 파일과 staged blob에 대해 알려진 credential 형태, 인증 URL, 로컬 RPC 자료의 일치, 관리형 프록시 값·참조 및 절대 사용자 경로를 검사한다. 검사 출력에는 파일명과 규칙 결과만 남기고 실제 값을 기록하지 않는다. 제외 규칙·스캔 통과는 모든 비밀정보의 부재를 보증하지 않는다. 합성 테스트와 문서도 검사에서 일괄 제외하지 않는다.

## 확인과 재현

초기 기준 커밋은 다음 명령으로 찾는다. 이후 작업이 추가되면 현재 HEAD와 구별한다.

```sh
git log --max-parents=0 --oneline
git status --short
```

실행 환경에는 README의 Node.js·npm·Anvil이 필요하다. 다음 검사는 제품 내부 LLM 호출이나 외부 자산 거래를 요구하지 않는다.

```sh
npm ci
npm run check
python3 -m unittest discover -s tools/intelligent-router/evaluation -p 'test_*.py'
npm run --silent lab -- --out reports/baseline.json
npm run --silent lab -- --profile exact-receipt --out reports/exact-receipt.json
```

lab 두 명령의 종료 코드 2는 의도된 Fixture FAIL 때문이다. 기준 집계는 baseline 64 PASS / 5 FAIL / 22 INCONCLUSIVE, exact-receipt 61 / 8 / 22이며 각각 91개 결과다. 자동 테스트 실패와 구별한다. 생성 보고서는 커밋에 없으므로 검증 환경에서 다시 만들며 과거 mainnet 보고서를 새 실행 결과로 대체하지 않는다. Fixture 소스 해시만으로 전체 실행 환경을 재현했다고 주장하지 않는다.

기준 검증은 `npm run check` 43개 통과와 Router Python 테스트 18개 통과다. staged 파일 목록·모드·제외 경로·diff를 확인하고 커밋 후 실제 트리와 남은 작업 상태를 재확인한다. 새로운 환경의 재설치·OS·CPU 동등성, 운영 배포와 실제 토큰 안전성은 별도 검증 대상이다.

Lead 검토 `e07af244453442998904d69977483e41`의 proceed 조건에 따라 루트 `.state` 제외, 명시적 staging, staged blob 검사 및 커밋 후 확인을 적용한다. Git identity·서명·hook·프록시 설정은 변경하지 않는다. 검토 응답은 원격 게시나 운영 실행의 승인이 아니다.
