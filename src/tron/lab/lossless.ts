// Node's source-aware reviver preserves integer text before Number rounding can reach a report.
export function parseTronJson(text: string): any {
  return (JSON.parse as (text: string, reviver: (key: string, value: unknown, context: { source?: string }) => unknown) => unknown)(text,
    (_key, value, context) => {
      if (typeof value !== 'number') return value;
      if (typeof context?.source !== 'string' || !/^-?(?:0|[1-9][0-9]*)$/.test(context.source)) throw new Error('LOSSLESS_INTEGER_REQUIRED');
      return context.source;
    });
}
export function decimal(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(value)) throw new Error('INVALID_INTEGER');
  return BigInt(value);
}
