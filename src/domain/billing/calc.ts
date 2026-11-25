import { ARTICLES } from "./catalog";
import { formatCfa } from "../format";
import type { Anomaly, Draft, IssuedDocument, MoneyLine, Totals } from "./types";

export function roundCfa(value: number): number {
  return Math.round(value);
}

export function billQty(line: Draft["lines"][number], billDelivered: boolean): number | null {
  if (billDelivered && line.deliveredQty !== null) return line.deliveredQty;
  return line.qty;
}

export function priceLines(draft: Draft): MoneyLine[] {
  return draft.lines.flatMap((line) => {
    const qty = billQty(line, draft.billDeliveredQty);
    if (qty === null || line.unitPriceCfa === null) return [];
    return [
      {
        designation: line.designation,
        qty,
        unitPriceCfa: line.unitPriceCfa,
        lineCfa: qty * line.unitPriceCfa,
      },
    ];
  });
}

export function totalsOf(lines: MoneyLine[], discountRate: number | null, taxRate: number): Totals {
  const subtotalCfa = lines.reduce((sum, line) => sum + line.lineCfa, 0);
  const rate = discountRate ?? 0;
  const discountCfa = roundCfa((subtotalCfa * rate) / 100);
  const baseCfa = subtotalCfa - discountCfa;
  const taxCfa = roundCfa((baseCfa * taxRate) / 100);
  return { subtotalCfa, discountCfa, baseCfa, taxRate, taxCfa, totalCfa: baseCfa + taxCfa };
}

export function draftFingerprint(draft: Draft): string {
  const lines = priceLines(draft)
    .map((line) => `${line.designation}:${line.qty}:${line.unitPriceCfa}`)
    .join("|");
  return `${draft.clientName ?? ""}#${lines}#${draft.discountRate ?? 0}`;
}

export function issuedFingerprint(item: IssuedDocument): string {
  const lines = item.lines.map((line) => `${line.designation}:${line.qty}:${line.unitPriceCfa}`).join("|");
  return `${item.clientName}#${lines}#${item.discountRate}`;
}

export function anomaliesOf(draft: Draft, issued: IssuedDocument[], taxRate: number): Anomaly[] {
  const found: Anomaly[] = [];
  if (!draft.clientName) {
    found.push({ code: "client_absent", blocking: true, message: "Le message ne nomme pas le client. Le nom n'a pas été inventé." });
  } else if (!draft.clientId && !draft.acceptUnknownClient) {
    found.push({
      code: "client_inconnu",
      blocking: true,
      message: `${draft.clientName} n'est pas dans le référentiel. Confirmez le nom, sans adresse inventée.`,
    });
  }
  if (draft.lines.length === 0) {
    found.push({ code: "aucune_ligne", blocking: true, message: "Aucune ligne reconnue dans le message." });
  }
  for (const line of draft.lines) {
    if (line.qty === null) {
      found.push({ code: "quantite_absente", blocking: true, message: `Quantité absente pour ${line.designation}.` });
    }
    if (line.unitPriceCfa === null) {
      found.push({
        code: "prix_absent",
        blocking: true,
        message: `Prix absent pour ${line.designation}. Le tarif du catalogue n'est pas recopié à sa place.`,
      });
    } else if (!draft.acceptUnusualPrice) {
      const article = ARTICLES.find((item) => item.id === line.articleId);
      if (article && Math.abs(line.unitPriceCfa - article.priceCfa) / article.priceCfa > 0.15) {
        found.push({
          code: "prix_inhabituel",
          blocking: true,
          message: `${line.designation} : ${formatCfa(line.unitPriceCfa)} au lieu de ${formatCfa(article.priceCfa)} au catalogue.`,
        });
      }
    }
    if (line.deliveredQty !== null && line.qty !== null && line.deliveredQty !== line.qty && !draft.billDeliveredQty) {
      found.push({
        code: "livraison_ecart",
        blocking: true,
        message: `${line.designation} : ${line.qty} commandés, ${line.deliveredQty} livrés. Choisissez la quantité à facturer.`,
      });
    }
  }
  if (!draft.dueOn) {
    found.push({ code: "echeance_absente", blocking: true, message: "L'échéance n'est pas écrite. Elle n'a pas été supposée." });
  }
  const lines = priceLines(draft);
  if (lines.length === draft.lines.length && draft.announcedTotalCfa !== null && !draft.acceptAnnouncedGap) {
    const totals = totalsOf(lines, draft.discountRate, taxRate);
    if (totals.totalCfa !== draft.announcedTotalCfa) {
      found.push({
        code: "total_divergent",
        blocking: true,
        message: `Le message annonce ${formatCfa(draft.announcedTotalCfa)}. Le recalcul donne ${formatCfa(totals.totalCfa)}.`,
      });
    }
  }
  if (issued.some((item) => item.kind === "facture" && item.draftId !== draft.id && draftFingerprint(draft) === issuedFingerprint(item))) {
    found.push({ code: "doublon", blocking: true, message: "Une facture déjà émise porte les mêmes lignes pour ce client." });
  }
  return found;
}
