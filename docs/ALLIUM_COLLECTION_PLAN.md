# Allium 오프라인 조사 계획

[ADR0060](adr/0060-allium-survey-and-collection-plan.md)의 CLI는 기존 등록 자료에서 검토 가능한 SELECT 세 개를 생성한다. 실행기·새 수집기·공급량 전환은 아직 없다. 현재 대상은 Ethereum5개, JPYC Polygon/Avalanche/Kaia3개, TRON USDT1개, Solana USDC/USDT2개다. XRPL2개는 매핑 미확인으로 보류한다. 모두 미실행 NOT_TESTED이며 조회 후보라는 사실만으로 지원을 뜻하지 않는다.

```sh
npm run allium:plan -- plan --day 2026-10-23
```

stdout JSON의 jobs에 registry/supply/volume SQL과 각 해시·예상 최대 행수·sentinel resultLimit가 있다. 직접 파일로 저장할 때 순수 JSON이 필요하면 `node tools/allium-plan-cli.mjs plan --day 2026-10-23`을 사용한다. 날짜는 자동 선택하지 않는다. SQL은 외부로 전송하지 않고 비밀 설정도 읽지 않는다.

별도로 확보한 **동일 SQL**의 원문은 비공개 경로에 보존하고, 검토한 SHA256으로 projection을 확인한다:

```sh
node tools/allium-plan-cli.mjs review --day 2026-10-23 --kind supply \
  --source <private-response.json> --reviewed-sha256 <reviewed-64-hex-sha256>
```

kind는 registry/supply/volume 중 하나다. 원문 형식은 Explorer results의 sql·data·meta.row_count·queried_at이다. 조회 시각은 예약일 이후여야 한다. 현재 등록 자료/계획과 다른 SQL, 누락된 배포, 중복, sentinel 행, 기간 밖 날짜, Number 수량은 오류다. 이 명령은 DB import나 외부 실행 성공을 인증하지 않으며 실제 요청 횟수 영수증을 생성하지 않는다. stdout에는 공개용 선별 필드만 반환하고 원문의 계정 query/run 식별자는 버린다.

일곱 날짜 겹침·호출 예산·지연/수정·영수증/실패 복구와 보조 공급자 조건은 ADR0060을 따른다. 실제 호출 한도·과금 한도를 확인한 실행기와 별도 Allium 공급량 저장/조회가 다음 구현 대상이다.
