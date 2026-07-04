export const CURRENCY_CODE = 'USD';

export function formatUSD(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

export function formatUSDSigned(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0.00';
  const sign = n >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}
