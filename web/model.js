// This model is deliberately mock-only. Monetary values stay decimal strings/BigInt.
export const ASSETS = ['USDT', 'USDC', 'RLUSD'];
export const CHAINS = ['Ethereum', 'TRON', 'Solana', 'XRPL'];
const PROFILE_KEYS = new Set(['USDC:Ethereum', 'USDT:Ethereum', 'RLUSD:Ethereum', 'USDT:TRON', 'USDC:Solana', 'USDT:Solana', 'USDC:XRPL', 'RLUSD:XRPL']);
const isAmount = value => typeof value === 'string' && /^(0|[1-9]\d{0,77})$/.test(value);
export function validateMock(data) {
  if (!data || data.kind !== 'FICTIONAL_UI_MOCK_NOT_ASSESSMENT_OR_MARKET_DATA' || data.allValuesAreFictional !== true || data.unit !== 'token') throw new Error('INVALID_MOCK');
  if (!Array.isArray(data.coins) || data.coins.length !== 3 || !Array.isArray(data.profiles) || data.profiles.length !== 8 || !Array.isArray(data.historyLabels) || data.historyLabels.length !== 6 || !data.historyLabels.every(s => typeof s === 'string' && s.length <= 24)) throw new Error('INVALID_MOCK');
  const keys = new Set();
  for (const [rows, profiles] of [[data.coins, false], [data.profiles, true]]) {
    for (const row of rows) {
      if (!row || !ASSETS.includes(row.asset) || !isAmount(row.supply) || !Number.isInteger(row.score) || row.score < 0 || row.score > 100 || !['A', 'B', 'C', 'D'].includes(row.grade)) throw new Error('INVALID_MOCK');
      if (profiles && (!CHAINS.includes(row.chain) || !PROFILE_KEYS.has(`${row.asset}:${row.chain}`))) throw new Error('INVALID_MOCK');
      const key = `${profiles ? 'p' : 'c'}:${row.asset}:${profiles ? row.chain : ''}`;
      if (keys.has(key)) throw new Error('INVALID_MOCK');
      keys.add(key);
      if (!profiles && (!Array.isArray(row.history) || row.history.length !== 6 || !row.history.every(isAmount) || row.history.at(-1) !== row.supply)) throw new Error('INVALID_MOCK');
    }
  }
  return data;
}
export const sumSupply = rows => rows.reduce((sum, row) => sum + BigInt(row.supply), 0n);
export function sortSupply(rows, ascending = false) {
  return [...rows].sort((a, b) => {
    const x = BigInt(a.supply), y = BigInt(b.supply);
    return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
  });
}
export function selectRows(data, mode, asset = 'all') {
  return (mode === 'profiles' ? data.profiles : data.coins).filter(row => asset === 'all' || row.asset === asset);
}
export function historyFor(data, asset = 'all') {
  const coins = selectRows(data, 'coins', asset);
  return data.historyLabels.map((label, i) => ({ label, value: coins.reduce((sum, row) => sum + BigInt(row.history[i]), 0n).toString() }));
}
export function percent(value, total) {
  const a = BigInt(value), b = BigInt(total);
  if (b === 0n) return '—';
  const tenths = (a * 1000n + b / 2n) / b;
  return `${tenths / 10n}.${tenths % 10n}%`;
}
export function exact(value) { return BigInt(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
export function compact(value) {
  const v = BigInt(value), negative = v < 0n, n = negative ? -v : v;
  if (n < 100000000n) return `${negative ? '−' : ''}${exact(n)}`;
  const hundredths = n * 100n / 100000000n;
  const fraction = `${hundredths % 100n}`.padStart(2, '0').replace(/0+$/, '');
  return `${negative ? '−' : ''}${exact(hundredths / 100n)}${fraction ? '.' + fraction : ''}억`;
}
// A bounded display coordinate only; never convert a monetary amount to Number.
export function coordinate(value, total, scale = 1000) {
  if (!Number.isInteger(scale) || scale < 1 || scale > 10000) throw new Error('INVALID_SCALE');
  const a = BigInt(value), b = BigInt(total);
  if (a < 0n || b <= 0n || a > b) throw new Error('INVALID_RATIO');
  return Number(a * BigInt(scale) / b);
}
