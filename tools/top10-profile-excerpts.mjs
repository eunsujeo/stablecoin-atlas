import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const read=async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'));
export const scopeLabels={
  INITIAL_TOKEN_LOGIC_CANDIDATE:'초기 구현 후보 소스',
  DIRECT_TOKEN_SOURCE:'토큰 로직 소스',PROXY_SOURCE_ONLY:'프록시 소스만 확보',
  PROTOCOL_SOURCE_AND_STORED_SETTINGS:'공통 프로토콜·과거 설정',
  TOKEN_REFERENCE_SOURCE:'토큰 참조 소스',FRAMEWORK_SOURCE_ONLY:'공통 프레임워크 소스',
  PROTOCOL_SOURCE_ONLY:'공통 프로토콜 소스',BRIDGE_COMPONENT_SOURCE:'브리지 구성요소 소스',
  DOCUMENTATION_ONLY:'공식 문서만 확보',
};
// Offline allowlisted excerpts only. No archive bytes, paths, endpoints, or runtime acquisition.
export async function top10ProfileExcerpts(){
  const [result,initial,remaining,registry]=await Promise.all([
    read('data/source-review-top10-results.json'),read('data/source-review-top10-intake-plan.json'),
    read('data/source-review-top10-remaining-plan.json'),read('data/asset-registry.json'),
  ]);
  return result.cases.map(c=>{
    const target=[...initial.targets,...remaining.targets].find(t=>t.coinId===c.coinId&&t.networkId===c.networkId&&t.address);
    const mint=c.networkId==='solana'?registry.deployments.find(d=>d.id===c.id)?.identity.address:undefined;
    const identity=c.identity?Object.entries(c.identity).map(([key,value])=>`${key}: ${value}`).join(' · '):undefined;
    const label=scopeLabels[c.reviewScope];if(!label)throw new Error('Unknown review scope');
    return {
      id:c.id,coinId:c.coinId,symbol:c.coinId.toUpperCase(),network:c.supplySelection.name,
      networkKey:target?.chainId??c.networkId,...(target?{chainId:target.chainId}:{}),
      address:target?.address??mint??identity??'개별 자산 식별자는 이 발췌에 포함하지 않음',
      identityLabel:target?'저장 주소 후보':mint?'저장 mint':identity?'저장 식별자':'식별 근거',
      reviewScope:c.reviewScope,scopeLabel:label,sourceReviewStatus:'RESEARCH_SCOPE_REVIEWED',
      reviewedAt:result.analysisDate,deploymentBinding:'UNKNOWN',selectionDay:result.selectionDay,
      features:c.features.map((f,index)=>({id:`scope-${index}`,label:f.name,group:f.group,status:f.state,detail:f.condition,evidence:f.evidence.join(' · ')})),
      limitations:[...c.limitations,'선정 기준: '+result.selectionDay+' 저장 네트워크 유통공급량. 네트워크 집계와 선택 컨트랙트 물량의 대응은 미확정.',
        '현재 배포 연결·설정과 실제 권한 행사는 이 검토로 인증하지 않음.'],
      evidenceRecords:c.evidenceIds.map(id=>{
        const a=result.artifacts.find(a=>a.id===id);if(!a)throw new Error('Missing evidence');
        return {id:a.id,state:a.state,sha256:a.sha256,requestedAt:a.requestedAt};
      }),
      functions:c.features.filter(f=>f.group==='전송·승인'||f.group==='전송 특성').map(f=>f.condition),
      authorities:c.features.filter(f=>f.group!=='전송·승인'&&f.group!=='전송 특성').map(f=>f.condition),
      observation:'저장 연구 결과의 검토 발췌. 새 코드·설정 조회와 실행은 수행하지 않음.',
      bindingDetail:'현재 배포 연결 UNKNOWN. 초기 구현·공통 코드·참조·문서 범위는 검토 종류를 따름.',
      references:['2026-10-25-top10-source-review-results','source-review-top10-results.json'],
    };
  });
}
export async function top10ProfileModule(){return '// Generated offline by tools/top10-profile-excerpts.mjs. Reviewed excerpts only.\nexport const top10SourceProfiles='+JSON.stringify(await top10ProfileExcerpts(),null,2)+';\n';}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  await writeFile(new URL('../web/source-review-top10-data.js',import.meta.url),await top10ProfileModule());
  console.log('18 reviewed profile excerpts generated offline.');
}
