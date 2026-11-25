import { reduceBilling, type BillingAction, createBillingState } from "@/domain/billing/reduce";
import { BILLING_VERSION, type BillingState, type Draft } from "@/domain/billing/types";
import type { BillingView } from "@/shared/invoice";
import { presentBilling } from "./billing-view";
import { listIssued, saveIssued } from "./registry";

export function isBillingState(value: unknown): value is BillingState {
  if (!value || typeof value !== "object") return false;
  const state = value as BillingState;
  return state.version === BILLING_VERSION && Array.isArray(state.issued) && Array.isArray(state.journal) && Number.isInteger(state.taxRate);
}

export function isBillingAction(value: unknown): value is BillingAction {
  if (!value || typeof value !== "object") return false;
  const action = value as { type?: string };
  return (
    action.type === "reset" ||
    action.type === "parse" ||
    action.type === "setTax" ||
    action.type === "setPrice" ||
    action.type === "setQty" ||
    action.type === "setDue" ||
    action.type === "confirm" ||
    action.type === "acceptUnknownClient" ||
    action.type === "acceptUnusualPrice" ||
    action.type === "acceptAnnouncedGap" ||
    action.type === "billDelivered" ||
    action.type === "validate" ||
    action.type === "credit"
  );
}

function boundedDraft(draft: Draft | null): Draft | null {
  if (!draft) return null;
  return {
    ...draft,
    sourceText: draft.sourceText.slice(0, 4_000),
    lines: draft.lines.slice(0, 24),
  };
}

export async function runBilling(input: { state: unknown; action: unknown }, origin: string): Promise<
  { ok: true; state: BillingState; view: BillingView } | { ok: false; error: string }
> {
  const stored = await listIssued();
  let state: BillingState;
  if (input.state == null) state = { ...createBillingState(), issued: stored };
  else if (isBillingState(input.state)) {
    state = {
      ...input.state,
      issued: stored,
      journal: input.state.journal.slice(-40),
      draft: boundedDraft(input.state.draft),
    };
  } else return { ok: false, error: "Le registre des factures est illisible." };
  if (input.action != null) {
    if (!isBillingAction(input.action)) return { ok: false, error: "Action inconnue." };
    state = reduceBilling(state, input.action);
  }
  const known = new Set(stored.map((item) => item.sceau));
  for (const document of state.issued) {
    if (known.has(document.sceau)) continue;
    const saved = await saveIssued(document);
    if (saved === "duplicate") return { ok: false, error: "Ce numéro est déjà au registre." };
    known.add(document.sceau);
  }
  state = { ...state, issued: await listIssued() };
  return { ok: true, state, view: await presentBilling(state, origin) };
}

export function requestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
