import {top10SourceProfiles} from './source-review-top10-data.js';
// Reviewed public excerpts of the stored 2026-10-25 research. No source archives or RPC inputs.
export const sourceReviewDate='2026-10-25';
export const sourceReviewNotice='저장 소스에서 함수·권한 조건을 확인했습니다. 확인 기준은 각 항목에 적힌 소스의 함수·modifier·조건입니다.';
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
const existingSourceProfiles=[
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
].map(profile=>({...profile,reviewedAt:sourceReviewDate,sourceReviewStatus:'SOURCE_REVIEWED',deploymentBinding:'UNKNOWN'}));
export const sourceReviewProfiles=[...existingSourceProfiles,...top10SourceProfiles];
export const sourceProfileKey=p=>p.networkKey??p.chainId;
export const sourceProfileStatus=p=>p.scopeLabel??'소스 확인 완료';
export const sourceScopeSummary=profiles=>{const counts=new Map();for(const p of profiles){const label=p.scopeLabel??'기존 소스 확인';counts.set(label,(counts.get(label)??0)+1);}return [...counts].map(([label,count])=>`${label} ${count}곳`).join(' · ');};
export function sourceReviewFor(coinId,key){return sourceReviewProfiles.find(p=>p.coinId===coinId&&sourceProfileKey(p)===key);}

