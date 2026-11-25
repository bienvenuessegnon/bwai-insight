import { reduceBilling, type BillingAction, createBillingState } from "@/domain/billing/reduce";
import { BILLING_VERSION, type BillingState } from "@/domain/billing/types";
import type { BillingView } from "@/shared/invoice";
import { presentBilling } from "./billing-view";

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

export async function runBilling(input: { state: unknown; action: unknown }, origin: string): Promise<
  { ok: true; state: BillingState; view: BillingView } | { ok: false; error: string }
> {
  let state: BillingState;
  if (input.state == null) state = createBillingState();
  else if (isBillingState(input.state)) state = input.state;
  else return { ok: false, error: "Le registre des factures est illisible." };
  if (input.action != null) {
    if (!isBillingAction(input.action)) return { ok: false, error: "Action inconnue." };
    state = reduceBilling(state, input.action);
  }
  return { ok: true, state, view: await presentBilling(state, origin) };
}

export function requestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
