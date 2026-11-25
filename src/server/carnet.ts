import { reduce, type Action } from "@/domain/reduce";
import { createInitialState } from "@/domain/seed";
import { STATE_VERSION, type AppState, type ChannelMode } from "@/domain/types";
import type { Dashboard } from "@/shared/dashboard";
import { present } from "./present";

const CHANNELS = new Set<ChannelMode>(["preference", "whatsapp", "sms", "email"]);

export function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const state = value as AppState;
  return (
    state.version === STATE_VERSION &&
    Array.isArray(state.portfolio?.invoices) &&
    Array.isArray(state.portfolio?.clients) &&
    Array.isArray(state.portfolio?.payments) &&
    Array.isArray(state.journal) &&
    Array.isArray(state.messages) &&
    Array.isArray(state.outbox) &&
    typeof state.settings?.referenceDate === "string" &&
    Number.isInteger(state.settings?.thresholdCfa)
  );
}

export function isAction(value: unknown): value is Action {
  if (!value || typeof value !== "object") return false;
  const action = value as { type?: string; offline?: unknown; invoiceId?: unknown; amountCfa?: unknown; thresholdCfa?: unknown; channelMode?: unknown };
  switch (action.type) {
    case "reset":
    case "prepare":
    case "flush":
    case "classifyAll":
      return true;
    case "setOffline":
      return typeof action.offline === "boolean";
    case "pay":
      return typeof action.invoiceId === "string" && Number.isInteger(action.amountCfa);
    case "approve":
    case "suspend":
    case "closeDispute":
      return typeof action.invoiceId === "string";
    case "setThreshold":
      return Number.isInteger(action.thresholdCfa);
    case "setChannelMode":
      return typeof action.channelMode === "string" && CHANNELS.has(action.channelMode as ChannelMode);
    case "playPaymentTrap":
      return action.invoiceId === undefined || typeof action.invoiceId === "string";
    default:
      return false;
  }
}

export function runCarnet(input: { state: unknown; action: unknown }):
  | { ok: true; state: AppState; view: Dashboard }
  | { ok: false; error: string } {
  let state: AppState;
  if (input.state == null) state = createInitialState();
  else if (isAppState(input.state)) state = input.state;
  else return { ok: false, error: "Le carnet reçu est illisible. Les chiffres n'ont pas été recalculés." };

  if (input.action != null) {
    if (!isAction(input.action)) return { ok: false, error: "Cette action n'est pas reconnue par le moteur." };
    state = reduce(state, input.action);
  }
  return { ok: true, state, view: present(state) };
}
