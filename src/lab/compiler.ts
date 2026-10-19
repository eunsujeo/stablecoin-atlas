import { readFile } from 'node:fs/promises';
import solc from 'solc';
import { keccak256, toHex, type Hex } from 'viem';
export const fixtureNames = ['StandardToken', 'NoReturnToken', 'FalseReturnToken', 'FeeToken', 'ZeroResetToken', 'PausableToken', 'BlacklistToken'] as const;
export async function compileFixtures() {
  const source = await readFile(new URL('../../fixtures/Tokens.sol', import.meta.url), 'utf8');
  const settings = { optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai', outputSelection: { '*': { '*': ['evm.bytecode.object'] } } };
  const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'Tokens.sol': { content: source } }, settings }))) as {
    errors?: { severity: string; formattedMessage: string }[];
    contracts: Record<string, Record<string, { evm: { bytecode: { object: string } } }>>;
  };
  const errors = output.errors?.filter(e => e.severity === 'error');
  if (errors?.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  const bytecodes = Object.fromEntries(Object.entries(output.contracts['Tokens.sol']!).map(([name, c]) => [name, `0x${c.evm.bytecode.object}` as Hex]));
  return { bytecodes, build: { compiler: String(solc.version()), sourceHash: keccak256(toHex(source)), settings } };
}