// Source-path capabilities, independent of Assessment verdicts and deployment binding.
export const sourceFeatureCatalog=[
  ['transfer','전송','전송·승인'],['transferFrom','위임 전송','전송·승인'],
  ['approve','승인','전송·승인'],['revoke','승인 철회','전송·승인'],
  ['zeroReset','승인 전 0 초기화 강제','전송·승인'],['permit','서명 승인','전송·승인'],
  ['mint','발행','공급 관리'],['burn','소각','공급 관리'],
  ['pause','일시정지·재개','발행사 제어'],['blocklist','주소 차단·해제','발행사 제어'],
  ['forcedFunds','차단 자금 제어','발행사 제어'],['recovery','외부 토큰 회수','발행사 제어'],
  ['upgrade','구현 변경','발행사 제어'],['fee','전송 수수료 차감','전송 정책'],
].map(([id,label,group])=>({id,label,group}));
const present=(detail,evidence)=>({status:'PRESENT',detail,evidence});
const absent=(detail,evidence)=>({status:'ABSENT_IN_REVIEWED_PATH',detail,evidence});
const pending=detail=>({status:'NOT_REVIEWED',detail,evidence:'해당 기능의 소스 결론은 추가 검토 필요'});
const sourceFeatures={
  usdc:{
    transfer:present('transfer · pause와 송신·수신 주소 제한 검사. true 반환 구문.','FiatTokenV1:287–320; FiatTokenV2_2:215–225'),
    transferFrom:present('allowance와 from·caller·to 조건 확인 후 전송.','FiatTokenV1:258–278'),
    approve:present('approve·increaseAllowance·decreaseAllowance. 최종 V2.2 경로는 pause 조건.','FiatTokenV2_2:262–310; FiatTokenV2:211–238'),
    revoke:present('approve(spender,0)으로 allowance를 0으로 대입.','FiatTokenV1:_approve 239–250; FiatTokenV2_2:262–310'),
    zeroReset:absent('검토한 승인 경로에 기존 allowance의 선행 0 전환 조건 없음.','FiatTokenV2_2:262–310; FiatTokenV1:_approve 239–250'),
    permit:present('permit의 deadline·nonce·서명 검사 후 승인.','FiatTokenV2_2:95–102,275–284; EIP2612:56–111'),
    mint:present('minter·발행 한도·pause·주소 제한 조건. 공급량 증가.','FiatTokenV1:121–144'),
    burn:present('minter의 자기 잔액·양수 금액 조건. 공급량 감소.','FiatTokenV1:363–377'),
    pause:present('pauser의 pause/unpause.','Pausable:70–81'),
    blocklist:present('blacklister의 blacklist/unBlacklist.','Blacklistable:38–83; FiatTokenV2_2:196–256'),
    forcedFunds:pending('주소 차단과 별개인 차단 자금 파기·강제 이전 경로는 이 발췌에서 결론 내리지 않음.'),
    recovery:present('rescuer가 계약 보유 외부 ERC-20을 회수하는 rescueERC20.','Rescuable:43–59'),
    upgrade:pending('검토 입력은 구현 소스. 별도 proxy 업그레이드 함수·관리자 소스 대응은 확보하지 않음.'),
    fee:absent('검토한 _transfer는 동일 value를 차감·가산하며 수수료 차감 없음.','FiatTokenV1:_transfer 306–320'),
  },
  usdt:{
    transfer:present('local 전송에 pause·sender blacklist·잔액 조건과 수수료 분기. bool 출력 선언 없음.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT 전송·승인/발행사 제어'),
    transferFrom:present('유한 allowance 차감·MAX 유지. from 차단과 수수료 분기를 구분.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT allowance'),
    approve:present('deprecated=false의 local approve는 nonzero→nonzero를 거절. Approval 구문·bool 출력 선언 없음.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT 승인'),
    revoke:present('deprecated=false의 local 승인 0 초기화 경로. 전달 대상의 조건으로 확대하지 않음.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT 승인'),
    zeroReset:present('deprecated=false의 local 경로에서 nonzero→nonzero 변경 전 0 초기화 필요. 전달 대상은 별도.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT 승인'),
    permit:pending('서명 승인 경로의 유무는 기존 선택 소스 검토에서 결론 내리지 않음.'),
    mint:present('owner의 issue. owner 잔액·공급량 증가 경로.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT issue/redeem'),
    burn:present('owner의 redeem. owner 잔액·공급량 감소 경로.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT issue/redeem'),
    pause:present('owner의 pause·unpause.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT 발행사 제어'),
    blocklist:present('owner의 blacklist 관리.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT 발행사 제어'),
    forcedFunds:present('차단 자금 파기 경로. 일반 redeem이나 강제 이전과 구분.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT blacklisted funds 파기'),
    recovery:pending('issue/redeem과 별개인 외부 ERC-20 회수 경로의 유무는 추가 검토 필요.'),
    upgrade:present('owner의 deprecate로 전달 대상 변경. UUPS/proxy 업그레이드와 구분.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT deprecate'),
    fee:present('상한이 있는 fee 계산과 owner 수수료 전송 경로. 현재 설정값을 뜻하지 않음.','STABLECOIN_COMPATIBILITY_MATRIX: Ethereum USDT capped fee'),
  },
  rlusd:{
    transfer:present('transfer의 명시 true 반환. V2의 주소 제한과 조건부 from 예외를 구분.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD _update/V2'),
    transferFrom:present('유한 allowance 차감·MAX 유지. allowance 차감 시 emitEvent=false.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD allowance'),
    approve:present('caller·spender·global pause 검사 후 allowance 대입.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD 승인'),
    revoke:present('동일 승인 경로에서 allowance를 0으로 대입.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD 승인'),
    zeroReset:absent('검토한 approve 경로에서 선행 0 초기화를 강제하지 않음.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD 승인'),
    permit:present('owner·spender·caller/global pause 뒤 deadline·nonce·복구 signer 검사.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD permit'),
    mint:present('MINTER 역할의 발행 경로.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD 발행사 제어'),
    burn:present('BURNER 역할의 소각 경로.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD 발행사 제어'),
    pause:present('PAUSER 역할과 계정/global pause 조건.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD 발행사 제어'),
    blocklist:present('계정별 pause 제한 경로. blacklist라는 함수명과 동일시하지 않음.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD pause 조건'),
    forcedFunds:present('CLAWBACKER 역할의 clawback 경로.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD 발행사 제어'),
    recovery:pending('외부 ERC-20 회수 경로의 유무는 기존 선택 소스 검토에서 결론 내리지 않음.'),
    upgrade:present('UPGRADER 권한 hook과 onlyProxy UUPS 문맥.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD 발행사 제어'),
    fee:absent('검토한 _update 경로에 fee 차감 없음.','STABLECOIN_COMPATIBILITY_MATRIX: RLUSD _update'),
  },
  jpyc:{
    transfer:present('transfer에 pause·caller/수신 차단 조건.','FiatTokenV1.sol:287,333'),
    transferFrom:present('caller/from/to 차단·allowance 검사. MAX allowance는 차감 생략.','FiatTokenV1.sol:315,333'),
    approve:present('approve에 pause·caller/spender 차단·주소 0 검사.','FiatTokenV1.sol:251,269'),
    revoke:present('approve(spender,0)도 동일 조건으로 allowance 대입.','FiatTokenV1.sol:251,269'),
    zeroReset:absent('검토한 승인 본문에 기존 allowance를 먼저 0으로 요구하는 분기 없음.','FiatTokenV1.sol:251,269'),
    permit:present('permit 진입과 EIP2612 의존 소스. 서명 실행을 뜻하지 않음.','FiatTokenV1.sol:495,533,566,586'),
    mint:present('minter·수신 차단·pause·양수 금액·발행 한도 검사.','FiatTokenV1.sol:140,152'),
    burn:present('minter·pause·caller 차단·잔액 조건. 공급량 감소.','FiatTokenV1.sol:180'),
    pause:present('pauser 일치 조건의 pause/unpause.','Pausable.sol:62,70,78,94'),
    blocklist:present('blocklister 일치 조건의 blocklist/unBlocklist.','Blocklistable.sol:53,65,86,100'),
    forcedFunds:pending('주소 차단과 별개인 차단 자금 파기·강제 이전 경로는 기존 발췌에서 결론 내리지 않음.'),
    recovery:present('rescuer가 계약 보유 외부 ERC-20 회수.','Rescuable.sol:49,60'),
    upgrade:present('onlyProxy UUPS 진입과 onlyOwner 권한 hook.','UUPSUpgradeable.sol:82,95; FiatTokenV1.sol:598'),
    fee:pending('전송 수수료 차감 유무를 결론 낼 선택 경로 검토 근거가 이 발췌에 없음.'),
  },
  jpysc:{
    transfer:present('pause·caller/수신 차단 후 transfer.','StablecoinV1.sol:319,869'),
    transferFrom:present('caller/from/to 차단·allowance 소비. MAX 차감 생략.','StablecoinV1.sol:368,914'),
    approve:present('pause·caller/spender 차단 뒤 주소 0 검사·allowance 대입.','StablecoinV1.sol:348,896'),
    revoke:present('approve(spender,0)으로 allowance 대입. 발행 allowance 조건과 별도.','StablecoinV1.sol:348,896'),
    zeroReset:absent('일반 approve에는 선행 0 초기화 강제 없음. configureMinter의 발행 allowance 0 조건과 별개.','StablecoinV1.sol:348,592–658,896'),
    permit:pending('서명 전송/취소 소스만으로 permit의 존재를 대신 확정하지 않음.'),
    mint:present('minter·pause·주소 차단·minter별 수신 whitelist·양수 금액·발행 한도.','StablecoinV1.sol:108,658; Whitelistable.sol:45'),
    burn:present('minter의 자기 잔액·pause·차단 조건. 공급량 감소.','StablecoinV1.sol:694'),
    pause:present('pauser 일치 조건의 pause/unpause.','Pausable.sol:32,47'),
    blocklist:present('blacklister 일치 조건의 단건/일괄 blacklist 및 해제.','Blacklistable.sol:37,42,69,81'),
    forcedFunds:present('seizer의 seize: 차단 송신자 자금 강제 이전. pause 검사·공급량 갱신 없음.','Seizable.sol:36; StablecoinV1.sol:722'),
    recovery:present('assetRecoverer가 계약 보유 외부 ERC-20을 safeTransfer.','AssetRecovery.sol:36,53'),
    upgrade:present('UUPS 업그레이드에 별도 upgradeAuthority. owner와 역할 구분.','StablecoinV1.sol:124,231–266; UUPSUpgradeable.sol:88'),
    fee:pending('전송 수수료 차감 유무는 기존 선택 경로 발췌에서 결론 내리지 않음.'),
  },
};
export const sourceFeatureLabels={PRESENT:'있음',ABSENT_IN_REVIEWED_PATH:'없음',NOT_REVIEWED:'추가 검토',SOURCE_PRESENT:'소스 조건 확인',NOT_IN_REVIEWED_PATH:'없음(검토 경로)',PROTOCOL_CAPABILITY:'공통 프로토콜 기능',DOCUMENTED_ONLY:'공식 문서 기재',INPUT_REQUIRED:'추가 근거 필요',NOT_APPLICABLE:'해당 없음',STORED_SETTING:'과거 설정 관측'};
export function sourceFeaturesFor(coinId,chainId){
  const profile=sourceReviewFor(coinId,chainId);if(!profile)return [];
  if(profile.features)return profile.features.map(feature=>({...feature,profileId:profile.id}));
  return sourceFeatureCatalog.map(feature=>({...feature,...(sourceFeatures[coinId]?.[feature.id]??pending('해당 기능의 저장 소스 근거를 추가로 검토해야 합니다.')),profileId:profile.id}));
}
