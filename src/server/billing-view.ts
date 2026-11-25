import QRCode from "qrcode";
import { anomaliesOf, priceLines, totalsOf } from "@/domain/billing/calc";
import { formatCfa, formatDate } from "@/domain/format";
import type { BillingState } from "@/domain/billing/types";
import type { BillingView, Sheet } from "@/shared/invoice";

const CONFIDENCE = { sur: "Sûr", a_relire: "À relire", absent: "Absent" } as const;

function sheetOf(state: BillingState): Sheet | null {
  const draft = state.draft;
  if (!draft) return null;
  const lines = priceLines(draft);
  const totals = totalsOf(lines, draft.discountRate, state.taxRate);
  const anomalies = anomaliesOf(draft, state.issued, state.taxRate);
  const complete = draft.lines.every((line) => line.qty !== null && line.unitPriceCfa !== null);
  return {
    sourceLabel: draft.sourceLabel,
    sourceText: draft.sourceText,
    clientName: draft.clientName,
    clientCity: draft.clientCity,
    clientNote: draft.clientSource.confidence === "absent" ? "Absent du message" : `${CONFIDENCE[draft.clientSource.confidence]} · ${draft.clientSource.label}`,
    lines: draft.lines.map((line) => ({
      id: line.id,
      designation: line.designation,
      qty: line.qty,
      deliveredQty: line.deliveredQty,
      unitPriceCfa: line.unitPriceCfa,
      unitLabel: line.unitPriceCfa === null ? "Prix non écrit" : formatCfa(line.unitPriceCfa),
      lineLabel: line.qty !== null && line.unitPriceCfa !== null ? formatCfa(line.qty * line.unitPriceCfa) : "—",
      source: line.source.excerpt ?? line.source.label,
      confidence: CONFIDENCE[line.source.confidence],
    })),
    discountLabel: draft.discountRate === null ? "Aucune remise écrite" : `${draft.discountRate} %`,
    announcedLabel: draft.announcedTotalCfa === null ? null : formatCfa(draft.announcedTotalCfa),
    dueLabel: draft.dueOn ? formatDate(draft.dueOn) : null,
    dueOn: draft.dueOn,
    terms: draft.terms,
    subtotalLabel: formatCfa(totals.subtotalCfa),
    discountAmountLabel: formatCfa(totals.discountCfa),
    baseLabel: formatCfa(totals.baseCfa),
    taxLabel: formatCfa(totals.taxCfa),
    totalLabel: formatCfa(totals.totalCfa),
    totalCfa: complete ? totals.totalCfa : 0,
    anomalies,
    confirmed: draft.confirmed,
    canValidate: draft.confirmed && complete && anomalies.every((item) => !item.blocking),
  };
}

export async function presentBilling(state: BillingState, origin: string): Promise<BillingView> {
  const issued = await Promise.all(
    [...state.issued].reverse().map(async (item) => {
      const url = `${origin}/verifier?sceau=${encodeURIComponent(item.sceau)}`;
      return {
        id: item.id,
        kind: item.kind,
        number: item.number,
        clientName: item.clientName,
        clientCity: item.clientCity,
        totalLabel: formatCfa(item.totals.totalCfa),
        totalCfa: item.totals.totalCfa,
        dueLabel: item.dueOn ? formatDate(item.dueOn) : null,
        terms: item.terms,
        lines: item.lines.map((line) => ({
          designation: line.designation,
          qty: line.qty,
          unitLabel: formatCfa(line.unitPriceCfa),
          lineLabel: formatCfa(line.lineCfa),
        })),
        subtotalLabel: formatCfa(item.totals.subtotalCfa),
        discountAmountLabel: formatCfa(item.totals.discountCfa),
        baseLabel: formatCfa(item.totals.baseCfa),
        taxLabel: formatCfa(item.totals.taxCfa),
        sceau: item.sceau,
        qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 180, color: { dark: "#1a2744", light: "#fffaf3" } }),
        linkedNumber: item.linkedNumber,
        issuedOnLabel: formatDate(item.issuedOn),
      };
    }),
  );
  return { taxRate: state.taxRate, sheet: sheetOf(state), issued, journal: [...state.journal].reverse() };
}
