export function roundCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(roundCurrency(value));
}

export function formatCurrencyWithUnit(value: number) {
  return `${formatCurrency(value)} 円`;
}

export function formatSignedCurrencyWithUnit(value: number) {
  const rounded = roundCurrency(value);
  return `${rounded > 0 ? "+" : ""}${formatCurrencyWithUnit(rounded)}`;
}

export function formatSignedCurrency(value: number) {
  const rounded = roundCurrency(value);
  return `${rounded > 0 ? "+" : ""}${formatCurrency(rounded)}`;
}
