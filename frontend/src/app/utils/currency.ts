/**
 * Money helpers — keep all amount math in 2-decimal precision so floats
 * coming out of the LLM (e.g. 7.4999) round predictably to 7.50.
 */

const EPSILON = 0.005;

export function roundCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export function formatEuro(amount: number): string {
  return roundCents(amount).toFixed(2);
}

export function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

export function isPositiveAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > EPSILON;
}

/**
 * Distribute a euro `total` proportionally to `weights`, rounded to 2dp,
 * guaranteeing every slot receives at least 0.01 €.
 */
export function distributeCurrency(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const totalCents = Math.round(total * 100);
  const safe = weights.map((w) => Math.max(w, 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  const effective = sum > 0 ? safe : Array(n).fill(1);
  const sumE = effective.reduce((a, b) => a + b, 0);

  const raw = effective.map((w) => (totalCents * w) / sumE);
  const floors = raw.map((r) => Math.floor(r));
  let deficit = totalCents - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ frac: r - floors[i], i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = floors.slice();
  for (let k = 0; k < deficit; k++) {
    out[order[k].i] += 1;
  }

  // Ensure every slot >= 1 cent.
  while (Math.min(...out) < 1) {
    let iMin = 0;
    let iMax = 0;
    for (let i = 1; i < n; i++) {
      if (out[i] < out[iMin]) iMin = i;
      if (out[i] > out[iMax]) iMax = i;
    }
    if (out[iMax] <= 1) break;
    out[iMax] -= 1;
    out[iMin] += 1;
  }

  return out.map((c) => c / 100);
}
