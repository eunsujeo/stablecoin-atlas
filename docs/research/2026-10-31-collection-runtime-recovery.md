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


## 8c4b7f5 운영 반영과 import-only 복구

8c4b7f56ffa71b1c49307792978ed4527e4bbbf8의웹자동배포는SUCCESS/COMMITTED(wall40.631초)였다. 해당root소유불변release와고정제어면의sealed cache/manifest/hash를stageVerified로재대조했다. atlascollector계정의readonly검사는Arkham정책MATCH/다음06:00UTC,등록자산CHECKED,기존FX READY,Usage READY/기존policyHash일치/providerRequests0이었다.

기존local index의원시각이후7응답모두SUCCESS/HTTP200인저장projection23건(10-30T06:00:02.878Z~10-31T05:00:04.665Z)을검증하고기존writer로2batch/414관측/import23/unchanged0으로DB복구했다. 새providerRequests0이며실패/소비원장을STORED로고치지않았다. 저장되지않은시간을새호출이나가상값으로채우지않는다.

고정root제어면의설치/보호파일검증및기존sealed artifact재검증뒤OS flock안에서before pointer·peerPID/상태를root전용journal로기록했다. Arkham만stop→collector-current전환→start/동일UIDcwd검증했고PID69372로정상실행했다. usage-current도같은검토SHA로설정했다. 실패시원pointer/Arkham시작상태복구분기를두었고실제journal은COMMITTED였다. 웹/FX/등록peerPID·상태변경0,unit/비밀/소유권/권한/DBschema변경0이다. audit는/var/lib/atlas-deploy/data-runtime-repair-8c4b7f56ffa71b1c49307792978ed4527e4bbbf8.json에보존했다.

## 최초 Usage 실행에서 확인한 기존 URL 결함

기존기간승인으로timer를enable하고UTC10-31당일run을1회실행했다. DBwriter/일별claim검증후STOPPED_UNKNOWN/TRANSPORT_FAILURE/ERR_INVALID_URL/HTTP응답0/본문0으로중단했다. 원인은운영계획에없는plan.origin을URL에연결한기존코드였다. 모의fetch가실제URL을파싱하지않아기존테스트에서빠졌다. 실제첫실행전에이를잡지못한한계를기록한다.

https://api.arkm.com의고정승인host와정확/transfers/histogram을사용해URL18개를claim전구성/검증하도록수정한다. plan/policyHash·대상/기간/한도는바꾸지않는다. 18개모의요청모두실제URL파싱/host/path/chain/token/redirect=error를검사하는회귀를추가했다. 오늘claim/receipt와실패이력은보존하며같은날재호출·새root우회·백데이트하지않는다. 수정본은다음정규UTC00:20실행에사용한다. 오늘새Usage snapshot을게시했다고표현하지않는다.

복구 재실행도source23/insert0/unchanged23/providerRequests0으로동일성을확인했다. URL보완최종npm run check rc0:879pass/0fail/8skip,URL전용7pass/0fail이다.
