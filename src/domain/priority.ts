import { lateRatio, positionOf } from "./ledger";
import type { AppState, Portfolio, Position, PriorityWeights, Ranked } from "./types";

export function scorePosition(
  portfolio: Portfolio,
  position: Position,
  weights: PriorityWeights,
  referenceDate: string,
): Ranked {
  const ratio = lateRatio(portfolio, position.clientId, referenceDate, position.invoiceId);
  const anciennete = Math.min(Math.max(position.daysOverdue, 0), weights.plafondJours) / weights.plafondJours;
  const solde =
    Math.min(Math.max(position.balanceCfa, 0), weights.plafondSolde) / weights.plafondSolde;
  const historique = ratio;
  const score = weights.anciennete * anciennete + weights.solde * solde + weights.historique * historique;
  return {
    ...position,
    score: position.actionable ? score : 0,
    lateRatio: ratio,
    parts: { anciennete, solde: position.actionable ? solde : 0, historique },
  };
}

export function rankAll(state: AppState): Ranked[] {
  return state.portfolio.invoices
    .map((invoice) =>
      scorePosition(
        state.portfolio,
        positionOf(state.portfolio, invoice, state.settings.referenceDate),
        state.settings.weights,
        state.settings.referenceDate,
      ),
    )
    .sort((a, b) => b.score - a.score || b.balanceCfa - a.balanceCfa || a.invoiceId.localeCompare(b.invoiceId));
}
