import { randomUUID } from 'node:crypto';
import type { ReadOnlyAdapter, ReadOnlyAssessmentRequest } from '../domain/adapter.js';
import { known, na, unknown, type AssetIdentity, type AssessmentReport, type Capability, type Evidence, type ScenarioResult } from '../domain/model.js';
import { summarize } from '../domain/evaluator.js';
import { observeXrplIssuer, XRPL_STABLECOIN_ISSUERS } from '../research/xrpl-issuer-readonly.js';
const limits = [
  'Issuer settings and optional holder trust-line settings; currency reference is documented/requested, not proof of its issuance or supply.',
  'Server network_id and validated ledger are provider reports, not independent network/consensus authentication.',
  'No Payment, amount arithmetic, signing, transaction or actual authority exercise. Flags do not authenticate key control or amendment activation.',
];
export const xrplDeferred: readonly [string, Capability][] = [
  ['XRPL-003','TRANSFER'],['XRPL-004','BALANCE'],['XRPL-005','DELEGATION'],['XRPL-006','MINT'],
  ['XRPL-007','BURN'],['XRPL-008','FREEZE'],['XRPL-009','UNFREEZE'],['XRPL-010','CLAWBACK'],
  ['XRPL-011','AUTHORITY_CHANGE'],['XRPL-012','TRANSFER_FEE'],['XRPL-013','DECIMAL_HANDLING'],
  ['XRPL-014','SUPPLY_TRACKING'],['XRPL-015','FINALITY'],['XRPL-016','RESOURCE_CONSUMPTION'],
];
export class XrplReadOnlyAdapter implements ReadOnlyAdapter {
  readonly chainFamily = 'XRPL' as const;
  constructor(private readonly rpcUrl: string) {}
  async assessReadOnly(request: ReadOnlyAssessmentRequest): Promise<AssessmentReport> {
    if (request.networkId !== '0') throw new Error('Invalid XRPL network reference.');
    const profile = XRPL_STABLECOIN_ISSUERS.find(p=>p.issuer===request.assetAddress&&p.currency===request.currencyCode);
    if (!profile) throw new Error('Unsupported XRPL currency and issuer pair.');
    const assessmentId=randomUUID(),startedAt=new Date().toISOString();
    const observation=await observeXrplIssuer(this.rpcUrl,profile.issuer,profile.currency,request.accountAddress),account=observation.observations[0]!;
    const valid=account.status==='OBSERVED'&&account.accountRoot!==undefined,slot=observation.ledgerIndex;
    const identity:AssetIdentity={chainFamily:'XRPL',networkId:'0',issuedCurrency:known(profile.currency),
      assetStandard:unknown('Issuer AccountRoot does not establish issued-currency behavior conformance'),
      contractAddress:na('XRPL issuer/currency, not an EVM contract'),mintAddress:na('XRPL trust-line currency, not a Solana mint'),
      tokenProgramId:na('XRPL protocol account, not a Solana program'),decimals:na('XRPL issued values do not use ERC-20 fixed decimals'),
      implementationAddress:na('EVM implementation address does not apply'),
      issuer:valid?known(account.accountRoot!.Account):unknown('Matched issuer AccountRoot not observed'),
      issuerVerificationStatus:'UNKNOWN',nativeOrBridged:unknown('Issuer settings do not authenticate origin'),
      name:unknown('No authenticated name'),symbol:unknown('Currency bytes are not authenticated symbol metadata'),
      observedAt:new Date().toISOString(),observedBlockOrSlot:slot};
    const evidence:Evidence[]=[];
    const record=(kind:string,data:unknown,provenance:Evidence['provenance']='OBSERVED',atSlot=slot)=>{
      const id=`e${evidence.length+1}`;evidence.push({id,kind,data,provenance,observedAt:identity.observedAt,observedBlockOrSlot:atSlot});return id;
    };
    const pairRef=record('XRPL_SELECTED_CURRENCY_REFERENCE',{issuer:profile.issuer,currency:profile.currency,
      basis:'Allowlisted documented issuer/currency reference; not an AccountRoot currency field or issuance observation'},'DOCUMENTED','UNKNOWN');
    const networkRef=record('XRPL_READ_CONTEXT',{expectedNetworkId:'0',networkBinding:observation.networkBinding,
      ledgerHash:observation.ledgerHash,ledgerIndex:slot,ledgerValidation:observation.ledgerValidation,requests:observation.requests,
      ...(observation.failure?{failure:observation.failure}:{})});
    const requested=observation.requests.some(r=>r.method==='account_info'),refs=[pairRef,networkRef];
    if(requested)refs.push(record('XRPL_ISSUER_READ_RESULT',{requestedIssuer:profile.issuer,requestedCurrency:profile.currency,
      ledgerHash:observation.ledgerHash,ledgerIndex:slot,account}));
    const trustLine=observation.trustLine,linesRequested=observation.requests.some(r=>r.method==='account_lines');
    const lineRefs=trustLine&&linesRequested?[...refs,record('XRPL_TRUST_LINE_READ_RESULT',{ledgerHash:observation.ledgerHash,ledgerIndex:slot,trustLine})]:[];
    const results:ScenarioResult[]=[];
    const add=(id:string,capability:Capability,observations:Record<string,unknown>,executionStatus:ScenarioResult['executionStatus'],
      verdict:ScenarioResult['verdict'],evidenceReferences:string[])=>{
      results.push({assessmentId,assetIdentity:identity,scenarioId:id,scenarioVersion:'1.0.0',capability,support:'UNKNOWN',
        executionStatus,verdict,observations,evidenceReferences,observedBlockOrSlot:slot,startedAt,completedAt:new Date().toISOString(),limitations:[...limits]});
    };
    const failed=observation.failure!==undefined||account.failure!==undefined||account.reason==='ACCOUNT_OR_LEDGER_RESPONSE_MISMATCH';
    add('XRPL-001','IDENTITY',{requestedIssuer:profile.issuer,requestedCurrency:profile.currency,
      currencyProvenance:'DOCUMENTED_REFERENCE_NOT_ACCOUNTROOT_FIELD',networkBinding:observation.networkBinding,issuerReadStatus:account.status},
      failed?'ERROR':'COMPLETED','INCONCLUSIVE',refs);
    add('XRPL-002','IDENTITY',valid?{accountRoot:account.accountRoot!,ledgerHash:observation.ledgerHash,
      ledgerIndex:slot,amendmentActivation:'UNKNOWN'}:{readReason:account.reason??'NOT_OBSERVED'},
      !requested?'NOT_EXECUTED':failed?'ERROR':'COMPLETED',!requested?'NOT_TESTED':'INCONCLUSIVE',requested?refs:[]);
    for(const[id,capability]of xrplDeferred){
      if(capability==='BALANCE'&&trustLine) add(id,capability,{trustLine},!linesRequested?'NOT_EXECUTED':trustLine.status==='OBSERVED'?'COMPLETED':'ERROR',linesRequested?'INCONCLUSIVE':'NOT_TESTED',lineRefs);
      else add(id,capability,{},'NOT_EXECUTED','NOT_TESTED',[]);
    }
    if(trustLine)add('XRPL-018','IDENTITY',{trustLine,meaning:'Holder perspective authorization/freeze settings; not delegation or transfer availability.'},
      !linesRequested?'NOT_EXECUTED':trustLine.status==='OBSERVED'?'COMPLETED':'ERROR',linesRequested?'INCONCLUSIVE':'NOT_TESTED',lineRefs);
    add('XRPL-017','ALLOWANCE',{meaning:'ERC-20 spender allowance is not XRPL trust-line authorization; trust-line settings are an optional separate read, not spending delegation.'},'COMPLETED','NOT_APPLICABLE',[]);
    return{schemaVersion:'1.0',assessmentId,mode:'READ_ONLY',profile:'baseline',assetIdentity:identity,results,evidence,
      capabilitySummary:summarize({results}),startedAt,completedAt:new Date().toISOString(),limitations:[...limits]};
  }
}
