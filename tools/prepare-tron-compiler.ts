import { compileTronFixture, compilerPin } from '../src/tron/lab/compiler.js';
try {
  if(process.argv.length!==2)throw new Error('INVALID_ARGUMENTS');
  const compiled=await compileTronFixture();
  if(compiled.build.sha256!==compilerPin.sha256)throw new Error('COMPILER_HASH_MISMATCH');
  console.log(`Pinned TRON compiler verified: ${compilerPin.version}; SHA-256 ${compilerPin.sha256}. No chain calls.`);
}catch{
  console.error('TRON_COMPILER_PREPARATION_FAILED: pinned compiler unavailable or invalid. No endpoint switching or test skipping.');
  process.exitCode=1;
}
