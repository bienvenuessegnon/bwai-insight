export function formatCfa(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  const body = Math.abs(Math.trunc(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  return `${sign}${body} F CFA`;
}

export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function formatScore(score: number): string {
  return score.toFixed(2).replace(".", ",");
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}
