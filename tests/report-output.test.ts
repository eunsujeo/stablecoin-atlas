import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ReportOutputError, writeReportAtomically } from '../src/report-output.js';

async function directory(run: (path: string) => Promise<void>) {
  const path = await fs.mkdtemp(join(tmpdir(), 'compatibility-report-output-'));
  try { await run(path); } finally { await fs.rm(path, { recursive: true, force: true }); }
}
const payload = JSON.stringify({ schemaVersion: '1.0', sample: 'new complete contents' }) + '\n';

test('report output creates parents and replaces existing files with complete private contents', async () => {
  await directory(async root => {
    const path = join(root, 'nested', 'report.json');
    await writeReportAtomically(path, payload);
    assert.equal(await fs.readFile(path, 'utf8'), payload);
    assert.equal((await fs.stat(path)).mode & 0o777, 0o600);
    await fs.chmod(path, 0o666);
    await writeReportAtomically(path, payload + ' ');
    assert.equal(await fs.readFile(path, 'utf8'), payload + ' ');
    assert.equal((await fs.stat(path)).mode & 0o777, 0o600);
    assert.deepEqual(await fs.readdir(join(root, 'nested')), ['report.json']);
  });
});

test('report output does not follow final symlinks or mutate an existing hardlink target', async () => {
  await directory(async root => {
    const target = join(root, 'target.json'), link = join(root, 'link.json');
    await fs.writeFile(target, 'original target');
    await fs.symlink(target, link);
    await assert.rejects(writeReportAtomically(link, payload), /regular file path/);
    assert.equal(await fs.readFile(target, 'utf8'), 'original target');
    assert((await fs.lstat(link)).isSymbolicLink());
    await fs.unlink(link); await fs.link(target, link);
    const targetMode = (await fs.stat(target)).mode;
    await writeReportAtomically(link, payload);
    assert.equal(await fs.readFile(target, 'utf8'), 'original target');
    assert.equal(await fs.readFile(link, 'utf8'), payload);
    assert.notEqual((await fs.stat(target)).ino, (await fs.stat(link)).ino);
    assert.equal((await fs.stat(target)).mode, targetMode);
    const missing = join(root, 'missing.json'), dangling = join(root, 'dangling.json');
    await fs.symlink(missing, dangling);
    await assert.rejects(writeReportAtomically(dangling, payload), /regular file path/);
    assert((await fs.lstat(dangling)).isSymbolicLink());
    await assert.rejects(fs.stat(missing), { code: 'ENOENT' });
  });
});

test('write/sync/close/rename failures preserve prior output and remove owned temporary artifacts', async () => {
  for (const phase of ['write', 'sync', 'close', 'rename'] as const) await directory(async root => {
    const path = join(root, 'report.json'); await fs.writeFile(path, 'prior report');
    const operations = { ...fs,
      async open(...args: Parameters<typeof fs.open>) {
        const handle = await fs.open(...args);
        if (phase === 'write') handle.writeFile = async () => {
          await handle.write('partial synthetic data'); throw new Error('synthetic private diagnostic');
        };
        if (phase === 'sync') handle.sync = async () => { throw new Error('synthetic private diagnostic'); };
        if (phase === 'close') {
          const close = handle.close.bind(handle);
          handle.close = async () => { await close(); throw new Error('synthetic private diagnostic'); };
        }
        return handle;
      },
      async rename(...args: Parameters<typeof fs.rename>) {
        // Publication failure is injected after actual filesystem writing has completed.
        assert.equal(await fs.readFile(args[0], 'utf8'), payload);
        if (phase === 'rename') throw new Error('synthetic private diagnostic');
        return fs.rename(...args);
      },
    };
    await assert.rejects(writeReportAtomically(path, payload, operations), error => {
      assert(error instanceof Error); assert.equal(error.message, 'Could not save report; details omitted.'); return true;
    });
    assert.equal(await fs.readFile(path, 'utf8'), 'prior report');
    assert.deepEqual(await fs.readdir(root), ['report.json']);
  });
});

