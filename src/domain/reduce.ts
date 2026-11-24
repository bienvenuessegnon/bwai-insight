import { classify } from "./classifier";
import { addDays, tickMinute } from "./dates";
import { formatCfa } from "./format";
import { positionOf } from "./ledger";
import { decide } from "./preflight";
import { createInitialState } from "./seed";
import type { AppState, ChannelMode, JournalEntry, JournalKind, WorkItem } from "./types";

export type Action =
  | { type: "reset" }
  | { type: "prepare" }
  | { type: "flush" }
  | { type: "setOffline"; offline: boolean }
  | { type: "pay"; invoiceId: string; amountCfa: number }
  | { type: "classifyAll" }
  | { type: "approve"; invoiceId: string }
  | { type: "suspend"; invoiceId: string }
  | { type: "closeDispute"; invoiceId: string }
  | { type: "setThreshold"; thresholdCfa: number }
  | { type: "setChannelMode"; channelMode: ChannelMode }
  | { type: "playPaymentTrap"; invoiceId?: string };

function log(state: AppState, entry: Omit<JournalEntry, "id" | "at">): AppState {
  const next: JournalEntry = { ...entry, id: `j-${state.seq}`, at: state.clock };
  return {
    ...state,
    seq: state.seq + 1,
    clock: tickMinute(state.clock),
    journal: [...state.journal, next],
  };
}

function logged(state: AppState, key: string, kind: JournalKind): boolean {
  return state.journal.some((entry) => entry.idempotencyKey === key && entry.kind === kind);
}

function applyDecision(state: AppState, item: WorkItem): AppState {
  if (item.decision === "deja_traite") return state;
  if (item.decision === "envoyer") {
    if (state.outbox.some((queued) => queued.idempotencyKey === item.idempotencyKey)) return state;
    if (logged(state, item.idempotencyKey, "relance_envoyee")) return state;
    if (state.settings.offline) {
      return { ...state, outbox: [...state.outbox, item] };
    }
    return log(state, {
      kind: "relance_envoyee",
      invoiceId: item.invoiceId,
      clientId: item.clientId,
      idempotencyKey: item.idempotencyKey,
      summary: `Relance ${item.step} simulée, canal ${item.channel}.`,
      detail: { etape: item.step, canal: item.channel, raison: item.reasonCode },
    });
  }
  const kind = item.decision === "annuler" ? "relance_annulee" : "revue_demandee";
  if (logged(state, item.idempotencyKey, kind)) return state;
  return log(state, {
    kind,
    invoiceId: item.invoiceId,
    clientId: item.clientId,
    idempotencyKey: item.idempotencyKey,
    summary: item.reason,
    detail: { raison: item.reasonCode, etape: item.step },
  });
}

export function prepare(state: AppState): AppState {
  let next = state;
  const invoices = [...state.portfolio.invoices].sort((a, b) => a.id.localeCompare(b.id));
  for (const invoice of invoices) {
    next = applyDecision(next, decide(next, invoice.id));
  }
  return next;
}

export function flush(state: AppState): AppState {
  if (state.settings.offline) return state;
  let next = state;
  const queue = [...state.outbox];
  for (const item of queue) {
    next = { ...next, outbox: next.outbox.filter((queued) => queued.idempotencyKey !== item.idempotencyKey) };
    next = applyDecision(next, decide(next, item.invoiceId));
  }
  return next;
}

function pay(state: AppState, invoiceId: string, amountCfa: number): AppState {
  const invoice = state.portfolio.invoices.find((item) => item.id === invoiceId);
  if (!invoice || !Number.isInteger(amountCfa) || amountCfa <= 0) return state;
  const position = positionOf(state.portfolio, invoice, state.settings.referenceDate);
  if (position.balanceCfa <= 0) return state;
  const amount = Math.min(amountCfa, position.balanceCfa);
  const id = `pay-sim-${invoiceId}-${state.seq}`;
  const payment = {
    id,
    invoiceId,
    paidOn: state.settings.referenceDate,
    amountCfa: amount,
    channel: "momo_mtn" as const,
    reference: `FICTIF-${id}`,
  };
  const withPayment: AppState = {
    ...state,
    portfolio: { ...state.portfolio, payments: [...state.portfolio.payments, payment] },
  };
  const after = positionOf(withPayment.portfolio, invoice, state.settings.referenceDate);
  return log(withPayment, {
    kind: "paiement",
    invoiceId,
    clientId: invoice.clientId,
    idempotencyKey: id,
    summary: `Encaissement simulé de ${formatCfa(amount)}. Nouveau solde : ${formatCfa(after.balanceCfa)}.`,
    detail: { montant: amount, solde: after.balanceCfa, reference: payment.reference },
  });
}

