import * as fs from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

type FileOperations = Pick<typeof fs, 'mkdir' | 'mkdtemp' | 'chmod' | 'lstat' | 'open' | 'rename' | 'rm'>;
type OutputFailure = 'INVALID_DESTINATION' | 'SAVE_FAILED' | 'CLEANUP_AFTER_COMMIT';
const messages: Record<OutputFailure, string> = {
  INVALID_DESTINATION: 'Report output must be a regular file path.',
  SAVE_FAILED: 'Could not save report; details omitted.',
  CLEANUP_AFTER_COMMIT: 'Report saved, but temporary cleanup failed.',
};
export class ReportOutputError extends Error {
  constructor(readonly code: OutputFailure) { super(messages[code]); }
}

// The injectable filesystem boundary is for deterministic failure tests, not CLI configuration.
export async function writeReportAtomically(path: string, serialized: string, operations: FileOperations = fs): Promise<void> {
  let temporary: string | undefined, committed = false, failure: ReportOutputError | undefined;
  try {
    if (!path || path.endsWith(sep)) throw new ReportOutputError('INVALID_DESTINATION');
    const destination = resolve(path), parent = dirname(destination);
    try {
      const entry = await operations.lstat(destination);
      if (!entry.isFile()) throw new ReportOutputError('INVALID_DESTINATION');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await operations.mkdir(parent, { recursive: true, mode: 0o700 });
    temporary = await operations.mkdtemp(join(parent, '.compat-report-'));
    // Tighten only newly owned paths; never chmod the existing parent or destination.
    await operations.chmod(temporary, 0o700);
    const staged = join(temporary, 'report.json');
    const handle = await operations.open(staged, 'wx', 0o600);
    let writeFailed = false, writeError: unknown;
    try {
      await handle.chmod(0o600); // Ensure owner access even under a restrictive umask.
      await handle.writeFile(serialized, 'utf8');
      await handle.sync();
    } catch (error) { writeFailed = true; writeError = error; }
    finally {
      try { await handle.close(); }
      catch (error) { if (!writeFailed) { writeFailed = true; writeError = error; } }
    }
    if (writeFailed) throw writeError;
    await operations.rename(staged, destination);
    committed = true;
  } catch (error) {
    failure = error instanceof ReportOutputError ? error : new ReportOutputError('SAVE_FAILED');
  } finally {
    if (temporary) {
      try { await operations.rm(temporary, { recursive: true, force: true }); }
      catch { failure ??= new ReportOutputError(committed ? 'CLEANUP_AFTER_COMMIT' : 'SAVE_FAILED'); }
    }
  }
  if (failure) throw failure;
}
