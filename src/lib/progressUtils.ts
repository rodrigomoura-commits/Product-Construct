export function getDisplayProgress(product: any) {
  const value =
    product?.calculatedProgress ??
    product?.overall_progress ??
    product?.evolution_score ??
    product?.progress ??
    0;

  const numeric = Number(value);

  return Number.isFinite(numeric)
    ? Math.max(0, Math.min(100, Math.round(numeric)))
    : 0;
}
