// Reviewed public excerpts of the stored 2026-10-25 research. No source archives or RPC inputs.
export const sourceReviewDate='2026-10-25';
export const sourceReviewNotice='저장 소스의 함수·권한 조건을 검토한 내용입니다. 주소·설정은 저장 자료 기준이며 현재 공식 지원을 인증하지 않습니다. 실제 실행 성공, 현재 권한, 자산 안전성·취급 승인과는 별도입니다.';
const jpyc={
  coinId:'jpyc',symbol:'JPYC',address:'0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29',
  functions:[
    'transfer / transferFrom: pause·관련 주소 차단 검사. transferFrom의 최대 allowance는 차감 생략.',
    'approve / 승인 0: pause·caller/spender 차단 검사. 이전 allowance를 먼저 0으로 만드는 조건은 강제하지 않음.',
    'mint / burn: minter·pause·관련 주소 조건. 발행 한도와 양수 금액·잔액 조건을 구분.',
  ],
  authorities:[
    'minterAdmin: minter 지정·한도 관리. pauser: 정지·재개. blocklister: 주소 차단·해제.',
    'owner: 역할 변경·소유권 이전과 UUPS upgrade 권한. onlyProxy 진입 조건과 구분.',
    'rescuer: 외부 ERC-20 회수. 상대 토큰의 실제 동작은 미확인.',
  ],
  limitations:['서명 기반 permit/authorization·취소는 소스 조건만 검토했으며 서명·거래를 실행하지 않음.','상환·준비자산·입출금 서비스 운영은 검토 범위 밖.'],
};
export const sourceReviewProfiles=[
  {
    id:'usdc-ethereum',coinId:'usdc',symbol:'USDC',network:'Ethereum',chainId:'1',address:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    functions:['transfer / transferFrom: pause·주소 제한 조건.','V2.2 approve·승인 증감·철회: pause 조건. 선택 override에는 주소 제한 modifier가 없음.','승인 zero-reset을 강제하지 않음.'],
    authorities:['minter별 발행 한도와 masterMinter의 minter 관리 경로.','pauser·blacklister·rescuer·owner의 정지·차단·회수·역할 관리 경로.'],
    observation:'저장된 블록 26261502의 코드·getter 관측. 원본 관측 종료 2026-10-24T09:07:19.548Z.',
    bindingDetail:'저장 소스의 생성 runtime 전체 불일치. 소스와 관측의 대응 UNKNOWN.',
    limitations:['과거 고정 블록의 관측을 현재 상태로 확대하지 않음.','소스 검토는 기존 runtime 불일치를 해소하거나 실제 권한을 인증하지 않음.'],
    references:['2026-10-25-usdc-offline-source-review','2026-10-24-usdc-token-review-live'],
  },
  {
    id:'usdt-ethereum',coinId:'usdt',symbol:'USDT',network:'Ethereum',chainId:'1',address:'0xdAC17F958D2ee523a2206206994597C13D831ec7',
    functions:['local approve: nonzero→nonzero 거절. 반환 bool 선언이 없음.','전송: pause·sender/from blacklist 검사와 유한/MAX allowance 분기를 구분.'],
    authorities:['owner: issue/redeem·pause·blacklist·차단 자금 파기.','owner: fee 설정·deprecate 경로. 권한의 존재 자체를 취약점으로 판정하지 않음.'],
    observation:'2026-10-25 단발 읽기는 eth_chainId 첫 송신에서 실패. 신규 코드 관측 INCONCLUSIVE.',
    bindingDetail:'이전 MISMATCH와 이번 코드 미관측을 각각 보존. 배포 연결 UNKNOWN.',
    limitations:['읽기 실패 원인의 네트워크/HTTP/RPC 구분은 미확인.','고정 제3자 소스와 실제 발행사 revision·전달 대상 내부의 대응은 미확인.'],
    references:['2026-10-25-usdt-offline-recompile','2026-10-25-usdt-live-runtime-result'],
  },
  {
    id:'rlusd-ethereum',coinId:'rlusd',symbol:'RLUSD',network:'Ethereum',chainId:'1',address:'0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD',
    functions:['transfer / transferFrom: 명시 true 반환과 유한/MAX allowance 분기.','승인: caller/spender/global pause 조건.','V2 전송 제한의 조건부 from 예외를 구분.'],
    authorities:['MINTER / BURNER / CLAWBACKER / PAUSER / UPGRADER의 역할 경로.','role admin과 UUPS upgrade 권한 hook을 구분.'],
    observation:'저장 35소스의 컴파일·정적 관계를 확인. 이번 기술 검토 묶음에는 별도 고정 블록 코드 관측 없음.',
    bindingDetail:'V2 소스 snapshot과 실제 구현의 연결 UNKNOWN.',
    limitations:['컴파일 성공은 실제 배포 동일성이나 반환·이벤트 실행의 증거가 아님.','현재 역할값·실제 권한 행사는 인증하지 않음.'],
    references:['2026-10-25-rlusd-jpysc-offline-source-review','STABLECOIN_COMPATIBILITY_MATRIX'],
  },
  {
    ...jpyc,id:'jpyc-ethereum',network:'Ethereum',chainId:'1',
    observation:'블록 26264212에서 프록시 runtime 전체 일치 CONFIRMED. 원본 관측 종료 2026-10-24T18:10:36.188Z.',
    bindingDetail:'프록시만 과거 고정 블록에서 CONFIRMED. 구현체 연결 UNKNOWN으로 전체 PARTIAL 유지.',
    references:['2026-10-25-jpy-public-html-source-review','2026-10-25-jpyc-token-review-live'],
  },
  ...[['Polygon','137'],['Avalanche','43114']].map(([network,chainId])=>({
    ...jpyc,id:`jpyc-${network.toLowerCase()}`,network,chainId,
    observation:'저장 proxy/implementation 후보는 Ethereum의 저장 컴파일 입력과 각각 바이트 동일. 해당 체인의 고정 코드 관측 없음.',
    bindingDetail:'배포 연결 UNKNOWN. Ethereum의 프록시 관측을 이 체인에 적용하지 않음.',
    references:['2026-10-25-jpy-public-html-source-review'],
  })),
  {
    ...jpyc,id:'jpyc-kaia',network:'Kaia',chainId:'8217',
    observation:'프록시 6소스·구현체 전체 17소스/26 import 확보. 기존 JPYC와 원본 줄바꿈 차이·별도 텍스트 진단 결과를 구분.',
    bindingDetail:'explorer 부분 일치는 독립 전체 runtime 일치가 아님. 체인 코드 미관측·배포 연결 UNKNOWN.',
    limitations:[...jpyc.limitations,'소스 텍스트 검토를 재사용했으며 원본 바이트를 정규화하거나 다른 체인 소스로 대체하지 않음.'],
    references:['2026-10-25-kaia-code-view-source-intake','2026-10-25-jpy-public-html-source-review'],
  },
  {
    id:'jpysc-ethereum',coinId:'jpysc',symbol:'JPYSC',network:'Ethereum',chainId:'1',address:'0x6781d5631BFe47432b089e64e3EaB3b6eDd26177',
    functions:['transfer / transferFrom / approve: pause·관련 주소 차단 검사. 최대 allowance 차감 생략.','mint: minter별 수신 whitelist·발행 한도. 일반 transfer/approve의 필수 whitelist 조건으로 확대하지 않음.','configureMinter의 발행 allowance 0 조건과 일반 approve를 구분.'],
    authorities:['minterAdmin / whitelistManager / pauser / blacklister의 관리 경로.','seizer: 차단된 송신자의 자금 강제 이전. 선택 진입에는 pause 검사 없음. 공급량 갱신 없음.','assetRecoverer: 외부 토큰 회수. 2단계 owner와 별도 upgradeAuthority를 구분.','initialize: 선언 42개·간선 60개, 8개 0주소 검사·3쌍 역할 분리·owner override/super를 수동 보완.'],
    observation:'저장 41소스 분석·컴파일과 initialize 수동 보완. 이번 기술 검토 묶음에는 고정 블록 코드 관측 없음.',
    bindingDetail:'배포 연결 UNKNOWN. 기존 자동 CALL_LIMIT / DECLARATION_LIMIT 절단 표시 유지.',
    limitations:['수동 보완은 선택 initialize 경로이며 전체 권한 불변식·assembly/storage 의미를 보장하지 않음.','소스 주석의 제도·timelock·다중서명은 현재 배포 설정의 증거가 아님.','실제 서명·거래·외부 회수 토큰의 동작은 미확인.'],
    references:['2026-10-25-jpy-public-html-source-review','2026-10-25-jpysc-initialize-manual-review','2026-10-25-rlusd-jpysc-offline-source-review'],
  },
].map(profile=>({...profile,reviewedAt:sourceReviewDate,deploymentBinding:'UNKNOWN'}));
export function sourceReviewFor(coinId,chainId){return sourceReviewProfiles.find(p=>p.coinId===coinId&&p.chainId===chainId);}
