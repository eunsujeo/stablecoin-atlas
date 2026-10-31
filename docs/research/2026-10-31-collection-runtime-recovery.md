# 2026-10-31 데이터 수집 정상화

사용자가 실제 수집 상태 확인 후 정상화를 요청했고, reviewed-definers 검증을 수집 필수 경로에서 설치/권한 변경 점검으로 분리하는 권장안을 추가 확인 없이 진행하도록 승인했다. 하위 에이전트는 사용하지 않는다.

## 관측과 원인

등록 자산 일별 수집은 10-31 UTC00:00에 5건 STORED, 기존 ECB FX timer는 UTC00:10 STORED였다. Arkham 프로세스는 active이지만 매시간 FAILED/COLLECTION_FAILED였다. 마지막 기록은 requests7/completedRequests7/publishedfalse/httpStatusnull이다. 저장 projection 237개 중 최신 것을 기존 snapshot에 합치는 오프라인 재현은 정상이며 다음 JSON 크기만 2,101,780bytes로 2MiB 제한을 넘었다. 기존 snapshot 2,092,053bytes/3,864관측/10-30T05:00:17.885Z와 last-build FAILED를 확인했다. 신규 API 호출 없이 원인을 확인했다.

네트워크 활동 timer는 inactive, usage-current는 없고 config/authorization/writer는 기존 atlascollector0600으로 존재했다. reviewed-definers.json만 없었으며 현재 PC 및 서버 /root,/home/mob,/var/lib/atlas-vault의 제한된 기존 JSON 검색에서 원래 해시에 맞는 검토본을 찾지 못했다. hash를 임의로 바꾸거나 새 검토를 기존 검토로 위장하지 않았다. 실제 코드 검토 결과 schema/role/runtime 검증과 무관한 간접 공개 함수 전체 검토가 매 claim/import를 막는 결합이었다.

## 수정

ADR0126에 따라 DB 모드 로컬 미리보기만 최신 배치로 게시하고 기본 파일 모드는 누적을 유지한다. 이전 snapshot/index가 손상됐으면 최신 배치 모드도 자동 초기화하지 않는다. 레지스트리 식별자 불변·원 projection·과거 snapshot 파일·DB 이력은 유지한다. 2MiB 경계 실패→최신 배치 성공·원본 보존·손상 index 거부·식별자 변경 거부 회귀를 추가했다.

Usage는 승인 파일 hash/기간/호출 예산을 그대로 검증한다. read-only check와 실제 claim/import는 기존 writer 최소 권한·스키마/RLS·직접 공개 접근 및 API-role membership 검사를 유지한다. 누락된 review 파일은 런타임에서 읽지 않는다. init/grant/upgrade/boundary의 관리자 보안 점검은 유지한다. 누락된 legacy review path여도 정상 check, writer 검사 실패면 수집0, 승인 hash 변경이면 DB/외부0인 회귀를 추가했다.

## 검증과 운영 적용

초기 Arkham 경계 회귀의 기대값은 성공 반환에 없는 published 필드를 요구해 한 번 실패했다. 실제 last-collection의 publishedtrue를 확인하도록 정정했고 11개 전용 검사를 통과했다. 현재 개발 Docker daemon은27.3.1이며 사설 PostgreSQL fixture는28이상만 허용하므로 그 요건을 낮추거나 이미지를 다운로드하지 않았다. 최종 전체검사와 서버의 기존 writer read-only 검증 후에만 runtime을 전환한다. 웹 자동 배포와 독립적으로 collector-current/usage-current의 검토 SHA를 기록하며, Arkham만 정상 재시작하고 기존 FX/등록 자산 프로세스를 재시작하지 않는다. 고정 root 제어면·비밀/소유권/권한·DB schema와 기존 실패 claim은 유지한다. 실패한 완결 projection은 원 시각/hash 그대로 import-only 복구하며 API를 다시 부르지 않는다. Usage는 기존 승인기간 내 UTC당일 claim과 18GET/무재시도 한도를 적용한다.

최종 npm run check rc0: 879pass/0fail/8skip(주805+보존74). 관련 runtime/collector 회귀74pass/0fail. 기존compiler캐시미보유 생략8은그대로이며새다운로드0이다.
