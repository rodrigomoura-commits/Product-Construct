/**
 * Official function to calculate the general progress/maturity of a product
 * based on its 6 journey stages.
 */
export function calculateProductMaturity(stages: any[]): number {
  const stageKeys = ["sense", "shape", "sketch", "scope", "ship", "sense_plus"];

  if (!stages || stages.length === 0) return 0;

  const values = stageKeys.map((key) => {
    const stage = stages.find((item) => item.stage_key === key);
    // Support multiple field names with priority
    const value = Number(stage?.maturity ?? stage?.progress ?? stage?.quality_score ?? 0);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  });

  const total = values.reduce((sum, value) => sum + value, 0);
  const average = total / stageKeys.length;

  // Rule: If any stage has maturity but the average rounds to 0, return 1
  if (total > 0 && average < 1) return 1;

  return Math.round(average);
}
