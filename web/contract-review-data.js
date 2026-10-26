// Manually reviewed excerpts of the public research note. Never import private captures/reports.
export const contractReviewGroups = [['overview','개요·검증'],['behavior','함수·흐름'],['risks','위험·사용 조건'],['evidence','근거·한계']];
export const contractReviews = [{
  id:'multicall3-ethereum-20261026', name:'Multicall3', network:'Ethereum', chainId:'1',
  address:'0xca11bde05977b3631167028862be2a173976ca11', status:'UNKNOWN', reviewedAt:'2026-10-26',
  observedAt:'2026-10-26T00:33:22.564Z', analysisDate:'2026-10-26',
  purpose:'여러 컨트랙트 호출을 묶는 범용 실행기',
  source:'docs/research/2026-10-26-contract-review-multicall3.md',
  sections:[
    {id:'overview',group:'overview',title:'컨트랙트 개요',intro:'실제 소스를 확보해 정적으로 분석하고, 별도 사설 빌드로 동작을 대조했습니다.',facts:[['전체 상태','UNKNOWN · 실제 기준 블록과 runtime 미확인'],['소스 분석','REVIEW_REQUIRED · 안전성 인증 아님'],['실제 읽기','첫 PIN 요청 1회 시도 / 정상 반환 0회'],['분석 기준일','2026-10-26 · 정확한 분석 시각은 이 발췌에 미포함'],['원래 실패 시도 시각','2026-10-26T00:33:22.564Z · 블록 관측 시각 아님']]},
    {id:'source',group:'overview',title:'소스 검증',intro:'공급자의 검증 주장, 소스 hash 비교와 실제 배포 연결은 서로 다른 근거입니다.',facts:[['선택 소스','Multicall3.sol:Multicall3 · 1파일 · ABI 16함수'],['공급자 주장','runtime exact_match · 새 RPC 검증 아님'],['metadata source hash','확보 content와 일치 · metadata 진위 인증 아님'],['원본 compiler','0.8.12+commit.f00d7308 · 독립 재컴파일 NOT_RUN'],['분석·사설 compiler','0.8.37+commit.f401782d.Emscripten.clang · pragma 제거 사본'],['새 RPC runtime hash','UNKNOWN']]},
    {id:'architecture',group:'overview',title:'구조·Proxy',intro:'선택 소스의 직접 CALL 구조를 확인했습니다. 실제 배포의 Proxy 및 dispatch 관측은 UNKNOWN입니다.',notes:['EIP1967·Beacon·minimal Proxy·UUPS의 실제 관측은 첫 RPC 실패로 미확인입니다.','소스에 직접 DELEGATECALL·storage 변수·modifier가 없다는 사실을 실제 체인의 권한 또는 Proxy 부재로 바꾸지 않습니다.','custom Proxy·Multisig·Timelock 구성과 실제 upgrade 권한은 미확인입니다.']},
    {id:'functions',group:'behavior',title:'함수 목록',intro:'선택 소스의 16함수 · 줄 번호는 보존된 원본 소스 기준입니다.',columns:['함수','역할','원본 줄'],rows:[
      ['aggregate','순차 CALL · 전체 성공 필수','41'],['tryAggregate','requireSuccess 선택','60'],['tryBlockAndAggregate','내부 tryAggregate · 블록 정보','79'],['blockAndAggregate','내부 tryBlockAndAggregate','91'],['aggregate3','allowFailure 선택 · value 전달 없음','98'],['aggregate3Value','호출별 value · 마지막 합계 비교','129'],
      ['getBlockHash','요청 블록 hash','165'],['getBlockNumber','현재 블록 번호','170'],['getCurrentBlockCoinbase','coinbase','175'],['getCurrentBlockDifficulty','difficulty 명칭 getter · fork 의미 미검증','180'],['getCurrentBlockGasLimit','gas limit','185'],['getCurrentBlockTimestamp','timestamp','190'],['getEthBalance','명시 주소 ETH balance','195'],['getLastBlockHash','이전 블록 hash','200'],['getBasefee','basefee','208'],['getChainId','chain ID','213']
    ]},
    {id:'calls',group:'behavior',title:'호출 흐름',intro:'CALL 4곳 · 내부 호출 2곳을 소스에서 확인했습니다.',notes:['직접 CALL에서 target의 msg.sender는 Multicall3 실행 주소입니다.','aggregate3의 target msg.value는 0, aggregate3Value는 호출별 값을 전달합니다.','외부 wallet이 이 코드를 DELEGATECALL하면 후속 CALL의 sender와 실행 주소·잔액·storage 문맥은 wallet입니다. Multicall3 자체의 DELEGATECALL을 뜻하지 않습니다.','임의 calldata 의미·외부 target 구현·동적 dispatch·재진입 경로를 완전히 증명하지 않습니다.']},
    {id:'assets',group:'behavior',title:'자산 흐름',intro:'사설 빌드에서 관측한 값이며 실제 배포의 잔액이나 자산 안전성 증거가 아닙니다.',facts:[['aggregate3','사설 7 wei 잔존 · value 전달/refund 없는 경로'],['aggregate3Value 허용 실패','사설 추가 5 wei 잔존 · 성공 호출 2 wei 전달'],['가치 합계 불일치','사설 rollback 검증'],['unchecked 합계 공격','NOT_TESTED · wrapped-total 공격 미실행']]},
    {id:'access',group:'risks',title:'접근 제어',intro:'전체 권한 보장은 UNKNOWN입니다. 소스 조건과 실제 역할 설정을 구분합니다.',notes:['modifier·guard와 직접 상태 쓰기 관계는 정적 보조 근거입니다.','외부 wallet의 접근 제어와 target 정책, 실제 역할 계정·Multisig·Timelock 설정은 별도 검토가 필요합니다.','권한 함수명이나 modifier의 부재만으로 무제한 접근을 확정하지 않습니다.']},
    {id:'findings',group:'risks',title:'보안 검토 항목',intro:'REVIEW_REQUIRED · 코드 패턴과 사용 오용입니다. 실제 악용 가능한 취약점으로 확정하지 않습니다.',columns:['항목·위험도','근거와 검증 범위'],rows:[
      ['Approval 오용 · HIGH','aggregate3:98 / aggregate3Value:129 · 폐기 token·계정에서 타 계정의 allowance 사용 재현. 운영 allowance 미조회.'],
      ['payable 잔여 ETH · MEDIUM','aggregate3:98 · 사설 7 wei 잔존 재현.'],
      ['허용 실패 value 잔존 · MEDIUM','aggregate3Value:129 · 실패 호출 가치 잔존과 성공 호출 전달 재현.'],
      ['unchecked 합계 · HIGH','aggregate3Value:129 · 소스 조건 확인. 일반 합계 검사만 검증, 공격은 NOT_TESTED.'],
      ['delegated 통합 문맥 · HIGH','외부 wallet → aggregate3Value:129 · sender/value/storage 대조. wallet 권한은 별도 검토.'],
      ['조회 배치 상태 의미 · MEDIUM','aggregate3:98 · CALL 상태 영향과 eth_call 종료 후 비영속을 사설 재현. STATICCALL 강제 아님.']
    ],notes:['일반 규칙 11개와 digest 기반 4개 finding은 중복될 수 있습니다. 15개의 독립 취약점을 발견했다는 의미가 아닙니다.']},
    {id:'usage',group:'risks',title:'사용 위험·권장 조건',intro:'범용 실행기의 사용 문맥에 따른 검토 조건입니다.',notes:['조회는 기준 블록 고정, calldata·target allowlist, value 0, 성공 flag 전수 확인을 적용합니다.','공개 executor에 ERC-20 spender 승인을 부여하지 않고 잔여 ETH 보관소로 사용하지 않습니다.','상태 변경 통합 시 caller·수취인·값·실패 정책을 검토합니다.','Delegatecall 통합에는 wallet의 실제 권한 및 호출 정책 검토가 필요합니다.']},
    {id:'experiments',group:'evidence',title:'사설 검증·도구',intro:'새 소유 loopback Anvil에서 10항목 PASS / FAIL 0. 개별 시나리오의 성공입니다.',facts:[['사설 검증 범위','CALL/delegated 문맥 · state/event · 부분 실패 · 가치 불일치 rollback · 잔여 ETH · Approval 오용'],['빌드 한계','원본 0.8.12 배포 재현 아님 · pragma 제거 사본 + 설치 0.8.37'],['Slither','NOT_RUN / UNKNOWN · 설치 및 자동 실행 없음'],['공개 체인 거래·서명','실행 없음'],['실험 기록','로컬 기록이며 인증된 제3자 증명 아님']]},
    {id:'evidence',group:'evidence',title:'근거·미확인',intro:'검토한 연구 기록의 수동 발췌입니다. 웹은 원문 보고서나 snapshot을 읽지 않습니다.',facts:[['연구 출처','docs/research/2026-10-26-contract-review-multicall3.md'],['소스 SHA-256','2054218939d3fa0f52f8ce1a33658d570a550671f63197356ee5744f7e188b1e'],['공급자 runtime keccak256','0xd5c15df687b16f2ff992fc8d767b4216323184a2bbc6ee2f9c398c318e770891 · 공급자 두 artifact의 일치'],['기준 block/hash · 배포 연결','UNKNOWN · 공급자 hash로 대체하지 않음']],notes:['실제 runtime·기준 블록·Proxy, 원본 compiler 재컴파일, 외부 target·동적 권한·재진입·프로토콜 불변식은 미완료입니다. unchecked wrapped-total 공격은 NOT_TESTED입니다.','실패한 최초 RPC 소비는 보존됐습니다. 새 외부 실행에는 별도 대상·endpoint·한도 확인이 필요합니다.','기존 토큰 호환성 PASS/FAIL·SOURCE_REVIEWED 및 지원 판정에 합산하지 않습니다.']}
  ]
}];
