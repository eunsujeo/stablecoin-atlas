# Router PoC 평가 및 재현

2026-10-19. 현재 결과는 **오프라인 분류 PoC 통과, 자동 라우팅 전환 보류**다. 운영 shadow, GPT 작업 수행 성공률, 절감 효과를 검증한 결과는 아니다.

## 실행 결과

- 모델: vllm-sr/d3-lite, revision `03560c26f5199c3c04129a2ccb38960c913635e0`. manifest SHA-256을 정책에 고정하고 executable source와 가중치 전체 해시를 검증했다.
- 하드웨어: M4 Max, 36 GiB, macOS 15.7.9. Python 3.13.13 / Torch 2.14.1 / Transformers 5.17.0, MPS, CPU thread 수 4.
- 8개 대표 코딩 요청: 문서, 탐색, 기능 추가, 금융 로직, 동시성, 이전 실패, 테스트 재실행, 불명확 요청. 한국어/영어가 섞인 smoke fixture이며 실제 개발 작업 완료를 평가한 데이터가 아니다. 탐색 예제에 실제 Verdict 정의 발췌문을 포함했다.
- 세 번 실행했다. 첫 실행 후 탐색 예제의 축약 타입을 실제 소스 정의로 교체했고, 마지막 실행은 manifest 사전 검증 추가 이후다. 최종 원시 결과는 [poc-results.json](../../tools/intelligent-router/evaluation/poc-results.json)에 보존했다.

| 지표 | 최종 8개 분류 실행 |
|---|---|
| 모델 적재 및 full 검증 | 3.12초, OS/파일 캐시가 데워진 상태 |
| 분류 p50 / 범위 | 0.598초 / 0.568~0.733초 |
| 누적 wall / CPU process time | 4.956초 / 0.782초; 적재 시간 제외 |
| CPU 평균 | 단일 코어 기준 약 15.8%; GPU 사용량 지표가 아님 |
| 프로세스 high-water RSS | 2,262,728,704 bytes, 약 2.11 GiB; GPU/통합 메모리 전체 아님 |
| 원시 JSON 응답 | 8/8 생성, 질문별 확률 및 confidence 존재 |
| native confidence 최솟값 범위 | 0.102~0.387 |
| Advanced 추천 / fallback | 8/8 / 8/8 |
| 실제 고성능 GPT 사용 비율 | 측정 불가; GPT 작업 미실행 |
| GPT 작업 성공률·테스트 통과율 | 측정 불가; null |
| Codex 토큰 및 절감률 | 측정 불가; null |
| GPT 추가 재시도 | 측정 불가; GPT 작업 미실행 |

최초 실행의 적재/검증은 10.56초, 첫 분류는 1.645초, p50은 0.666초, RSS 최대 약 2.33 GiB였다. 진정한 OS cold-cache 조건은 통제하지 않았다. 서로 다른 실행의 최고 수치를 조합해 하나의 실측으로 보고하지 않는다.

`raw.usage`는 **로컬 Decision Model**이 반환한 입력 토큰/출력 0이며 Codex 구독 사용량이 아니다. `codex_tokens`, `task_success`, `test_pass`는 미측정 null이다. 메모리는 macOS ru_maxrss 프로세스 상한이며 요청별 증분이 아니다. CPU time은 process_time이고 시스템 전체 부하/전력/Metal GPU 점유율은 측정하지 않았다.

## 해석과 전환 기준

이 revision의 confidence는 최고 라벨 확률이 아니라 `1 - normalized Shannon entropy`다. 세 질문 최솟값을 내부 confidence로 전달한다. 0.8은 미보정 초기 보수 임계값이며 성공확률 80%라는 뜻이 아니다. 결과에 맞춰 임계값을 낮추지 않았다. 모든 요청이 Advanced로 상향되므로 현재 정책은 토큰 절감 목적을 만족하지 못한다.

금융/동시성 두 예제의 원시 risk는 high였고, 정책도 sensitive_change와 다중 모듈 메타데이터로 상향했다. 이는 고위험 누락률 0%의 증거가 아니다. 불명확 요청은 원시 complexity/risk가 low여서 컨텍스트 누락 override가 필요했다. 따라서 Decision Model 단독으로 안전 판단을 맡기면 안 된다. 별도 정답 라벨·독립 평가셋이 없어 분류 정확도는 미산출이다.

Phase 3/4 전환 시 다음을 구현·수집한다.

1. 개발자가 라벨링한 최소 100개 요청, 한국어/영어·명백한 저위험·금융·보안·동시성·불명확 요청·분류 지시문 공격을 포함한다. threshold/질문 조정용과 최종 holdout을 분리한다.
2. task/complexity/risk 혼동행렬, 고위험 recall/false negative, fallback 비율, calibration을 측정한다. 고위험 holdout 누락 0건을 출시 기준으로 요구하되 표본 한계와 신뢰구간을 보고한다.
3. 각 task/model/effort의 성공·실패·재시도·테스트 결과를 저장한다. 작은 표본의 성공률을 과신하지 않고, 관측 실패는 상향하고 낮은 표본은 기본 정책을 유지한다.
4. 실제 요청의 수동 선택/Router 추천/실행 모델을 동일 run ID로 묶는다. 같은 작업을 평가 목적으로 두 번 실행한 사용량은 따로 분리한다. 최종 검증 명령과 exit code를 보존한다.
5. 토큰은 제공된 input/cached-input/output을 원시 단위대로 저장하고 cached-input을 중복 합산하지 않는다. Herdr 화면만으로 사용량을 알 수 없으면 null과 unavailable 사유를 남긴다. 회수 가능한 Codex 세션 usage 연결은 아직 미구현이다.
6. 자동화 후보에서 수동 기준 대비 성공률/테스트 품질 저하가 없고, 요청당 총 사용량·시간·재시도·Advanced 사용 비율을 비교할 수 있을 때만 소규모 opt-in을 시작한다. 한도/모델별 구독 사용량은 토큰량과 따로 본다.

