import { parseArgs } from 'node:util';
import { reportValidationFailure, validateAssessmentReportFile } from './report-contract.js';

export async function validateReportCommand(args: string[]): Promise<number> {
  let file: string;
  try {
    const { values, tokens } = parseArgs({ args, options: { file: { type: 'string' }, help: { type: 'boolean' } },
      strict: true, allowPositionals: false, tokens: true });
    if (values.help && tokens.length === 1) {
      process.stdout.write('validate --file <AssessmentReport1.0.json>\nOffline schema/internal consistency only; no authenticity or asset approval. Exit0 valid,2 invalid,1 input/options error.\n'); return 0;
    }
    if (values.help || !values.file || tokens.filter(t => t.kind === 'option' && t.name === 'file').length !== 1) throw new Error();
    file = values.file;
  } catch {
    process.stdout.write(JSON.stringify(reportValidationFailure('INVALID_OPTIONS')) + '\n');
    process.stderr.write('Report validation options are invalid; details omitted.\n'); return 1;
  }
  try {
    const result = await validateAssessmentReportFile(file);
    process.stdout.write(JSON.stringify(result) + '\n'); return result.valid ? 0 : 2;
  } catch {
    process.stdout.write(JSON.stringify(reportValidationFailure('FILE_INPUT_ERROR')) + '\n');
    process.stderr.write('Report validation input could not be read; details omitted.\n'); return 1;
  }
}
