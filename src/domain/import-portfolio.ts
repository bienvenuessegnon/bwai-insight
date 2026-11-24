import { isIsoDate } from "./dates";
import type {
  Channel,
  Client,
  CreditNote,
  Dispute,
  ImportIssue,
  Installment,
  Invoice,
  Payment,
  PaymentChannel,
  Portfolio,
  Schedule,
} from "./types";

const CHANNELS: Channel[] = ["whatsapp", "sms", "email"];
const PAYMENT_CHANNELS: PaymentChannel[] = ["momo_mtn", "momo_moov", "especes", "virement"];

export type RawPortfolio = {
  clients: Partial<Client>[];
  invoices: Partial<Invoice>[];
  payments: Partial<Payment>[];
  creditNotes: Partial<CreditNote>[];
  schedules: Partial<Schedule>[];
  disputes: Partial<Dispute>[];
};

function issue(
  issues: ImportIssue[],
  code: ImportIssue["code"],
  entity: string,
  id: string,
  message: string,
) {
  issues.push({ code, entity, id, message });
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function importPortfolio(raw: RawPortfolio): { portfolio: Portfolio; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const clients: Client[] = [];
  const seenClients = new Set<string>();

  for (const row of raw.clients) {
    const id = row.id ?? "client-sans-id";
    if (!row.id || !row.name || !row.city || !row.phone || !row.email || !row.channel) {
      issue(issues, "champ_manquant", "client", id, `Client ${id} incomplet : ligne refusée.`);
      continue;
    }
    if (!CHANNELS.includes(row.channel)) {
      issue(issues, "champ_manquant", "client", id, `Canal inconnu pour ${id}.`);
      continue;
    }
    if (seenClients.has(row.id)) {
      issue(issues, "doublon", "client", row.id, `Client ${row.id} déjà présent : doublon ignoré.`);
      continue;
    }
    seenClients.add(row.id);
    clients.push({
      id: row.id,
      name: row.name,
      city: row.city,
      phone: row.phone,
      email: row.email,
      channel: row.channel,
      optOut: Boolean(row.optOut),
      maxPerMonth: positiveInteger(row.maxPerMonth) ? row.maxPerMonth : 3,
    });
  }

  const invoices: Invoice[] = [];
  const seenInvoices = new Set<string>();
  for (const row of raw.invoices) {
    const id = row.id ?? "facture-sans-id";
    if (!row.id || !row.number || !row.label || !row.issuedOn || !row.dueOn || row.amountCfa === undefined) {
      issue(issues, "champ_manquant", "facture", id, `Facture ${id} incomplète : aucun montant inventé.`);
      continue;
    }
    if (!row.clientId || !seenClients.has(row.clientId)) {
      issue(issues, "reference_inconnue", "facture", id, `Facture ${id} sans client connu : ligne refusée.`);
      continue;
    }
    if (!isIsoDate(row.issuedOn) || !isIsoDate(row.dueOn) || !nonNegativeInteger(row.amountCfa)) {
      issue(issues, "montant_invalide", "facture", id, `Facture ${id} : date ou montant illisible.`);
      continue;
    }
    if (seenInvoices.has(row.id)) {
      issue(issues, "doublon", "facture", row.id, `Deuxième ligne ${row.id} ignorée : identifiant déjà présent.`);
      continue;
    }
    seenInvoices.add(row.id);
    invoices.push({
      id: row.id,
      clientId: row.clientId,
      number: row.number,
      label: row.label,
      issuedOn: row.issuedOn,
      dueOn: row.dueOn,
      amountCfa: row.amountCfa,
    });
  }

  const payments: Payment[] = [];
  const seenPayments = new Set<string>();
  for (const row of raw.payments) {
    const id = row.id ?? "paiement-sans-id";
    if (!row.id || !row.invoiceId || !row.paidOn || row.amountCfa === undefined || !row.channel || !row.reference) {
      issue(issues, "champ_manquant", "paiement", id, `Paiement ${id} incomplet : non enregistré.`);
      continue;
    }
    if (!seenInvoices.has(row.invoiceId)) {
      issue(issues, "reference_inconnue", "paiement", id, `Paiement ${id} rattaché à ${row.invoiceId}, facture inconnue : refusé.`);
      continue;
    }
    if (!isIsoDate(row.paidOn) || !positiveInteger(row.amountCfa) || !PAYMENT_CHANNELS.includes(row.channel)) {
      issue(issues, "montant_invalide", "paiement", id, `Paiement ${id} : montant ou date illisible.`);
      continue;
    }
    if (seenPayments.has(row.id)) {
      issue(issues, "doublon", "paiement", row.id, `Paiement ${row.id} en double : ignoré.`);
      continue;
    }
    seenPayments.add(row.id);
    payments.push({
      id: row.id,
      invoiceId: row.invoiceId,
      paidOn: row.paidOn,
      amountCfa: row.amountCfa,
      channel: row.channel,
      reference: row.reference,
    });
  }

  const creditNotes: CreditNote[] = [];
  const seenCredits = new Set<string>();
  for (const row of raw.creditNotes) {
    const id = row.id ?? "avoir-sans-id";
    if (!row.id || !row.invoiceId || !row.issuedOn || row.amountCfa === undefined || !row.reason) {
      issue(issues, "champ_manquant", "avoir", id, `Avoir ${id} incomplet : non enregistré.`);
      continue;
    }
    if (!seenInvoices.has(row.invoiceId)) {
      issue(issues, "reference_inconnue", "avoir", id, `Avoir ${id} sans facture connue : refusé.`);
      continue;
    }
    if (!isIsoDate(row.issuedOn) || !positiveInteger(row.amountCfa)) {
      issue(issues, "montant_invalide", "avoir", id, `Avoir ${id} : montant ou date illisible.`);
      continue;
    }
    if (seenCredits.has(row.id)) {
      issue(issues, "doublon", "avoir", row.id, `Avoir ${row.id} en double : ignoré.`);
      continue;
    }
    seenCredits.add(row.id);
    creditNotes.push({
      id: row.id,
      invoiceId: row.invoiceId,
      issuedOn: row.issuedOn,
      amountCfa: row.amountCfa,
      reason: row.reason,
    });
  }

  const disputes: Dispute[] = [];
  const seenDisputes = new Set<string>();
  for (const row of raw.disputes) {
    const id = row.id ?? "litige-sans-id";
    if (!row.id || !row.invoiceId || !row.openedOn || !row.reason || !row.status) {
      issue(issues, "champ_manquant", "litige", id, `Litige ${id} incomplet : ignoré.`);
      continue;
    }
    if (!seenInvoices.has(row.invoiceId)) {
      issue(issues, "reference_inconnue", "litige", id, `Litige ${id} sans facture connue : refusé.`);
      continue;
    }
    if (!isIsoDate(row.openedOn) || (row.status !== "ouverte" && row.status !== "closee")) {
      issue(issues, "champ_manquant", "litige", id, `Litige ${id} illisible.`);
      continue;
    }
    if (seenDisputes.has(row.id)) {
      issue(issues, "doublon", "litige", row.id, `Litige ${row.id} en double : ignoré.`);
      continue;
    }
    seenDisputes.add(row.id);
    disputes.push({
      id: row.id,
      invoiceId: row.invoiceId,
      openedOn: row.openedOn,
      reason: row.reason,
      status: row.status,
    });
  }

  const schedules: Schedule[] = [];
  const seenSchedules = new Set<string>();
  for (const row of raw.schedules) {
    const id = row.id ?? "echeancier-sans-id";
    if (!row.id || !row.invoiceId || !row.installments?.length) {
      issue(issues, "champ_manquant", "echeancier", id, `Échéancier ${id} incomplet : ignoré.`);
      continue;
    }
    const invoice = invoices.find((item) => item.id === row.invoiceId);
    if (!invoice) {
      issue(issues, "reference_inconnue", "echeancier", id, `Échéancier ${id} sans facture connue : refusé.`);
      continue;
    }
    if (seenSchedules.has(invoice.id)) {
      issue(issues, "doublon", "echeancier", id, `Facture ${invoice.id} a déjà un échéancier.`);
      continue;
    }
    const installments: Installment[] = [];
    let valid = true;
    for (const part of row.installments) {
      if (!part || !isIsoDate(part.dueOn) || !positiveInteger(part.amountCfa)) {
        valid = false;
        break;
      }
      if (part.paidOn !== null && part.paidOn !== undefined && !isIsoDate(part.paidOn)) {
        valid = false;
        break;
      }
      installments.push({
        dueOn: part.dueOn,
        amountCfa: part.amountCfa,
        paidOn: part.paidOn ?? null,
      });
    }
    if (!valid) {
      issue(issues, "montant_invalide", "echeancier", id, `Échéancier ${id} illisible : il ne protège pas la facture.`);
      continue;
    }
    const sum = installments.reduce((total, part) => total + part.amountCfa, 0);
    if (sum !== invoice.amountCfa) {
      issue(
        issues,
        "echeancier_incoherent",
        "echeancier",
        id,
        `Échéancier ${id} : ${sum} F CFA au lieu de ${invoice.amountCfa}. Il est écarté, la facture reste exigible.`,
      );
      continue;
    }
    seenSchedules.add(invoice.id);
    schedules.push({ id: row.id, invoiceId: invoice.id, installments });
  }

  return {
    portfolio: { clients, invoices, payments, creditNotes, schedules, disputes },
    issues,
  };
}