function classifyAll(state: AppState): AppState {
  let next = state;
  for (const message of state.messages) {
    if (message.classification) continue;
    const classification = classify(message.text);
    next = {
      ...next,
      messages: next.messages.map((item) => (item.id === message.id ? { ...item, classification } : item)),
    };
    next = log(next, {
      kind: "message_classe",
      invoiceId: message.invoiceId,
      clientId: message.clientId,
      idempotencyKey: `message:${message.id}`,
      summary: `Message ${message.id} lu comme « ${classification.intent} ».`,
      detail: {
        intention: classification.intent,
        confiance: Number(classification.confidence.toFixed(2)),
      },
    });
  }
  return next;
}

function approve(state: AppState, invoiceId: string): AppState {
  const item = decide(state, invoiceId);
  if (item.reasonCode === "litige" || item.reasonCode === "contestation_message") {
    return log(state, {
      kind: "revue_humaine",
      invoiceId,
      clientId: item.clientId,
      idempotencyKey: `${invoiceId}:refus-litige`,
      summary: "Approbation refusée : un litige reste ouvert.",
      detail: { decision: "refus" },
    });
  }
  if (item.decision !== "revue" || (item.reasonCode !== "seuil" && item.reasonCode !== "sequence") || item.step === null) {
    return state;
  }
  let next: AppState = {
    ...state,
    approvals: [...state.approvals, { invoiceId, step: item.step }],
  };
  next = log(next, {
    kind: "revue_humaine",
    invoiceId,
    clientId: item.clientId,
    idempotencyKey: `${invoiceId}:approuve:${item.step}`,
    summary: `Palier ${item.step} approuvé par une personne. Le pré-vol est relancé.`,
    detail: { decision: "approuvee", etape: item.step },
  });
  return applyDecision(next, decide(next, invoiceId));
}

function suspend(state: AppState, invoiceId: string): AppState {
  const invoice = state.portfolio.invoices.find((item) => item.id === invoiceId);
  if (!invoice) return state;
  const until = addDays(state.settings.referenceDate, 14);
  let next: AppState = {
    ...state,
    suppressions: [...state.suppressions.filter((item) => item.invoiceId !== invoiceId), { invoiceId, until }],
  };
  next = log(next, {
    kind: "revue_humaine",
    invoiceId,
    clientId: invoice.clientId,
    idempotencyKey: `${invoiceId}:suspendu:${until}`,
    summary: `Relances suspendues jusqu'au ${until}.`,
    detail: { decision: "suspendue", jusquau: until },
  });
  return next;
}

function closeDispute(state: AppState, invoiceId: string): AppState {
  const invoice = state.portfolio.invoices.find((item) => item.id === invoiceId);
  if (!invoice) return state;
  const open = state.portfolio.disputes.some((item) => item.invoiceId === invoiceId && item.status === "ouverte");
  if (!open) return state;
  let next: AppState = {
    ...state,
    portfolio: {
      ...state.portfolio,
      disputes: state.portfolio.disputes.map((item) =>
        item.invoiceId === invoiceId && item.status === "ouverte" ? { ...item, status: "closee" } : item,
      ),
    },
  };
  next = log(next, {
    kind: "revue_humaine",
    invoiceId,
    clientId: invoice.clientId,
    idempotencyKey: `${invoiceId}:litige-clos`,
    summary: "Litige clos dans le livre. Un message de contestation, s'il existe, maintient la revue.",
    detail: { decision: "litige_clos" },
  });
  return next;
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "reset":
      return createInitialState();
    case "prepare":
      return prepare(state);
    case "flush":
      return flush(state);
    case "setOffline":
      return { ...state, settings: { ...state.settings, offline: action.offline } };
    case "pay":
      return pay(state, action.invoiceId, action.amountCfa);
    case "classifyAll":
      return classifyAll(state);
    case "approve":
      return approve(state, action.invoiceId);
    case "suspend":
      return suspend(state, action.invoiceId);
    case "closeDispute":
      return closeDispute(state, action.invoiceId);
    case "setThreshold":
      if (!Number.isInteger(action.thresholdCfa) || action.thresholdCfa < 0) return state;
      return { ...state, settings: { ...state.settings, thresholdCfa: action.thresholdCfa } };
    case "setChannelMode":
      return { ...state, settings: { ...state.settings, channelMode: action.channelMode } };
    case "playPaymentTrap": {
      const invoiceId = action.invoiceId ?? "fac-1155";
      let next = reduce(state, { type: "setOffline", offline: true });
      next = reduce(next, { type: "prepare" });
      const invoice = next.portfolio.invoices.find((item) => item.id === invoiceId);
      if (invoice) {
        const position = positionOf(next.portfolio, invoice, next.settings.referenceDate);
        if (position.balanceCfa > 0) next = reduce(next, { type: "pay", invoiceId, amountCfa: position.balanceCfa });
      }
      next = reduce(next, { type: "setOffline", offline: false });
      next = reduce(next, { type: "flush" });
      return reduce(next, { type: "prepare" });
    }
    default:
      return state;
  }
}
