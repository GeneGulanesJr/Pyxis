/** Format token count: <1k as-is, >=1k as "X.Xk", >=1M as "X.XM" */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Format cost as $X.XXX */
export function formatCost(n: number): string {
  return `$${n.toFixed(3)}`;
}

/** Format percentage as XX% */
export function formatPct(n: number): string {
  return `${Math.round(n)}%`;
}

/** Estimate token count from string length */
export function estimateTokens(text: string, isCode = false): number {
  const ratio = isCode ? 3 : 4;
  return Math.ceil(text.length / ratio);
}