import { parseArgs } from 'node:util';
import { runAllowanceSuite } from './allowance-suite.js';
import { serializeAllowanceReport } from './allowance-report.js';
import { writeReportAtomically } from '../../report-output.js';
const controller=new AbortController(),abort=()=>controller.abort();process.once('SIGINT',abort);process.once('SIGTERM',abort);
try{
 const {values}=parseArgs({options:{out:{type:'string'}},strict:true,allowPositionals:false});
 const report=await runAllowanceSuite(controller.signal,undefined,(id,status)=>process.stderr.write(`Private allowance case ${id}: ${status}\n`));
 const text=serializeAllowanceReport(report);if(values.out)await writeReportAtomically(values.out,text);else process.stdout.write(text);
 process.stderr.write(`Private allowance suite: ${report.outcome}; ${report.cases.filter(c=>c.outcome==='OBSERVED').length}/10 cases.\n`);process.exitCode=report.outcome==='OBSERVED'?0:1;
}catch{process.stderr.write('Private allowance suite failed; details omitted.\n');process.exitCode=1;}
finally{process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);}