test('invalid output destinations leave existing directories and parent files intact', async () => {
  await directory(async root => {
    const destination = join(root, 'directory'); await fs.mkdir(destination);
    await fs.writeFile(join(destination, 'sentinel'), 'untouched');
    await assert.rejects(writeReportAtomically(destination, payload), /regular file path/);
    assert.equal(await fs.readFile(join(destination, 'sentinel'), 'utf8'), 'untouched');
    const parent = join(root, 'parent-file'); await fs.writeFile(parent, 'untouched');
    await assert.rejects(writeReportAtomically(join(parent, 'report.json'), payload), /Could not save report/);
    assert.equal(await fs.readFile(parent, 'utf8'), 'untouched');
    const fifo = join(root, 'fifo');
    await promisify(execFile)('mkfifo', [fifo]);
    await assert.rejects(writeReportAtomically(fifo, payload), /regular file path/);
    assert((await fs.lstat(fifo)).isFIFO());
    assert.deepEqual((await fs.readdir(root)).sort(), ['directory', 'fifo', 'parent-file']);
  });
});

test('new output is 0600 under restrictive umask without changing existing parent permissions', async () => {
  await directory(async root => {
    const before = (await fs.stat(root)).mode;
    const previous = process.umask(0o777);
    try {
      const path = join(root, 'report.json');
      await writeReportAtomically(path, payload);
      assert.equal((await fs.stat(path)).mode & 0o777, 0o600);
      assert.equal(await fs.readFile(path, 'utf8'), payload);
      assert.equal((await fs.stat(root)).mode, before);
    } finally { process.umask(previous); }
  });
});

test('permission/open failures do not create output or ignore errors other than ENOENT', async () => {
  await directory(async root => {
    const path = join(root, 'report.json');
    let opened = false;
    await assert.rejects(writeReportAtomically(path, payload, { ...fs,
      async lstat() { throw Object.assign(new Error('synthetic private path'), { code: 'EACCES' }); },
      async open(...args: Parameters<typeof fs.open>) { opened = true; return fs.open(...args); },
    }), /Could not save report/);
    assert.equal(opened, false); assert.deepEqual(await fs.readdir(root), []);
    await assert.rejects(writeReportAtomically(path, payload, { ...fs,
      async open() { throw new Error('synthetic private path'); },
    }), /Could not save report/);
    assert.deepEqual(await fs.readdir(root), []);
  });
});

test('cleanup failure preserves primary errors and distinguishes a committed report', async () => {
  await directory(async root => {
    const path = join(root, 'report.json'); await fs.writeFile(path, 'old');
    const cleanupFails = async () => { throw new Error('synthetic private cleanup diagnostic'); };
    await assert.rejects(writeReportAtomically(path, payload, { ...fs, rm: cleanupFails,
      async rename() { throw new Error('synthetic primary write diagnostic'); },
    }), error => { assert(error instanceof ReportOutputError); assert.equal(error.code, 'SAVE_FAILED'); return true; });
    assert.equal(await fs.readFile(path, 'utf8'), 'old');
    await assert.rejects(writeReportAtomically(path, payload, { ...fs, rm: cleanupFails }), error => {
      assert(error instanceof ReportOutputError); assert.equal(error.code, 'CLEANUP_AFTER_COMMIT'); return true;
    });
    assert.equal(await fs.readFile(path, 'utf8'), payload);
    // Only test-created residual staging paths are removed by the outer directory helper.
  });
});

test('simultaneous output writers publish one complete payload without leftover temporary files', async () => {
  await directory(async root => {
    const path = join(root, 'report.json');
    const contents = Array.from({ length: 4 }, (_, index) => JSON.stringify({ index, value: String(index).repeat(32_768) }));
    await fs.writeFile(path, contents[0]!);
    let reading = true;
    const reader = (async () => {
      while (reading) assert(contents.includes(await fs.readFile(path, 'utf8')), 'Readers must see a complete payload');
    })();
    await Promise.all([Promise.all(contents.map(content => writeReportAtomically(path, content)))
      .finally(() => { reading = false; }), reader]);
    const actual = await fs.readFile(path, 'utf8');
    assert(contents.includes(actual)); JSON.parse(actual);
    assert.deepEqual(await fs.readdir(root), ['report.json']);
  });
});
