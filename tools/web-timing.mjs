import {AsyncLocalStorage} from 'node:async_hooks';

const context=new AsyncLocalStorage();
const routes=new Set(['/network-usage-data.json','/market-data.json','/registration-index.json','/registration-history.json','/activity-data.json','/reviewed-supply-data.json','/survey-data.json','/fx-data.json']);
export function addWebTiming(key,value=1){const metrics=context.getStore();if(metrics)metrics[key]=(metrics[key]??0)+value;}
export function marketCacheTiming(state){const metrics=context.getStore();if(metrics)metrics.cache=state;}
// Fixed route names and numbers only: never SQL, query strings, credentials or errors.
export function timedAPI(handler,report){
  return (req,res)=>{
    const route=(req.url??'').split('?')[0];
    if(!report||!routes.has(route))return handler(req,res);
    const started=performance.now(),metrics={dbWaitMs:0,dbConnectMs:0,dbVerifyMs:0,dbQueryMs:0,dbQueryCount:0,dbReused:0};
    let reported=false;
    const finish=()=>{
      if(reported)return;reported=true;
      const result={event:'ATLAS_API_TIMING',route,method:req.method==='HEAD'?'HEAD':req.method==='GET'?'GET':'OTHER',status:res.statusCode,aborted:!res.writableFinished,...metrics,responseMs:performance.now()-started};
      for(const [key,value]of Object.entries(result))if(typeof value==='number')result[key]=Math.round(value*100)/100;
      try{report(result);}catch{/* Metrics must never change API availability. */}
    };
    res.once('finish',finish);res.once('close',finish);
    return context.run(metrics,()=>handler(req,res));
  };
}
