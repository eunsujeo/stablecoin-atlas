// Preserve provider numeric lexemes. Exponent arithmetic concerns digit positions only.
export function registrationDecimal(value) {
  if (typeof value !== 'string' || value.length > 220) throw Error('REGISTRATION_AMOUNT_INVALID');
  const match = /^(0|[1-9]\d{0,77})(?:\.(\d{1,114}))?(?:[eE]([+-]?\d{1,3}))?$/.exec(value);
  if (!match) throw Error('REGISTRATION_AMOUNT_INVALID');
  const [, whole, fraction = '', exponent = '0'] = match;
  const shift = Number(exponent);
  if (Math.abs(shift) > 200) throw Error('REGISTRATION_AMOUNT_INVALID');
  const digits = whole + fraction;
  if (!/[1-9]/.test(digits)) return '0';
  const point = whole.length + shift;
  let integer, tail;
  if (point <= 0) { integer = '0'; tail = '0'.repeat(-point) + digits; }
  else if (point >= digits.length) { integer = digits + '0'.repeat(point - digits.length); tail = ''; }
  else { integer = digits.slice(0, point); tail = digits.slice(point); }
  integer = integer.replace(/^0+/, '') || '0';
  tail = tail.replace(/0+$/, '');
  if (integer.length > 78 || tail.length > 36) throw Error('REGISTRATION_AMOUNT_INVALID');
  return integer + (tail ? '.' + tail : '');
}

export function registrationUnits(value) {
  const normalized = registrationDecimal(value), [integer, tail = ''] = normalized.split('.');
  return BigInt(integer) * 10n ** 36n + BigInt(tail.padEnd(36, '0'));
}
