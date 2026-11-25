import { anomaliesOf, priceLines, totalsOf } from "./calc";
import { parseOrder } from "./parse";
import { newSealToken } from "./seal";
import { BILLING_DATE, BILLING_VERSION, DEFAULT_TAX_RATE, type BillingState, type Draft, type IssuedDocument } from "./types";

export type BillingAction =
  | { type: "reset" }
  | { type: "parse"; text: string; label: string }
  | { type: "setTax"; taxRate: number }
  | { type: "setPrice"; lineId: string; unitPriceCfa: number }
  | { type: "setQty"; lineId: string; qty: number }
  | { type: "setDue"; dueOn: string }
  | { type: "confirm"; confirmed: boolean }
  | { type: "acceptUnknownClient" }
  | { type: "acceptUnusualPrice" }
  | { type: "acceptAnnouncedGap" }
  | { type: "billDelivered" }
  | { type: "validate" }
  | { type: "credit"; documentId: string };

export function createBillingState(): BillingState {
  return {
    version: BILLING_VERSION,
    taxRate: DEFAULT_TAX_RATE,
    draft: null,
    issued: [],
    journal: [
      {
        id: "b-0",
        at: `${BILLING_DATE}T08:00`,
        summary: "Atelier ouvert. Taxe de la maison : 18 %. Aucun montant n'est inventé.",
      },
    ],
    seq: 1,
    clock: `${BILLING_DATE}T08:00`,
  };
}

function tick(state: BillingState): BillingState {
  const [day, time] = state.clock.split("T");
  const [hour, minute] = time.split(":").map(Number);
  const next = hour * 60 + minute + 1;
  const clock = `${day}T${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
  return { ...state, clock, seq: state.seq + 1 };
}

function note(state: BillingState, summary: string): BillingState {
  const next = tick(state);
  return { ...next, journal: [...state.journal, { id: `b-${state.seq}`, at: state.clock, summary }] };
}

function issue(state: BillingState, document: Omit<IssuedDocument, "sceau" | "code" | "id">): BillingState {
  const id = `doc-${state.seq}`;
  const sceau = newSealToken();
  const issued: IssuedDocument = { ...document, id, sceau, code: sceau };
  const next = note(
    { ...state, issued: [...state.issued, issued] },
    document.kind === "avoir"
      ? `Avoir ${document.number} lié à ${document.linkedNumber}. La facture d'origine n'est pas modifiée.`
      : `Facture ${document.number} émise, simulation WhatsApp. Sceau ${document.number}.`,
  );
  return next;
}

export function reduceBilling(state: BillingState, action: BillingAction): BillingState {
  switch (action.type) {
    case "reset":
      return createBillingState();
    case "parse":
      if (typeof action.text !== "string" || !action.text.trim()) return state;
      if (action.text.length > 4_000) return note(state, "Message trop long. Quatre mille caractères au plus.");
      return note(
        { ...state, draft: parseOrder(action.text, `draft-${state.seq}`, action.label) },
        `Message lu (${action.label}). Les champs absents restent vides.`,
      );
    case "setTax":
      if (!Number.isInteger(action.taxRate) || action.taxRate < 0 || action.taxRate > 100) return state;
      return { ...state, taxRate: action.taxRate };
    case "setPrice":
      return updateLine(state, action.lineId, (line) =>
        Number.isInteger(action.unitPriceCfa) && action.unitPriceCfa > 0
          ? { ...line, unitPriceCfa: action.unitPriceCfa, source: { ...line.source, label: "Saisie humaine", confidence: "sur" } }
          : line,
      );
    case "setQty":
      return updateLine(state, action.lineId, (line) =>
        Number.isInteger(action.qty) && action.qty > 0
          ? { ...line, qty: action.qty, source: { ...line.source, label: "Saisie humaine", confidence: "sur" } }
          : line,
      );
    case "setDue":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(action.dueOn) || !state.draft) return state;
      return {
        ...state,
        draft: {
          ...state.draft,
          dueOn: action.dueOn,
          dueSource: { label: "Saisie humaine", excerpt: action.dueOn, confidence: "sur" },
        },
      };
    case "confirm":
      return { ...state, draft: state.draft ? { ...state.draft, confirmed: action.confirmed } : null };
    case "acceptUnknownClient":
      return { ...state, draft: state.draft ? { ...state.draft, acceptUnknownClient: true } : null };
    case "acceptUnusualPrice":
      return { ...state, draft: state.draft ? { ...state.draft, acceptUnusualPrice: true } : null };
    case "acceptAnnouncedGap":
      return { ...state, draft: state.draft ? { ...state.draft, acceptAnnouncedGap: true } : null };
    case "billDelivered":
      return { ...state, draft: state.draft ? { ...state.draft, billDeliveredQty: true } : null };
    case "validate":
      return validate(state);
    case "credit":
      return credit(state, action.documentId);
    default:
      return state;
  }
}

function updateLine(state: BillingState, lineId: string, change: (line: Draft["lines"][number]) => Draft["lines"][number]): BillingState {
  if (!state.draft) return state;
  return {
    ...state,
    draft: { ...state.draft, lines: state.draft.lines.map((line) => (line.id === lineId ? change(line) : line)) },
  };
}

function validate(state: BillingState): BillingState {
  const draft = state.draft;
  if (!draft) return note(state, "Aucune pièce à valider.");
  const existing = state.issued.find((item) => item.draftId === draft.id && item.kind === "facture");
  if (existing) return note(state, `${existing.number} est déjà émise. Un second clic ne crée pas une autre facture.`);
  const blocking = anomaliesOf(draft, state.issued, state.taxRate).filter((item) => item.blocking);
  if (!draft.confirmed || blocking.length > 0) {
    return note(state, "Validation refusée : une personne doit confirmer les valeurs, et les écarts doivent être tranchés.");
  }
  const lines = priceLines(draft).slice(0, 24);
  const totals = totalsOf(lines, draft.discountRate, state.taxRate);
  const number = `FAC-2026-${2000 + state.seq}`;
  const next = issue(state, {
    draftId: draft.id,
    kind: "facture",
    number,
    issuedOn: BILLING_DATE,
    clientName: draft.clientName ?? "",
    clientCity: draft.clientCity,
    lines,
    totals,
    dueOn: draft.dueOn,
    terms: draft.terms,
    discountRate: draft.discountRate ?? 0,
    linkedNumber: null,
    channel: "whatsapp",
  });
  return { ...next, draft: null };
}

function credit(state: BillingState, documentId: string): BillingState {
  const invoice = state.issued.find((item) => item.id === documentId && item.kind === "facture");
  if (!invoice) return state;
  if (state.issued.some((item) => item.kind === "avoir" && item.linkedNumber === invoice.number)) {
    return note(state, `Un avoir existe déjà pour ${invoice.number}.`);
  }
  const before = JSON.stringify(invoice);
  const number = `AV-2026-${2000 + state.seq}`;
  const next = issue(state, {
    draftId: null,
    kind: "avoir",
    number,
    issuedOn: BILLING_DATE,
    clientName: invoice.clientName,
    clientCity: invoice.clientCity,
    lines: invoice.lines.map((line) => ({ ...line })),
    totals: { ...invoice.totals },
    dueOn: null,
    terms: `Avoir sur ${invoice.number}`,
    discountRate: invoice.discountRate,
    linkedNumber: invoice.number,
    channel: "whatsapp",
  });
  const unchanged = next.issued.find((item) => item.id === invoice.id);
  if (JSON.stringify(unchanged) !== before) throw new Error("La facture validée a été modifiée.");
  return next;
}
