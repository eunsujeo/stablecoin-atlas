import {validateContractReviewStore} from './contract-review-model.js';
// A display projection only. Stored evidence/status and immutable DB rows stay intact.
export function currentContractReviews(store){
  validateContractReviewStore(store);
  const latest=new Map();
  const time=p=>[p.observedAt,p.runtime?.endedAt??p.observedAt,p.id].join('|');
  for(const p of store.reports){
    const key=p.chainId+':'+p.address.toLowerCase(),previous=latest.get(key);
    if(!previous||time(p)>time(previous))latest.set(key,p);
  }
  return [...latest.values()].sort((a,b)=>time(a)>time(b)?-1:time(a)<time(b)?1:0).map(original=>{
    const p=structuredClone(original),find=id=>p.sections.find(s=>s.id===id);
    const functions=find('functions')?.rows?.length;
    const experiments=find('experiments'),passed=/\b(\d+)항목 PASS \/ FAIL 0/.exec(experiments?.intro??'');
    const sourceKnown=find('evidence')?.facts?.some(([label,value])=>label==='소스 SHA-256'&&value==='2054218939d3fa0f52f8ce1a33658d570a550671f63197356ee5744f7e188b1e');
    const localSourceReviewed=sourceKnown&&functions===16&&passed?.[1]==='10';
    p.presentation={label:localSourceReviewed?'저장 소스 검토 완료':'저장 검토 결과',functions:functions===undefined?'미기록':String(functions),sections:String(p.sections.length),fixtures:passed?`${passed[1]} / ${passed[1]}`:'미기록'};
    if(localSourceReviewed){
      const overview=find('overview');
      overview.facts=overview.facts?.filter(([label])=>!['전체 상태','원래 실패 시도 시각'].includes(label));
      overview.facts?.unshift(['로컬 검토 범위','저장 소스의 함수·권한 조건 검토 · 사설 10개 시나리오 완료']);
      const architecture=find('architecture');
      architecture.title='소스 구조·검토 범위';
      architecture.intro='선택 소스의 호출 구조를 검토했습니다. 실제 Proxy·권한 검증은 이번 로컬 검토 범위에 포함하지 않습니다.';
      const access=find('access');
      access.intro='소스에 나타난 접근 조건을 검토했습니다. 실제 역할 설정과 권한 행사는 이번 검토 범위에 포함하지 않습니다.';
      access.notes=access.notes.map(note=>note.replace('별도 검토가 필요합니다.','이번 검토 범위에 포함하지 않습니다.'));
      const evidence=find('evidence');evidence.title='근거·검토 범위';
      evidence.facts=evidence.facts.filter(([label])=>label!=='v2 실패 출처').map(([label,value])=>[label==='최초 연구 출처'?'소스 연구 출처':label,value]);
      evidence.notes=evidence.notes.filter(note=>!/최초 실패|TLS_FAILURE|소비는 모두/.test(note));
      evidence.notes.unshift('원본 배포 재현·소스 진위 인증·실제 Proxy/역할 검증은 이번 검토 범위 밖입니다. 아래 미실행 항목을 로컬 검토 완료의 추가 조건으로 요구하지 않습니다.');
    }
    return p;
  });
}
