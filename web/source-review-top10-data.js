// Generated offline by tools/top10-profile-excerpts.mjs. Reviewed excerpts only.
export const top10SourceProfiles=[
  {
    "id": "usdc-base",
    "coinId": "usdc",
    "symbol": "USDC",
    "network": "Base",
    "networkKey": "8453",
    "chainId": "8453",
    "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "identityLabel": "저장 주소 후보",
    "reviewScope": "INITIAL_TOKEN_LOGIC_CANDIDATE",
    "scopeLabel": "초기 구현 후보 소스",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "전송·위임 전송",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "pause 및 caller/from/to 차단 검사. bool 반환. transferFrom은 MAX도 allowance 차감.",
        "evidence": "D:00 FiatTokenV1.sol:244-285"
      },
      {
        "id": "scope-1",
        "label": "승인·철회",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "approve(value) 덮어쓰기와 approve(0), increase/decreaseAllowance. zero-reset 조건은 선택 경로에 없음.",
        "evidence": "D:00 FiatTokenV1.sol:208-239 · D:00 FiatTokenV2.sol:57-86"
      },
      {
        "id": "scope-2",
        "label": "서명 승인·전송",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "EIP2612 permit 및 EIP3009 authorization: domain/signature/nonce 또는 사용 여부/시간 조건, pause·차단 검사.",
        "evidence": "D:00 FiatTokenV2.sol:99-207 · D:00 EIP2612.sol · D:00 EIP3009.sol"
      },
      {
        "id": "scope-3",
        "label": "발행·소각",
        "group": "공급·관리",
        "status": "SOURCE_PRESENT",
        "detail": "발행은 minter·allowance·pause·차단·양수; 소각은 minter·pause·차단·양수·잔액.",
        "evidence": "D:00 FiatTokenV1.sol:101-137,347-372"
      },
      {
        "id": "scope-4",
        "label": "일시정지·주소 차단",
        "group": "공급·관리",
        "status": "SOURCE_PRESENT",
        "detail": "pauser, blacklister 역할과 owner의 역할 교체. 현재 역할 주소 수집/권한 행사는 요구하지 않음.",
        "evidence": "D:00 Pausable.sol · D:00 Blacklistable.sol · D:00 Ownable.sol"
      },
      {
        "id": "scope-5",
        "label": "전송 수수료·재기준화",
        "group": "전송 특성",
        "status": "NOT_IN_REVIEWED_PATH",
        "detail": "검토한 _transfer의 수량 이동에 수수료/잔액 재기준화 분기 없음.",
        "evidence": "D:00 FiatTokenV1.sol:292-305"
      },
      {
        "id": "scope-6",
        "label": "프록시 관리",
        "group": "업그레이드",
        "status": "SOURCE_PRESENT",
        "detail": "admin 전용 변경·upgradeTo/AndCall. admin은 일반 fallback 금지.",
        "evidence": "A:00 AdminUpgradeabilityProxy.sol:58-64,99-169"
      }
    ],
    "limitations": [
      "3개 네트워크의 선택 FiatTokenV2_1 계열 주요 단위 hash 동일. 생성자 초기 로직 연결이며 이후 upgrade를 반영하지 않음. 현재 구현 연결은 이 소스 검토의 필수조건이 아님.",
      "선택 소스에 없는 기능을 전체 배포의 기능 부재로 확대하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "A:00",
        "state": "SOURCE_STORED",
        "sha256": "2578163929adbea156b5b5bdcb4a79b235e8c2b7a033690167295642eb9180bd",
        "requestedAt": "2026-10-25T06:37:26.099Z"
      },
      {
        "id": "C2:00",
        "state": "CONSTRUCTOR_METADATA_STORED",
        "sha256": "a2395336cb13fa23d3a8a0de5ba0ba2cdb831106bbb4a483d7ed39703b4d9103",
        "requestedAt": "2026-10-25T07:16:15.150Z"
      },
      {
        "id": "D:00",
        "state": "SOURCE_STORED",
        "sha256": "addbca95e8b417ab9f26c2553e0b4115b00b7685ac3c638067564cc885fe2e5a",
        "requestedAt": "2026-10-25T07:19:16.137Z"
      }
    ],
    "functions": [
      "pause 및 caller/from/to 차단 검사. bool 반환. transferFrom은 MAX도 allowance 차감.",
      "approve(value) 덮어쓰기와 approve(0), increase/decreaseAllowance. zero-reset 조건은 선택 경로에 없음.",
      "EIP2612 permit 및 EIP3009 authorization: domain/signature/nonce 또는 사용 여부/시간 조건, pause·차단 검사.",
      "검토한 _transfer의 수량 이동에 수수료/잔액 재기준화 분기 없음."
    ],
    "authorities": [
      "발행은 minter·allowance·pause·차단·양수; 소각은 minter·pause·차단·양수·잔액.",
      "pauser, blacklister 역할과 owner의 역할 교체. 현재 역할 주소 수집/권한 행사는 요구하지 않음.",
      "admin 전용 변경·upgradeTo/AndCall. admin은 일반 fallback 금지."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdc-arbitrum",
    "coinId": "usdc",
    "symbol": "USDC",
    "network": "Arbitrum",
    "networkKey": "42161",
    "chainId": "42161",
    "address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "identityLabel": "저장 주소 후보",
    "reviewScope": "INITIAL_TOKEN_LOGIC_CANDIDATE",
    "scopeLabel": "초기 구현 후보 소스",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "전송·위임 전송",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "pause 및 caller/from/to 차단 검사. bool 반환. transferFrom은 MAX도 allowance 차감.",
        "evidence": "D:01 FiatTokenV1.sol:244-285"
      },
      {
        "id": "scope-1",
        "label": "승인·철회",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "approve(value) 덮어쓰기와 approve(0), increase/decreaseAllowance. zero-reset 조건은 선택 경로에 없음.",
        "evidence": "D:01 FiatTokenV1.sol:208-239 · D:01 FiatTokenV2.sol:57-86"
      },
      {
        "id": "scope-2",
        "label": "서명 승인·전송",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "EIP2612 permit 및 EIP3009 authorization: domain/signature/nonce 또는 사용 여부/시간 조건, pause·차단 검사.",
        "evidence": "D:01 FiatTokenV2.sol:99-207 · D:01 EIP2612.sol · D:01 EIP3009.sol"
      },
      {
        "id": "scope-3",
        "label": "발행·소각",
        "group": "공급·관리",
        "status": "SOURCE_PRESENT",
        "detail": "발행은 minter·allowance·pause·차단·양수; 소각은 minter·pause·차단·양수·잔액.",
        "evidence": "D:01 FiatTokenV1.sol:101-137,347-372"
      },
      {
        "id": "scope-4",
        "label": "일시정지·주소 차단",
        "group": "공급·관리",
        "status": "SOURCE_PRESENT",
        "detail": "pauser, blacklister 역할과 owner의 역할 교체. 현재 역할 주소 수집/권한 행사는 요구하지 않음.",
        "evidence": "D:01 Pausable.sol · D:01 Blacklistable.sol · D:01 Ownable.sol"
      },
      {
        "id": "scope-5",
        "label": "전송 수수료·재기준화",
        "group": "전송 특성",
        "status": "NOT_IN_REVIEWED_PATH",
        "detail": "검토한 _transfer의 수량 이동에 수수료/잔액 재기준화 분기 없음.",
        "evidence": "D:01 FiatTokenV1.sol:292-305"
      },
      {
        "id": "scope-6",
        "label": "프록시 관리",
        "group": "업그레이드",
        "status": "SOURCE_PRESENT",
        "detail": "admin 전용 변경·upgradeTo/AndCall. admin은 일반 fallback 금지.",
        "evidence": "A:01 AdminUpgradeabilityProxy.sol:58-64,99-169"
      }
    ],
    "limitations": [
      "3개 네트워크의 선택 FiatTokenV2_1 계열 주요 단위 hash 동일. 생성자 초기 로직 연결이며 이후 upgrade를 반영하지 않음. 현재 구현 연결은 이 소스 검토의 필수조건이 아님.",
      "선택 소스에 없는 기능을 전체 배포의 기능 부재로 확대하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "A:01",
        "state": "SOURCE_STORED",
        "sha256": "9a35b4812c69bc24fe8eea8fe9d1ce5872b528a50259bbac1ee461010ddaf9b3",
        "requestedAt": "2026-10-25T06:37:27.339Z"
      },
      {
        "id": "C2:01",
        "state": "CONSTRUCTOR_METADATA_STORED",
        "sha256": "7231de19c138b1ef5eb59b5e1818b3eb902404e8ef1d18ed89bd914c1f374c68",
        "requestedAt": "2026-10-25T07:16:15.472Z"
      },
      {
        "id": "D:01",
        "state": "SOURCE_STORED",
        "sha256": "146b3ea5c6fbb8702ae10c155cd9956014cc6a0e94ce79ed3a45d89ae43bf0c6",
        "requestedAt": "2026-10-25T07:19:16.840Z"
      }
    ],
    "functions": [
      "pause 및 caller/from/to 차단 검사. bool 반환. transferFrom은 MAX도 allowance 차감.",
      "approve(value) 덮어쓰기와 approve(0), increase/decreaseAllowance. zero-reset 조건은 선택 경로에 없음.",
      "EIP2612 permit 및 EIP3009 authorization: domain/signature/nonce 또는 사용 여부/시간 조건, pause·차단 검사.",
      "검토한 _transfer의 수량 이동에 수수료/잔액 재기준화 분기 없음."
    ],
    "authorities": [
      "발행은 minter·allowance·pause·차단·양수; 소각은 minter·pause·차단·양수·잔액.",
      "pauser, blacklister 역할과 owner의 역할 교체. 현재 역할 주소 수집/권한 행사는 요구하지 않음.",
      "admin 전용 변경·upgradeTo/AndCall. admin은 일반 fallback 금지."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdc-polygon",
    "coinId": "usdc",
    "symbol": "USDC",
    "network": "Polygon",
    "networkKey": "137",
    "chainId": "137",
    "address": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "identityLabel": "저장 주소 후보",
    "reviewScope": "INITIAL_TOKEN_LOGIC_CANDIDATE",
    "scopeLabel": "초기 구현 후보 소스",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "전송·위임 전송",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "pause 및 caller/from/to 차단 검사. bool 반환. transferFrom은 MAX도 allowance 차감.",
        "evidence": "D:02 FiatTokenV1.sol:244-285"
      },
      {
        "id": "scope-1",
        "label": "승인·철회",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "approve(value) 덮어쓰기와 approve(0), increase/decreaseAllowance. zero-reset 조건은 선택 경로에 없음.",
        "evidence": "D:02 FiatTokenV1.sol:208-239 · D:02 FiatTokenV2.sol:57-86"
      },
      {
        "id": "scope-2",
        "label": "서명 승인·전송",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "EIP2612 permit 및 EIP3009 authorization: domain/signature/nonce 또는 사용 여부/시간 조건, pause·차단 검사.",
        "evidence": "D:02 FiatTokenV2.sol:99-207 · D:02 EIP2612.sol · D:02 EIP3009.sol"
      },
      {
        "id": "scope-3",
        "label": "발행·소각",
        "group": "공급·관리",
        "status": "SOURCE_PRESENT",
        "detail": "발행은 minter·allowance·pause·차단·양수; 소각은 minter·pause·차단·양수·잔액.",
        "evidence": "D:02 FiatTokenV1.sol:101-137,347-372"
      },
      {
        "id": "scope-4",
        "label": "일시정지·주소 차단",
        "group": "공급·관리",
        "status": "SOURCE_PRESENT",
        "detail": "pauser, blacklister 역할과 owner의 역할 교체. 현재 역할 주소 수집/권한 행사는 요구하지 않음.",
        "evidence": "D:02 Pausable.sol · D:02 Blacklistable.sol · D:02 Ownable.sol"
      },
      {
        "id": "scope-5",
        "label": "전송 수수료·재기준화",
        "group": "전송 특성",
        "status": "NOT_IN_REVIEWED_PATH",
        "detail": "검토한 _transfer의 수량 이동에 수수료/잔액 재기준화 분기 없음.",
        "evidence": "D:02 FiatTokenV1.sol:292-305"
      },
      {
        "id": "scope-6",
        "label": "프록시 관리",
        "group": "업그레이드",
        "status": "SOURCE_PRESENT",
        "detail": "admin 전용 변경·upgradeTo/AndCall. admin은 일반 fallback 금지.",
        "evidence": "A:02 AdminUpgradeabilityProxy.sol:58-64,99-169"
      }
    ],
    "limitations": [
      "3개 네트워크의 선택 FiatTokenV2_1 계열 주요 단위 hash 동일. 생성자 초기 로직 연결이며 이후 upgrade를 반영하지 않음. 현재 구현 연결은 이 소스 검토의 필수조건이 아님.",
      "선택 소스에 없는 기능을 전체 배포의 기능 부재로 확대하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "A:02",
        "state": "SOURCE_STORED",
        "sha256": "1b9a7d29d1e38c2286349655b789f657dd6a3a32582273cb520f501eb0bcf712",
        "requestedAt": "2026-10-25T06:37:27.669Z"
      },
      {
        "id": "C2:02",
        "state": "CONSTRUCTOR_METADATA_STORED",
        "sha256": "9c48d6f3464a51f7c6ed9b33482e492fdd5107e9dafc71c07b49cfb0597f178b",
        "requestedAt": "2026-10-25T07:16:15.764Z"
      },
      {
        "id": "D:02",
        "state": "SOURCE_STORED",
        "sha256": "d0d75522638779b217cb51913178e51e88f74b5f697da4a3a9574f06f786f8ea",
        "requestedAt": "2026-10-25T07:19:17.293Z"
      }
    ],
    "functions": [
      "pause 및 caller/from/to 차단 검사. bool 반환. transferFrom은 MAX도 allowance 차감.",
      "approve(value) 덮어쓰기와 approve(0), increase/decreaseAllowance. zero-reset 조건은 선택 경로에 없음.",
      "EIP2612 permit 및 EIP3009 authorization: domain/signature/nonce 또는 사용 여부/시간 조건, pause·차단 검사.",
      "검토한 _transfer의 수량 이동에 수수료/잔액 재기준화 분기 없음."
    ],
    "authorities": [
      "발행은 minter·allowance·pause·차단·양수; 소각은 minter·pause·차단·양수·잔액.",
      "pauser, blacklister 역할과 owner의 역할 교체. 현재 역할 주소 수집/권한 행사는 요구하지 않음.",
      "admin 전용 변경·upgradeTo/AndCall. admin은 일반 fallback 금지."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdc-bsc",
    "coinId": "usdc",
    "symbol": "USDC",
    "network": "BNB Smart Chain",
    "networkKey": "56",
    "chainId": "56",
    "address": "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    "identityLabel": "저장 주소 후보",
    "reviewScope": "INITIAL_TOKEN_LOGIC_CANDIDATE",
    "scopeLabel": "초기 구현 후보 소스",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "전송·승인·철회",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "bool 전송/transferFrom, allowance 차감(MAX 예외 없음); approve 덮어쓰기/0 및 증감.",
        "evidence": "D:07 BEP20TokenImplementation.sol:475-550"
      },
      {
        "id": "scope-1",
        "label": "발행·소각",
        "group": "공급·관리",
        "status": "SOURCE_PRESENT",
        "detail": "mint는 onlyOwner 및 _mintable=true. burn은 호출자 잔액. 현재 mintable 설정은 관측하지 않음.",
        "evidence": "D:07 BEP20TokenImplementation.sol:562-574"
      },
      {
        "id": "scope-2",
        "label": "수수료·차단·정지·permit",
        "group": "전송 특성",
        "status": "NOT_IN_REVIEWED_PATH",
        "detail": "선택된 초기 구현의 전체 코드 및 _transfer/approve 경로에 해당 분기/진입점 없음.",
        "evidence": "D:07 BEP20TokenImplementation.sol:349-667"
      },
      {
        "id": "scope-3",
        "label": "프록시 관리",
        "group": "업그레이드",
        "status": "SOURCE_PRESENT",
        "detail": "BEP20UpgradeableProxy의 admin과 upgrade 경로. 토큰 owner와 proxy admin은 서로 다른 조건.",
        "evidence": "B:17"
      }
    ],
    "limitations": [
      "BSC 집계 공급과 이 주소의 대응/담보는 확인하지 않음. DEX 목록은 주소 후보 근거이며 Circle native 발행 인증이 아님.",
      "초기 구현 후보; 현재 decimals/owner/mintable 및 구현 버전은 새 RPC로 읽지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "B:17",
        "state": "SOURCE_STORED",
        "sha256": "ccea7ab82b942fcbdd4ba480d9597a7a22947617bfbe7eff3430a41075515a91",
        "requestedAt": "2026-10-25T06:48:39.483Z"
      },
      {
        "id": "C2:08",
        "state": "CONSTRUCTOR_METADATA_STORED",
        "sha256": "25a143d06010612f2d53a6f534615f74eb1d64f33df662b18da2cf1bcf598e7a",
        "requestedAt": "2026-10-25T07:16:17.434Z"
      },
      {
        "id": "D:07",
        "state": "SOURCE_STORED",
        "sha256": "6ee31280199f5a678bd498c7dac31aeb250e4fc6e9f463442b2d4688dbceafbc",
        "requestedAt": "2026-10-25T07:19:19.149Z"
      },
      {
        "id": "B:19",
        "state": "DOCUMENT_STORED",
        "sha256": "a53df1241f87bb7e44232994b55024abe71278449391e0952378a533c479c46a",
        "requestedAt": "2026-10-25T06:48:41.071Z"
      }
    ],
    "functions": [
      "bool 전송/transferFrom, allowance 차감(MAX 예외 없음); approve 덮어쓰기/0 및 증감.",
      "선택된 초기 구현의 전체 코드 및 _transfer/approve 경로에 해당 분기/진입점 없음."
    ],
    "authorities": [
      "mint는 onlyOwner 및 _mintable=true. burn은 호출자 잔액. 현재 mintable 설정은 관측하지 않음.",
      "BEP20UpgradeableProxy의 admin과 upgrade 경로. 토큰 owner와 proxy admin은 서로 다른 조건."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdt-bsc",
    "coinId": "usdt",
    "symbol": "USDT",
    "network": "BNB Smart Chain",
    "networkKey": "56",
    "chainId": "56",
    "address": "0x55d398326f99059ff775485246999027b3197955",
    "identityLabel": "저장 주소 후보",
    "reviewScope": "DIRECT_TOKEN_SOURCE",
    "scopeLabel": "토큰 로직 소스",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "전송·승인·철회",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "bool 전송/위임 전송, allowance는 MAX도 차감. approve 덮어쓰기/0 및 증감.",
        "evidence": "B:18 BEP20USDT.sol:411-489"
      },
      {
        "id": "scope-1",
        "label": "발행·소각",
        "group": "공급·관리",
        "status": "SOURCE_PRESENT",
        "detail": "mint는 onlyOwner, 자기 잔액 소각 burn은 일반 호출자.",
        "evidence": "B:18 BEP20USDT.sol:497-507"
      },
      {
        "id": "scope-2",
        "label": "수수료·차단·정지·permit",
        "group": "전송 특성",
        "status": "NOT_IN_REVIEWED_PATH",
        "detail": "선택된 BEP20USDT 전체 코드에 별도 해당 진입점/분기 없음. _transfer는 잔액 차감/가산.",
        "evidence": "B:18 BEP20USDT.sol:341-602"
      }
    ],
    "limitations": [
      "선택 BSC 래핑 후보이며 Tether native 계약과 동일하지 않음. DEX 목록/소스는 담보·상환 증명이 아님.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "B:18",
        "state": "SOURCE_STORED",
        "sha256": "2552eb5f968a866b8fa2c96584fc2b2cf42c32bee03939d68e4b5e1efeeacff1",
        "requestedAt": "2026-10-25T06:48:40.721Z"
      },
      {
        "id": "B:19",
        "state": "DOCUMENT_STORED",
        "sha256": "a53df1241f87bb7e44232994b55024abe71278449391e0952378a533c479c46a",
        "requestedAt": "2026-10-25T06:48:41.071Z"
      }
    ],
    "functions": [
      "bool 전송/위임 전송, allowance는 MAX도 차감. approve 덮어쓰기/0 및 증감.",
      "선택된 BEP20USDT 전체 코드에 별도 해당 진입점/분기 없음. _transfer는 잔액 차감/가산."
    ],
    "authorities": [
      "mint는 onlyOwner, 자기 잔액 소각 burn은 일반 호출자."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdt-polygon",
    "coinId": "usdt",
    "symbol": "USDT",
    "network": "Polygon",
    "networkKey": "137",
    "chainId": "137",
    "address": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    "identityLabel": "저장 주소 후보",
    "reviewScope": "INITIAL_TOKEN_LOGIC_CANDIDATE",
    "scopeLabel": "초기 구현 후보 소스",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "전송·승인·철회",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "ERC20 bool 전송, allowance 차감(MAX 예외 없음), approve 덮어쓰기/0 및 증감.",
        "evidence": "D:04 UChildERC20.sol:552-717"
      },
      {
        "id": "scope-1",
        "label": "브리지 발행·소각",
        "group": "공급·관리",
        "status": "SOURCE_PRESENT",
        "detail": "deposit는 DEPOSITOR_ROLE로 mint, withdraw는 호출자 잔액 burn.",
        "evidence": "D:04 UChildERC20.sol:1538-1554"
      },
      {
        "id": "scope-2",
        "label": "메타 트랜잭션",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "nonce·EIP712 서명 확인 및 self-call/context sender. ERC2612 permit으로 분류하지 않음.",
        "evidence": "D:04 UChildERC20.sol:1347-1469"
      },
      {
        "id": "scope-3",
        "label": "수수료·차단·정지",
        "group": "전송 특성",
        "status": "NOT_IN_REVIEWED_PATH",
        "detail": "선택 초기 UChildERC20 구현에서 해당 전송 분기/진입점 없음.",
        "evidence": "D:04 UChildERC20.sol:643-717,1489-1555"
      },
      {
        "id": "scope-4",
        "label": "프록시 관리",
        "group": "업그레이드",
        "status": "SOURCE_PRESENT",
        "detail": "onlyProxyOwner 및 비영·contract 구현 검사; updateImplementation/updateAndCall.",
        "evidence": "A:05 UChildERC20Proxy.sol:79-81,110-136"
      }
    ],
    "limitations": [
      "브리지 Child 토큰 초기 구현 후보이며 현재 구현이나 Tether 원본의 조건으로 확대하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "A:05",
        "state": "SOURCE_STORED",
        "sha256": "f72402a9a85a86a89c341c09452fa120cdeaeab39460558ebd075ab94d1762e7",
        "requestedAt": "2026-10-25T06:37:28.659Z"
      },
      {
        "id": "C2:05",
        "state": "CONSTRUCTOR_METADATA_STORED",
        "sha256": "8335310c6556ceb2c146b2e9877c42bab5000e5a1361374ab2c78663cb689a7f",
        "requestedAt": "2026-10-25T07:16:16.607Z"
      },
      {
        "id": "D:04",
        "state": "SOURCE_STORED",
        "sha256": "8aea105a00def235b697255615cde2d3873f566174c53504d65e6227531d0ec1",
        "requestedAt": "2026-10-25T07:19:18.204Z"
      }
    ],
    "functions": [
      "ERC20 bool 전송, allowance 차감(MAX 예외 없음), approve 덮어쓰기/0 및 증감.",
      "nonce·EIP712 서명 확인 및 self-call/context sender. ERC2612 permit으로 분류하지 않음.",
      "선택 초기 UChildERC20 구현에서 해당 전송 분기/진입점 없음."
    ],
    "authorities": [
      "deposit는 DEPOSITOR_ROLE로 mint, withdraw는 호출자 잔액 burn.",
      "onlyProxyOwner 및 비영·contract 구현 검사; updateImplementation/updateAndCall."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdc-avalanche",
    "coinId": "usdc",
    "symbol": "USDC",
    "network": "Avalanche",
    "networkKey": "43114",
    "chainId": "43114",
    "address": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    "identityLabel": "저장 주소 후보",
    "reviewScope": "PROXY_SOURCE_ONLY",
    "scopeLabel": "프록시 소스만 확보",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "관리·위임",
        "group": "업그레이드",
        "status": "SOURCE_PRESENT",
        "detail": "Transparent proxy의 admin 전용 upgrade/관리 및 비admin fallback. 선택 상속의 권한만 검토.",
        "evidence": "A:03"
      },
      {
        "id": "scope-1",
        "label": "전송·승인·발행·통제",
        "group": "토큰 기능",
        "status": "INPUT_REQUIRED",
        "detail": "초기 구현 주소의 Sourcify 응답404. 프록시 소스만으로 토큰 기능 유무를 판정하지 않음.",
        "evidence": "C2:03 · D:03"
      }
    ],
    "limitations": [
      "취득 실패/metadata 미기재는 기능 부재가 아님. USDT0/브리지 계열 여부와 원본 Ethereum USDT 조건을 혼합하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "A:03",
        "state": "SOURCE_STORED",
        "sha256": "8e2dcc4efe5473dfdbd2aa9bb3a65c2609ba113ed2f189c5ab7de302c08779a3",
        "requestedAt": "2026-10-25T06:37:28.003Z"
      },
      {
        "id": "C2:03",
        "state": "CONSTRUCTOR_METADATA_STORED",
        "sha256": "bc42564384aed014f2abd14b0a1fbe8039733da358bace1b042380b9d68be9aa",
        "requestedAt": "2026-10-25T07:16:16.039Z"
      },
      {
        "id": "D:03",
        "state": "SOURCE_UNAVAILABLE",
        "sha256": "bae5f2d4e21a37a69ff78d649b042650bf6a989b7ac18635ab7c631e8981d42b",
        "requestedAt": "2026-10-25T07:19:17.928Z"
      }
    ],
    "functions": [],
    "authorities": [
      "Transparent proxy의 admin 전용 upgrade/관리 및 비admin fallback. 선택 상속의 권한만 검토.",
      "초기 구현 주소의 Sourcify 응답404. 프록시 소스만으로 토큰 기능 유무를 판정하지 않음."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdt-arbitrum",
    "coinId": "usdt",
    "symbol": "USDT",
    "network": "Arbitrum",
    "networkKey": "42161",
    "chainId": "42161",
    "address": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "identityLabel": "저장 주소 후보",
    "reviewScope": "PROXY_SOURCE_ONLY",
    "scopeLabel": "프록시 소스만 확보",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "관리·위임",
        "group": "업그레이드",
        "status": "SOURCE_PRESENT",
        "detail": "Transparent proxy의 admin 전용 upgrade/관리 및 비admin fallback. 선택 상속의 권한만 검토.",
        "evidence": "A:04"
      },
      {
        "id": "scope-1",
        "label": "전송·승인·발행·통제",
        "group": "토큰 기능",
        "status": "INPUT_REQUIRED",
        "detail": "저장 constructor metadata에 초기 로직 인자가 없음. 프록시 소스만으로 토큰 기능 유무를 판정하지 않음.",
        "evidence": "C2:04"
      }
    ],
    "limitations": [
      "취득 실패/metadata 미기재는 기능 부재가 아님. USDT0/브리지 계열 여부와 원본 Ethereum USDT 조건을 혼합하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "A:04",
        "state": "SOURCE_STORED",
        "sha256": "b1415c2e333d45a98db716209e0abab5e3b97beee433b3418ed67e9d9ff850ea",
        "requestedAt": "2026-10-25T06:37:28.316Z"
      },
      {
        "id": "C2:04",
        "state": "CONSTRUCTOR_METADATA_NO_LINK",
        "sha256": "4255cad93324fa859bf2b43d3be1148f4f5567a216116c36b20870bb52022295",
        "requestedAt": "2026-10-25T07:16:16.320Z"
      }
    ],
    "functions": [],
    "authorities": [
      "Transparent proxy의 admin 전용 upgrade/관리 및 비admin fallback. 선택 상속의 권한만 검토.",
      "저장 constructor metadata에 초기 로직 인자가 없음. 프록시 소스만으로 토큰 기능 유무를 판정하지 않음."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdt-plasma",
    "coinId": "usdt",
    "symbol": "USDT",
    "network": "Plasma",
    "networkKey": "9745",
    "chainId": "9745",
    "address": "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    "identityLabel": "저장 주소 후보",
    "reviewScope": "PROXY_SOURCE_ONLY",
    "scopeLabel": "프록시 소스만 확보",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "관리·위임",
        "group": "업그레이드",
        "status": "SOURCE_PRESENT",
        "detail": "Transparent proxy의 admin 전용 upgrade/관리 및 비admin fallback. 선택 상속의 권한만 검토.",
        "evidence": "A:06"
      },
      {
        "id": "scope-1",
        "label": "전송·승인·발행·통제",
        "group": "토큰 기능",
        "status": "INPUT_REQUIRED",
        "detail": "초기 구현 주소의 Sourcify 응답404. 프록시 소스만으로 토큰 기능 유무를 판정하지 않음.",
        "evidence": "C2:06 · D:05"
      }
    ],
    "limitations": [
      "취득 실패/metadata 미기재는 기능 부재가 아님. USDT0/브리지 계열 여부와 원본 Ethereum USDT 조건을 혼합하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "A:06",
        "state": "SOURCE_STORED",
        "sha256": "6757d7ccce84f6601fd8011342b8c2fda4a360d263c92ed3aa91a23a661180f9",
        "requestedAt": "2026-10-25T06:37:28.951Z"
      },
      {
        "id": "C2:06",
        "state": "CONSTRUCTOR_METADATA_STORED",
        "sha256": "1e8c6fbd68446819bc39d2f099dcf250a1e595923e909edd6faad416b8220771",
        "requestedAt": "2026-10-25T07:16:16.879Z"
      },
      {
        "id": "D:05",
        "state": "SOURCE_UNAVAILABLE",
        "sha256": "e2a2d5cb10283a316f5f3d07768d729651dc725de2e32e2fc3b6b2b0d5e695a6",
        "requestedAt": "2026-10-25T07:19:18.585Z"
      }
    ],
    "functions": [],
    "authorities": [
      "Transparent proxy의 admin 전용 upgrade/관리 및 비admin fallback. 선택 상속의 권한만 검토.",
      "초기 구현 주소의 Sourcify 응답404. 프록시 소스만으로 토큰 기능 유무를 판정하지 않음."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdt-mantle",
    "coinId": "usdt",
    "symbol": "USDT",
    "network": "Mantle",
    "networkKey": "5000",
    "chainId": "5000",
    "address": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    "identityLabel": "저장 주소 후보",
    "reviewScope": "PROXY_SOURCE_ONLY",
    "scopeLabel": "프록시 소스만 확보",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "관리·위임",
        "group": "업그레이드",
        "status": "SOURCE_PRESENT",
        "detail": "Transparent proxy의 admin 전용 upgrade/관리 및 비admin fallback. 선택 상속의 권한만 검토.",
        "evidence": "A:07"
      },
      {
        "id": "scope-1",
        "label": "전송·승인·발행·통제",
        "group": "토큰 기능",
        "status": "INPUT_REQUIRED",
        "detail": "초기 구현 주소의 Sourcify 응답404. 프록시 소스만으로 토큰 기능 유무를 판정하지 않음.",
        "evidence": "C2:07 · D:06"
      }
    ],
    "limitations": [
      "취득 실패/metadata 미기재는 기능 부재가 아님. USDT0/브리지 계열 여부와 원본 Ethereum USDT 조건을 혼합하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "A:07",
        "state": "SOURCE_STORED",
        "sha256": "242299dfe861008092a0d43c29df6e92e678979248d65407bfd8e01f697e6147",
        "requestedAt": "2026-10-25T06:37:30.240Z"
      },
      {
        "id": "C2:07",
        "state": "CONSTRUCTOR_METADATA_STORED",
        "sha256": "325d457a45ee4bfe752188cb9cec6d5393f101c164a65b3de5a2d5f0e223162c",
        "requestedAt": "2026-10-25T07:16:17.156Z"
      },
      {
        "id": "D:06",
        "state": "SOURCE_UNAVAILABLE",
        "sha256": "f14af4465d66add0a89dee49618fb675c65812822e04dfdcd490b1a6c1e10b42",
        "requestedAt": "2026-10-25T07:19:18.871Z"
      }
    ],
    "functions": [],
    "authorities": [
      "Transparent proxy의 admin 전용 upgrade/관리 및 비admin fallback. 선택 상속의 권한만 검토.",
      "초기 구현 주소의 Sourcify 응답404. 프록시 소스만으로 토큰 기능 유무를 판정하지 않음."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdc-solana",
    "coinId": "usdc",
    "symbol": "USDC",
    "network": "Solana",
    "networkKey": "solana",
    "address": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "identityLabel": "저장 mint",
    "reviewScope": "PROTOCOL_SOURCE_AND_STORED_SETTINGS",
    "scopeLabel": "공통 프로토콜·과거 설정",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "전송·delegate 승인·철회",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "동일 mint·동결·잔액·owner/delegate 서명/수량 검사. approve/revoke는 Token Account delegate 설정.",
        "evidence": "B:00 processor.rs:228-423"
      },
      {
        "id": "scope-1",
        "label": "발행·소각·계정 동결",
        "group": "공급·관리",
        "status": "PROTOCOL_CAPABILITY",
        "detail": "MintTo의 mintAuthority, burn의 owner/delegate, freeze/thaw의 freezeAuthority 검사. 저장2026-10-21 mint 설정은 두 authority 모두 존재.",
        "evidence": "B:00 processor.rs:522-755 · docs/SOLANA_MINT_READONLY.md"
      },
      {
        "id": "scope-2",
        "label": "계정 정리·서명",
        "group": "체인 의미",
        "status": "SOURCE_PRESENT",
        "detail": "closeAccount는 잔액/owner 또는 close authority 조건. 트랜잭션 서명을 EIP2612로 해석하지 않음.",
        "evidence": "B:00 processor.rs:672-713"
      },
      {
        "id": "scope-3",
        "label": "legacy 수수료 확장·전체 pause",
        "group": "전송 특성",
        "status": "NOT_IN_REVIEWED_PATH",
        "detail": "선택 legacy Token Program 경로에 Token-2022 transfer-fee 확장이나 전역 pause 명령 없음.",
        "evidence": "B:00 processor.rs · B:01 state.rs"
      }
    ],
    "limitations": [
      "고정 SPL 소스 commit과 과거 Tokenkeg/82byte mint 관측을 연결해 설명. 현재 배포 program binary/version을 새로 인증하지 않음.",
      "holder 자동 수집/Token Account 생성/새 RPC 없음. ERC20 allowance나 관리자 임의 이전으로 바꾸어 설명하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "B:00",
        "state": "SOURCE_STORED",
        "sha256": "08e488b3b65150a58ef239d868742d35551ebc934b4b4bc74a08232b886df8bc",
        "requestedAt": "2026-10-25T06:48:35.370Z"
      },
      {
        "id": "B:01",
        "state": "SOURCE_STORED",
        "sha256": "e1d440c816f4a5c757b9077393e3c08c444a2fcfcf18872ca2ee6e7e713ed069",
        "requestedAt": "2026-10-25T06:48:35.699Z"
      },
      {
        "id": "B:21",
        "state": "DOCUMENT_STORED",
        "sha256": "478e169ab6b8dda0ead6abe9b5ef2ccba608b4a72e4196f5cdf42debe07b92a5",
        "requestedAt": "2026-10-25T06:48:41.459Z"
      }
    ],
    "functions": [
      "동일 mint·동결·잔액·owner/delegate 서명/수량 검사. approve/revoke는 Token Account delegate 설정.",
      "선택 legacy Token Program 경로에 Token-2022 transfer-fee 확장이나 전역 pause 명령 없음."
    ],
    "authorities": [
      "MintTo의 mintAuthority, burn의 owner/delegate, freeze/thaw의 freezeAuthority 검사. 저장2026-10-21 mint 설정은 두 authority 모두 존재.",
      "closeAccount는 잔액/owner 또는 close authority 조건. 트랜잭션 서명을 EIP2612로 해석하지 않음."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdt-solana",
    "coinId": "usdt",
    "symbol": "USDT",
    "network": "Solana",
    "networkKey": "solana",
    "address": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    "identityLabel": "저장 mint",
    "reviewScope": "PROTOCOL_SOURCE_AND_STORED_SETTINGS",
    "scopeLabel": "공통 프로토콜·과거 설정",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "전송·delegate 승인·철회",
        "group": "전송·승인",
        "status": "SOURCE_PRESENT",
        "detail": "동일 mint·동결·잔액·owner/delegate 서명/수량 검사. approve/revoke는 Token Account delegate 설정.",
        "evidence": "B:00 processor.rs:228-423"
      },
      {
        "id": "scope-1",
        "label": "발행·소각·계정 동결",
        "group": "공급·관리",
        "status": "PROTOCOL_CAPABILITY",
        "detail": "MintTo의 mintAuthority, burn의 owner/delegate, freeze/thaw의 freezeAuthority 검사. 저장2026-10-21 mint 설정은 두 authority 모두 존재.",
        "evidence": "B:00 processor.rs:522-755 · docs/SOLANA_MINT_READONLY.md"
      },
      {
        "id": "scope-2",
        "label": "계정 정리·서명",
        "group": "체인 의미",
        "status": "SOURCE_PRESENT",
        "detail": "closeAccount는 잔액/owner 또는 close authority 조건. 트랜잭션 서명을 EIP2612로 해석하지 않음.",
        "evidence": "B:00 processor.rs:672-713"
      },
      {
        "id": "scope-3",
        "label": "legacy 수수료 확장·전체 pause",
        "group": "전송 특성",
        "status": "NOT_IN_REVIEWED_PATH",
        "detail": "선택 legacy Token Program 경로에 Token-2022 transfer-fee 확장이나 전역 pause 명령 없음.",
        "evidence": "B:00 processor.rs · B:01 state.rs"
      }
    ],
    "limitations": [
      "고정 SPL 소스 commit과 과거 Tokenkeg/82byte mint 관측을 연결해 설명. 현재 배포 program binary/version을 새로 인증하지 않음.",
      "holder 자동 수집/Token Account 생성/새 RPC 없음. ERC20 allowance나 관리자 임의 이전으로 바꾸어 설명하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "B:00",
        "state": "SOURCE_STORED",
        "sha256": "08e488b3b65150a58ef239d868742d35551ebc934b4b4bc74a08232b886df8bc",
        "requestedAt": "2026-10-25T06:48:35.370Z"
      },
      {
        "id": "B:01",
        "state": "SOURCE_STORED",
        "sha256": "e1d440c816f4a5c757b9077393e3c08c444a2fcfcf18872ca2ee6e7e713ed069",
        "requestedAt": "2026-10-25T06:48:35.699Z"
      },
      {
        "id": "B:22",
        "state": "FAILED",
        "sha256": "7ee777d34466f95a13a5bcf55d980c374f0d2d3d29315e7d4ba9ef1249b72fe8",
        "requestedAt": "2026-10-25T06:48:41.658Z"
      }
    ],
    "functions": [
      "동일 mint·동결·잔액·owner/delegate 서명/수량 검사. approve/revoke는 Token Account delegate 설정.",
      "선택 legacy Token Program 경로에 Token-2022 transfer-fee 확장이나 전역 pause 명령 없음."
    ],
    "authorities": [
      "MintTo의 mintAuthority, burn의 owner/delegate, freeze/thaw의 freezeAuthority 검사. 저장2026-10-21 mint 설정은 두 authority 모두 존재.",
      "closeAccount는 잔액/owner 또는 close authority 조건. 트랜잭션 서명을 EIP2612로 해석하지 않음."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdt-ton",
    "coinId": "usdt",
    "symbol": "USDT",
    "network": "TON",
    "networkKey": "ton",
    "address": "개별 자산 식별자는 이 발췌에 포함하지 않음",
    "identityLabel": "식별 근거",
    "reviewScope": "TOKEN_REFERENCE_SOURCE",
    "scopeLabel": "토큰 참조 소스",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "owner·master 전송",
        "group": "전송",
        "status": "SOURCE_PRESENT",
        "detail": "일반 owner는 outgoing status 잠금 조건. master의 강제 transfer는 잠금 예외.",
        "evidence": "B:03 jetton-wallet.fc:40-53"
      },
      {
        "id": "scope-1",
        "label": "발행·소각·잠금",
        "group": "공급·관리",
        "status": "SOURCE_PRESENT",
        "detail": "minter mint/admin; wallet burn은 master 전용. minter admin의 call_to가 transfer/burn/set_status를 전달.",
        "evidence": "B:02 jetton-minter.fc:82-108,180-218 · B:03 jetton-wallet.fc:148-159,226-232"
      },
      {
        "id": "scope-2",
        "label": "관리 이전·코드 변경",
        "group": "업그레이드",
        "status": "SOURCE_PRESENT",
        "detail": "현재 admin 제안·next_admin의 claim, admin upgrade 경로.",
        "evidence": "B:02 jetton-minter.fc:164-178,227-235"
      },
      {
        "id": "scope-3",
        "label": "ERC20 승인",
        "group": "체인 의미",
        "status": "NOT_APPLICABLE",
        "detail": "Jetton 메시지/개별 wallet 모델. ERC20 allowance·bool 반환을 강제하지 않음.",
        "evidence": "B:03 jetton-wallet.fc"
      }
    ],
    "limitations": [
      "공식 TON stablecoin reference snapshot이며 USDT 배포 코드/라이브러리 cell 대응을 인증하지 않음. TON 소스 후보의 조건과 실제 USDT 기능을 구분.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "B:02",
        "state": "SOURCE_STORED",
        "sha256": "ab644e5deee0cc5620ad916116a9e24d6719e21daca1425b559578018575bcb2",
        "requestedAt": "2026-10-25T06:48:35.926Z"
      },
      {
        "id": "B:03",
        "state": "SOURCE_STORED",
        "sha256": "dd8e9d59dd4479adabbb77e9dfdb552b50e9d7ab337bbbb26a9089e147379771",
        "requestedAt": "2026-10-25T06:48:36.191Z"
      },
      {
        "id": "B:04",
        "state": "SOURCE_STORED",
        "sha256": "1303e3b14603733689af085881ecb0e2f9b9c8fcfae1e5ba466a13cccc976171",
        "requestedAt": "2026-10-25T06:48:36.416Z"
      },
      {
        "id": "B:22",
        "state": "FAILED",
        "sha256": "7ee777d34466f95a13a5bcf55d980c374f0d2d3d29315e7d4ba9ef1249b72fe8",
        "requestedAt": "2026-10-25T06:48:41.658Z"
      }
    ],
    "functions": [],
    "authorities": [
      "일반 owner는 outgoing status 잠금 조건. master의 강제 transfer는 잠금 예외.",
      "minter mint/admin; wallet burn은 master 전용. minter admin의 call_to가 transfer/burn/set_status를 전달.",
      "현재 admin 제안·next_admin의 claim, admin upgrade 경로.",
      "Jetton 메시지/개별 wallet 모델. ERC20 allowance·bool 반환을 강제하지 않음."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdt-aptos",
    "coinId": "usdt",
    "symbol": "USDT",
    "network": "Aptos",
    "networkKey": "aptos",
    "address": "module: 0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb · faObject: 0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
    "identityLabel": "저장 식별자",
    "reviewScope": "FRAMEWORK_SOURCE_ONLY",
    "scopeLabel": "공통 프레임워크 소스",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "FA 발행·소각·동결 capability",
        "group": "공급·관리",
        "status": "PROTOCOL_CAPABILITY",
        "detail": "MintRef/BurnRef/TransferRef 및 metadata 일치 조건. TransferRef 이전은 frozen 우회가 의도된 capability 경로.",
        "evidence": "B:05 fungible_asset.move:1041-1154"
      },
      {
        "id": "scope-1",
        "label": "일반·dispatchable 전송",
        "group": "전송",
        "status": "PROTOCOL_CAPABILITY",
        "detail": "일반 frozen 검사와 primary store → dispatchable hook 경로. custom hook이 동작 조건을 바꿀 수 있음.",
        "evidence": "B:05 fungible_asset.move:1014-1026,1464 · B:06 primary_fungible_store.move · B:07 dispatchable_fungible_asset.move"
      },
      {
        "id": "scope-2",
        "label": "USDT 전용 hook·수수료·역할",
        "group": "자산 구현",
        "status": "INPUT_REQUIRED",
        "detail": "공식 식별자와 framework는 확보했으나 Tether module/dispatch hook 소스는 미확보. 일반 framework만으로 조건을 확정하지 않음.",
        "evidence": "B:22"
      }
    ],
    "limitations": [
      "FA object와 module 주소는 공식 정적 본문에서 확인. 현재 capability 보유·hook 설정·프레임워크 배포 버전은 관측하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "B:05",
        "state": "SOURCE_STORED",
        "sha256": "071fec2094a3ce243ab26e96e6ded45883fc904e2a5837250715ad50aee4d057",
        "requestedAt": "2026-10-25T06:48:36.653Z"
      },
      {
        "id": "B:06",
        "state": "SOURCE_STORED",
        "sha256": "b528b284706a6efb26f1b37c64104fd5b235e86ef5e205fb90052e3d390d0c75",
        "requestedAt": "2026-10-25T06:48:36.887Z"
      },
      {
        "id": "B:07",
        "state": "SOURCE_STORED",
        "sha256": "e03f330bb82e97a1e3aba9985128d763f95fe49bf90db90ee2a6235428d05d90",
        "requestedAt": "2026-10-25T06:48:37.098Z"
      },
      {
        "id": "B:22",
        "state": "FAILED",
        "sha256": "7ee777d34466f95a13a5bcf55d980c374f0d2d3d29315e7d4ba9ef1249b72fe8",
        "requestedAt": "2026-10-25T06:48:41.658Z"
      }
    ],
    "functions": [],
    "authorities": [
      "MintRef/BurnRef/TransferRef 및 metadata 일치 조건. TransferRef 이전은 frozen 우회가 의도된 capability 경로.",
      "일반 frozen 검사와 primary store → dispatchable hook 경로. custom hook이 동작 조건을 바꿀 수 있음.",
      "공식 식별자와 framework는 확보했으나 Tether module/dispatch hook 소스는 미확보. 일반 framework만으로 조건을 확정하지 않음."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdc-stellar",
    "coinId": "usdc",
    "symbol": "USDC",
    "network": "Stellar",
    "networkKey": "stellar",
    "address": "개별 자산 식별자는 이 발췌에 포함하지 않음",
    "identityLabel": "식별 근거",
    "reviewScope": "PROTOCOL_SOURCE_ONLY",
    "scopeLabel": "공통 프로토콜 소스",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "classic asset Payment",
        "group": "전송",
        "status": "PROTOCOL_CAPABILITY",
        "detail": "issuer+asset 및 trust-line 잔액/인가를 사용하는 프로토콜 모델. ERC20 transferFrom이 아님.",
        "evidence": "B:12 PaymentOpFrame.cpp"
      },
      {
        "id": "scope-1",
        "label": "인가·철회·clawback",
        "group": "공급·관리",
        "status": "PROTOCOL_CAPABILITY",
        "detail": "AUTH_REQUIRED/REVOCABLE/IMMUTABLE/CLAWBACK flags. clawback은 issuer 발신·양수·비native asset·clawback-enabled trustline 조건.",
        "evidence": "B:13 SetOptionsOpFrame.cpp:149-175 · B:14 ClawbackOpFrame.cpp:23-52,64-99"
      },
      {
        "id": "scope-2",
        "label": "USDC issuer 플래그",
        "group": "자산 설정",
        "status": "INPUT_REQUIRED",
        "detail": "프로토콜 capability가 USDC issuer에서 활성화됐는지 새 읽기를 하지 않음.",
        "evidence": "B:21"
      }
    ],
    "limitations": [
      "Stellar Core master snapshot의 일부 경로이며 Circle issuer 플래그/실제 배포 protocol 버전을 인증하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "B:12",
        "state": "SOURCE_STORED",
        "sha256": "0553d1e3e1dbe0924d50e5a95f7772529fef720e4fe4beee5a1541377a7cb150",
        "requestedAt": "2026-10-25T06:48:38.171Z"
      },
      {
        "id": "B:13",
        "state": "SOURCE_STORED",
        "sha256": "985a681225ffeafd43d9310ac947d3c73c987a28f773ac9b316f884af2a6c7c3",
        "requestedAt": "2026-10-25T06:48:38.415Z"
      },
      {
        "id": "B:14",
        "state": "SOURCE_STORED",
        "sha256": "05fdf01677ed11d5820a6ce8098368c42cfe5320bebc31e542d4262f7bac291b",
        "requestedAt": "2026-10-25T06:48:38.689Z"
      },
      {
        "id": "B:21",
        "state": "DOCUMENT_STORED",
        "sha256": "478e169ab6b8dda0ead6abe9b5ef2ccba608b4a72e4196f5cdf42debe07b92a5",
        "requestedAt": "2026-10-25T06:48:41.459Z"
      }
    ],
    "functions": [],
    "authorities": [
      "issuer+asset 및 trust-line 잔액/인가를 사용하는 프로토콜 모델. ERC20 transferFrom이 아님.",
      "AUTH_REQUIRED/REVOCABLE/IMMUTABLE/CLAWBACK flags. clawback은 issuer 발신·양수·비native asset·clawback-enabled trustline 조건.",
      "프로토콜 capability가 USDC issuer에서 활성화됐는지 새 읽기를 하지 않음."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "rlusd-xrpl",
    "coinId": "rlusd",
    "symbol": "RLUSD",
    "network": "XRPL",
    "networkKey": "xrpl",
    "address": "issuer: rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De · currency: 524C555344000000000000000000000000000000",
    "identityLabel": "저장 식별자",
    "reviewScope": "PROTOCOL_SOURCE_AND_STORED_SETTINGS",
    "scopeLabel": "공통 프로토콜·과거 설정",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "Payment·TrustSet",
        "group": "전송",
        "status": "PROTOCOL_CAPABILITY",
        "detail": "classic IOU의 currency+issuer·trustline Payment. RequireAuth/freeze/deep-freeze 경로는 설정/규칙 조건부.",
        "evidence": "R:03 Payment.cpp · R:01 TrustSet.cpp:164-166,239-267,342-348"
      },
      {
        "id": "scope-1",
        "label": "전역 동결·회수",
        "group": "공급·관리",
        "status": "PROTOCOL_CAPABILITY",
        "detail": "Clawback은 AllowTrustLineClawback 및 !NoFreeze, 올바른 trustline/잔액 방향·양수 보유 검사. AccountSet의 설정 제약은 별도.",
        "evidence": "R:02 Clawback.cpp:94-144 · R:00 AccountSet.cpp"
      },
      {
        "id": "scope-2",
        "label": "발행사 설정 관측",
        "group": "저장 설정",
        "status": "STORED_SETTING",
        "detail": "2026-10-21 저장값: RequireAuth=false, NoFreeze=false, GlobalFreeze=false, AllowTrustLineClawback=true. TransferRate는 필드 미기재.",
        "evidence": "docs/XRPL_ISSUER_READONLY.md"
      }
    ],
    "limitations": [
      "저장 ledger107795106 설정과 develop 소스 snapshot은 시각/버전이 다름. 현재 amendment/설정·키 통제·holder trustline·실제 회수 성공으로 승격하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "R:00",
        "state": "SOURCE_STORED",
        "sha256": "16b43ee17e593dc005096f6cfdcecdfbae3a537bf349ffe467d3968fdc0425d9",
        "requestedAt": "2026-10-25T07:13:54.912Z"
      },
      {
        "id": "R:01",
        "state": "SOURCE_STORED",
        "sha256": "189918c14e4b7290d9da75306728afc566c3f89b60bbd7704c634c5e89d5efb6",
        "requestedAt": "2026-10-25T07:13:55.229Z"
      },
      {
        "id": "R:02",
        "state": "SOURCE_STORED",
        "sha256": "cf384df74e565318cee8cf14428784a30a2f6a194d3bc4ca7131fc44087b826e",
        "requestedAt": "2026-10-25T07:13:55.495Z"
      },
      {
        "id": "R:03",
        "state": "SOURCE_STORED",
        "sha256": "55e49f8467f26ae61770cf497820679f00d9abb44a654dd5ab1e74280ea4aa3b",
        "requestedAt": "2026-10-25T07:13:55.749Z"
      }
    ],
    "functions": [],
    "authorities": [
      "classic IOU의 currency+issuer·trustline Payment. RequireAuth/freeze/deep-freeze 경로는 설정/규칙 조건부.",
      "Clawback은 AllowTrustLineClawback 및 !NoFreeze, 올바른 trustline/잔액 방향·양수 보유 검사. AccountSet의 설정 제약은 별도.",
      "2026-10-21 저장값: RequireAuth=false, NoFreeze=false, GlobalFreeze=false, AllowTrustLineClawback=true. TransferRate는 필드 미기재."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdc-hyperliquid-l1",
    "coinId": "usdc",
    "symbol": "USDC",
    "network": "Hyperliquid L1",
    "networkKey": "hyperliquid-l1",
    "address": "개별 자산 식별자는 이 발췌에 포함하지 않음",
    "identityLabel": "식별 근거",
    "reviewScope": "BRIDGE_COMPONENT_SOURCE",
    "scopeLabel": "브리지 구성요소 소스",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "출금",
        "group": "브리지",
        "status": "SOURCE_PRESENT",
        "detail": "선택 Bridge2의 출금 요청/validator 검증 및 dispute-period, finalized 중복 방지. finalizer·whenNotPaused·nonReentrant.",
        "evidence": "B:15 Bridge2.sol:338-385"
      },
      {
        "id": "scope-1",
        "label": "입금·긴급 정지",
        "group": "브리지",
        "status": "SOURCE_PRESENT",
        "detail": "permit→transferFrom 실패 분리. lockers 투표 threshold로 pause, cold validator 검증 경로로 emergencyUnlock.",
        "evidence": "B:15 Bridge2.sol:746-842 · B:16 Signature.sol"
      },
      {
        "id": "scope-2",
        "label": "HyperCore 내부 자산 기능",
        "group": "원장",
        "status": "INPUT_REQUIRED",
        "detail": "브리지 코드가 HyperCore 원장 기능을 모두 설명하지 않음. HyperEVM ERC20으로 대체하지 않음.",
        "evidence": "B:15"
      }
    ],
    "limitations": [
      "선택 브리지 component snapshot이며 현재 공식 브리지 주소/validator 집합을 인증하지 않음. 의존 라이브러리 전체를 취득/컴파일하지 않음.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "B:15",
        "state": "SOURCE_STORED",
        "sha256": "907c92a44b26c64115514e81ad448a300f10921e7156f4df076756c86020f483",
        "requestedAt": "2026-10-25T06:48:38.976Z"
      },
      {
        "id": "B:16",
        "state": "SOURCE_STORED",
        "sha256": "0b019d6d864bfac67f3f809e170a67653c8ebd1e865fbf3e61d50f2fed237681",
        "requestedAt": "2026-10-25T06:48:39.190Z"
      }
    ],
    "functions": [],
    "authorities": [
      "선택 Bridge2의 출금 요청/validator 검증 및 dispute-period, finalized 중복 방지. finalizer·whenNotPaused·nonReentrant.",
      "permit→transferFrom 실패 분리. lockers 투표 threshold로 pause, cold validator 검증 경로로 emergencyUnlock.",
      "브리지 코드가 HyperCore 원장 기능을 모두 설명하지 않음. HyperEVM ERC20으로 대체하지 않음."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  },
  {
    "id": "usdc-arc",
    "coinId": "usdc",
    "symbol": "USDC",
    "network": "Arc",
    "networkKey": "arc",
    "address": "erc20View: 0x3600000000000000000000000000000000000000",
    "identityLabel": "저장 식별자",
    "reviewScope": "DOCUMENTATION_ONLY",
    "scopeLabel": "공식 문서만 확보",
    "sourceReviewStatus": "RESEARCH_SCOPE_REVIEWED",
    "reviewedAt": "2026-10-25",
    "deploymentBinding": "UNKNOWN",
    "selectionDay": "2026-10-22",
    "features": [
      {
        "id": "scope-0",
        "label": "native 수수료·ERC20 view",
        "group": "체인 의미",
        "status": "DOCUMENTED_ONLY",
        "detail": "공식 wallet guide: native18 / ERC20 view6의 단일 USDC 잔액과 USDC 가스. 이중 공급으로 합산하지 않음.",
        "evidence": "B:20"
      },
      {
        "id": "scope-1",
        "label": "전송·통제 소스",
        "group": "자산 구현",
        "status": "INPUT_REQUIRED",
        "detail": "정적 공식 문서 확보. native/predeploy 구현 소스는 미확보하여 일반 proxy/ERC20 조건으로 판정하지 않음.",
        "evidence": "B:20"
      }
    ],
    "limitations": [
      "문서 HTTP200 본문만 확인했고 렌더링 후 화면/현행 네트워크를 확인한 것은 아님.",
      "선정 기준: 2026-10-22 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.",
      "현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음."
    ],
    "evidenceRecords": [
      {
        "id": "B:20",
        "state": "DOCUMENT_STORED",
        "sha256": "03cc28de0237e47e2010e54073c4954d8c8805d107cdc7ee9755efb60025dd67",
        "requestedAt": "2026-10-25T06:48:41.377Z"
      },
      {
        "id": "B:21",
        "state": "DOCUMENT_STORED",
        "sha256": "478e169ab6b8dda0ead6abe9b5ef2ccba608b4a72e4196f5cdf42debe07b92a5",
        "requestedAt": "2026-10-25T06:48:41.459Z"
      }
    ],
    "functions": [],
    "authorities": [
      "공식 wallet guide: native18 / ERC20 view6의 단일 USDC 잔액과 USDC 가스. 이중 공급으로 합산하지 않음.",
      "정적 공식 문서 확보. native/predeploy 구현 소스는 미확보하여 일반 proxy/ERC20 조건으로 판정하지 않음."
    ],
    "observation": "저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.",
    "bindingDetail": "현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.",
    "references": [
      "2026-10-25-top10-source-review-results",
      "source-review-top10-results.json"
    ]
  }
];
