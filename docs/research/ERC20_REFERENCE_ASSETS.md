# Ethereum USDC / USD₮ 공식 식별 정보 조사

최초 조회 시각: 2026-10-19T00:08:51Z. 공식 문서 재확인 시각: 2026-10-19T00:17:44Z. 네트워크: Ethereum mainnet, chain ID 1.

| 자산 표기 | 공식 문서에 연결된 Ethereum 계약 | 근거 |
|---|---|---|
| USDC | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` | [Circle 계약 주소 목록](https://developers.circle.com/stablecoins/usdc-contract-addresses) |
| USD₮ / USDT | `0xdac17f958d2ee523a2206206994597c13d831ec7` | [Tether Supported Protocols](https://tether.to/en/supported-protocols/)의 Ethereum 항목 |

Tether는 해당 integration 문서에서 Ethereum USD₮ transfer가 Boolean을 반환하지 않는다고 설명한다. 이는 **DOCUMENTED** 특성이며 이번 세션에서 실제 transfer를 관측한 결과가 아니다. 로컬 NoReturnToken의 실행 성공을 실제 USD₮ 검증으로 대체하지 않는다.

이 목록은 공식 문서의 주소 연결을 기록한 자료다. 발행사의 법적 실체·상환·준비자산·규제 위험 검토나 자산 취급 승인이 아니다. Symbol 일치로 공식 자산을 판단하지 않는다. 엔진의 issuerVerificationStatus를 이 파일로 자동 VERIFIED로 바꾸지 않는다.

재확인 결과: Circle Mainnet 표의 Ethereum 주소와 Tether Ethereum Network 항목의 USD₮ 계약 링크가 위 주소와 일치한다. Tether의 transfer Boolean 미반환 설명도 확인했다. 이는 공식 문서 확인이며 온체인 실행 증거가 아니다.

## 온체인 조회 상태

2026-10-19T00:36:49Z–00:36:50Z에 Ethereum mainnet(chain ID 1) 블록 `26223078`을 고정해 두 자산을 읽기 전용으로 다시 조회했다. 계약 코드와 name/symbol/decimals/totalSupply 응답을 관측했다.

| 자산 | 관측 name / symbol | decimals | 메타데이터 ERC20-001 | Proxy EVM-PROXY-001 v1.1.0 | 원시 증거 |
|---|---|---:|---|---|---|
| USDC | USD Coin / USDC | 6 | PASS | PASS (선언 대상 + 코드) | [보고서](../../reports/usdc-readonly.json) |
| USD₮ | Tether USD / USDT | 6 | PASS | INCONCLUSIVE | [보고서](../../reports/usdt-readonly.json) |

USDC는 PASS 2 / NOT_TESTED 8, USDT는 PASS 1 / INCONCLUSIVE 1 / NOT_TESTED 8이다. 전체 자산 승인 판정은 제공하지 않는다. EIP-1967 implementation/beacon/admin 슬롯은 두 자산 모두 ZERO다. USDC의 ZeppelinOS implementation 슬롯은 `0x43506849D7C04F9138D1A2050bbF3A0c054402dd`를 가리키며 같은 블록에서 대상 코드가 존재했다. ZeppelinOS admin 슬롯 값은 `0x807a96288A1A408dBC13DE2b1d087d10356395d2`다. 이 값은 관리자 실체나 실제 권한을 입증하지 않는다. USDT의 ZeppelinOS 슬롯도 ZERO이며 구현 주소는 UNKNOWN이다. 이는 Proxy·업그레이드 기능의 부재를 뜻하지 않는다.

실제 위임·업그레이드 권한은 두 자산 모두 UNKNOWN이다. 전송·승인·동결 등 상태 변경은 실행하지 않았다. --holder를 지정하지 않았으므로 잔액도 NOT_TESTED다. USDC 16개 / USDT 15개 증거에 대해 참조 무결성, 같은 블록 조회, 읽기 전용 RPC 메서드 목록, RPC URL 미포함을 확인했다. 보고서는 로컬 생성물로 Git 제외 대상이다. 이전 v1.0.0의 USDC 미확정 결과와 달라진 이유는 [ZeppelinOS 슬롯 지원 추가](../adr/0003-legacy-proxy-slots.md)이며 업그레이드를 관측했다는 뜻이 아니다.

환경변수 RPC_URL을 구성한 뒤 다음 읽기 전용 명령을 사용할 수 있다. `.env.local`을 사용하는 경우 `npm run assess --` 대신 `node --env-file=.env.local --use-env-proxy --import tsx src/cli.ts assess`로 실행한다. RPC URL이나 키를 문서/명령 인자/보고서에 기록하지 않는다.

```sh
npm run assess -- --network 1 --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 --out reports/usdc-readonly.json
npm run assess -- --network 1 --token 0xdac17f958d2ee523a2206206994597c13d831ec7 --out reports/usdt-readonly.json
```

조회할 때 공식 주소 출처를 다시 확인하고 반환 보고서의 블록·시점·원시 증거를 검토한다. 전송·승인·동결·업그레이드는 이 명령에서 실행하지 않는다. 공식 자료의 기계 판독용 요약은 [erc20-reference-assets.json](erc20-reference-assets.json)에 있다.

`--holder`를 생략한 위 명령은 특정 계정의 balanceOf를 실행하지 않는다. 잔액 조회가 필요하면 공개 계정 주소를 `--holder <address>`로 추가한다. 읽기 전용 검증은 로컬 전달 서버를 통한 통합 테스트에서 RPC 메서드 허용 목록과 상태 변경 시나리오의 NOT_TESTED 상태를 검증한다. 실제 네트워크에서 이번에 관측한 결과의 범위는 위 표와 연결된 보고서를 기준으로 한다.