## 재현

전역 설정 변경 없이 격리 디렉터리에서 실행한다. 최초 패키지·가중치 다운로드는 약 1.73GB 모델과 실행 패키지 공간이 필요하다. 최초 PoC는 `/tmp/intelligent-router-poc.IBGYsF`에서 실행했다. 자동 요청 후속 구현에서 모델을 재다운로드 없이 `~/Library/Application Support/intelligent-router/d3-lite-03560c26`으로 옮기고 같은 상위 폴더의 venv에 고정 패키지를 오프라인 설치했다. 로컬 전용 runtime.local.json이 경로를 가리키며 Git에서 제외된다. uv의 일반 패키지 캐시도 사용된다. 아래 명령은 독립 PoC 재현 예시다.

```sh
POC_DIR=$(mktemp -d /tmp/intelligent-router-poc.XXXXXX)
uv venv --python 3.13 "$POC_DIR/venv"
uv pip install --python "$POC_DIR/venv/bin/python" -r tools/intelligent-router/decision/requirements-poc.lock
"$POC_DIR/venv/bin/python" -c 'import sys; from huggingface_hub import snapshot_download; snapshot_download("vllm-sr/d3-lite", revision="03560c26f5199c3c04129a2ccb38960c913635e0", local_dir=sys.argv[1], ignore_patterns=["assets/*", ".eval_results/*", ".gitattributes"])' "$POC_DIR/model"
# 모델 저장소의 Python 소스를 검토한 후 로컬 실행한다.
"$POC_DIR/venv/bin/python" tools/intelligent-router/decision/poc.py --model-dir "$POC_DIR/model" --cases tools/intelligent-router/evaluation/cases.json --output "$POC_DIR/results.json" --device mps
python3 tools/intelligent-router/evaluation/test_policy.py
python3 tools/intelligent-router/adapters/catalog.py
npm run check
```

실제 다운로드도 동일 huggingface_hub의 snapshot_download로 수행했다. CPU 실행은 `--device cpu`로 명시할 수 있으나 이 장비 CPU 지연/동등성은 NOT_TESTED다. GPU 전용 Triton/flash-linear-attention은 설치하지 않았다. Transformers가 PyTorch 참조 kernel fallback 경고를 출력했고 해당 경로로 성공했다. GPU 전용 패키지를 설치하라는 경고를 macOS 설치 지침으로 그대로 따르지 않는다.

입력 JSON은 id/request 및 선택적 context·안전 메타데이터를 받는다. 전체 저장소를 자동 읽지 않는다. 사용자 요청/코드 발췌문에는 비밀·RPC URL·인증자료를 넣지 않는다. PoC 결과 파일에는 원문 대신 case ID와 모델 원시 답/추천/측정만 저장한다. 로그는 로컬 디렉터리로 한정한다.

## 검증 범위

`test_policy.py`의 5개 회귀 테스트 통과: 저위험 Economy, 누락/에러/NaN fallback, 낮은 native confidence 보존, 실패/위험/넓은 범위 override. 제품 `npm run check`: TypeScript 및 기존 8개 테스트 통과. 테스트 실행에 LLM을 호출하지 않았다.

후속 구현: `request.py --hook`을 실제 로컬 d3-lite로 실행해 JSON 추가 context 반환을 확인했다. native Codex hook은 `/hooks` 신뢰 승인 전 미실행이다. `test_integration.py`는 중복 turn 회피, 요청 원문 비저장, timeout fallback, disable, 소유 pane 정리, working/blocked/unknown/결과 누락/소유권 변경 시 보존을 검증한다. 정책 테스트 5개와 통합 테스트 6개가 통과했다. Herdr 수명 관리의 삭제 경로는 mock으로 검증했으며 실제 임시 Agent를 생성·실행·제거한 종단 검증은 아직 없다.

지속 경로로 이동한 뒤 첫 hook Adapter 호출은 17.03초였다. Python/Torch 기동·모델 적재·전체 해시 검증·MPS 준비를 포함하므로 위의 0.598초 분류 중앙값과 다르다. 상주 모델 프로세스는 두지 않으므로 요청마다 적재 비용이 발생할 수 있다. hook 제한은 35초, 내부 모델 프로세스 제한은 25초이며 초과 시 모델 사용량을 만들지 않고 보수적 추천을 반환한다. 속도 개선과 실제 구독 절감은 아직 입증하지 않았다.

기존 구현 pane을 `router-impl`로 명명했고, Herdr agent prompt로 변경된 지침 읽기·적용 확인을 한 번 전달해 완료 응답을 회수했다. 해당 Agent는 코드 변경·검증 반복·추가 Agent 생성·hook 신뢰 우회·/new를 실행하지 않고 다음 작업부터 적용하겠다고 확인했다. 이는 실제 Herdr 통신 확인이며 신규 모델별 추론/임시 pane 종단 시험과는 구분한다.

CLI exec, Herdr 모델별 추론, App Server inference의 종단 시험과 수동 모델 override는 남아 있다. 자동 추천 비활성화는 runtime.local.json의 enabled=false 또는 Codex `/hooks`로 지원한다. policy.json의 shadow/automatic_execution=false는 모델 전환이 꺼진 상태이며 값을 바꿔도 실행 중 모델을 바꾸는 기능은 생기지 않는다.
