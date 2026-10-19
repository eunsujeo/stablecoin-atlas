# ADR 0002 — 제품과 분리된 개발용 Router PoC

날짜: 2026-10-19. 상태: 조사 및 로컬 PoC 채택, 자동 실행 보류.

이번 사용자 요청에 따라 `tools/intelligent-router`에 별도 Python 개발 도구를 둔다. 제품의 TypeScript 아키텍처, 의존성, CLI, 금융 판정에는 연결하지 않는다. 전역 Codex 모델/인증 설정과 Herdr 설정도 변경하지 않는다. 루트 AGENTS.md의 제품 범위 제한은 유지한다.

경량 d3-lite 원본을 고정 revision과 manifest로 검증해 macOS MPS에서 실행했다. 모델 출력의 낮은 native confidence로 모든 예제가 fallback했으므로 자동 라우팅은 채택하지 않는다. vLLM Semantic Router 서버 전체, API Gateway, OpenAI 유료 API는 도입하지 않는다.

실행 MVP는 Herdr의 기존 Codex TUI 실행 기능과 인자 전달을 우선한다. App Server는 읽기 전용 모델/effort 카탈로그 조회에 사용한다. 상주 App Server로 작업까지 제어하는 방식은 승인/이벤트/세션 관리 비용 때문에 초기 구현에서 제외한다.

근거와 미검증 범위는 [설계](../ai/ROUTER_ARCHITECTURE.md) 및 [평가](../ai/ROUTER_EVALUATION.md)에 기록한다.
