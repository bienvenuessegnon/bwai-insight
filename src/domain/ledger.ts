import { daysBetween } from "./dates";
import type { Invoice, Portfolio, Position, PrimaryStatus } from "./types";

function sum(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

export function settledOn(portfolio: Portfolio, invoice: Invoice): string | null {
  const events = [
    ...portfolio.payments
      .filter((payment) => payment.invoiceId === invoice.id)
      .map((payment) => ({ on: payment.paidOn, amount: payment.amountCfa })),
    ...portfolio.creditNotes
      .filter((note) => note.invoiceId === invoice.id)
      .map((note) => ({ on: note.issuedOn, amount: note.amountCfa })),
  ].sort((a, b) => a.on.localeCompare(b.on));
  let running = 0;
  for (const event of events) {
    running += event.amount;
    if (running >= invoice.amountCfa) return event.on;
  }
  return null;
}

export function lateRatio(
  portfolio: Portfolio,
  clientId: string,
  referenceDate: string,
  excludeInvoiceId: string,
): number {
  const considered = portfolio.invoices.filter(
    (invoice) =>
      invoice.clientId === clientId &&
      invoice.id !== excludeInvoiceId &&
      invoice.dueOn < referenceDate,
  );
  if (considered.length === 0) return 0;
  let late = 0;
  for (const invoice of considered) {
    const settled = settledOn(portfolio, invoice);
    if (settled === null || settled > invoice.dueOn) late += 1;
  }
  return late / considered.length;
}

export function positionOf(portfolio: Portfolio, invoice: Invoice, referenceDate: string): Position {
  const paidCfa = sum(
    portfolio.payments.filter((payment) => payment.invoiceId === invoice.id).map((payment) => payment.amountCfa),
  );
  const creditCfa = sum(
    portfolio.creditNotes.filter((note) => note.invoiceId === invoice.id).map((note) => note.amountCfa),
  );
  const balanceCfa = invoice.amountCfa - paidCfa - creditCfa;
  const dispute = portfolio.disputes.find(
    (item) => item.invoiceId === invoice.id && item.status === "ouverte",
  );
  const schedule = portfolio.schedules.find((item) => item.invoiceId === invoice.id);
  const scheduleBroken = schedule
    ? schedule.installments.some((part) => part.paidOn === null && part.dueOn <= referenceDate)
    : false;
  const scheduleOnTrack = Boolean(schedule) && !scheduleBroken && balanceCfa > 0;
  const nominalDays = Math.max(0, daysBetween(invoice.dueOn, referenceDate));
  const overdue = invoice.dueOn <= referenceDate;

  let status: PrimaryStatus;
  if (balanceCfa <= 0) status = "soldee";
  else if (dispute) status = "contestee";
  else if (scheduleOnTrack) status = "echeancier";
  else if (paidCfa + creditCfa > 0) status = "partiellement_payee";
  else if (!overdue) status = "non_echue";
  else status = "echue";

  const actionable =
    status === "echue" || (status === "partiellement_payee" && overdue && balanceCfa > 0);

  return {
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    number: invoice.number,
    label: invoice.label,
    amountCfa: invoice.amountCfa,
    paidCfa,
    creditCfa,
    balanceCfa,
    dueOn: invoice.dueOn,
    nominalDays,
    daysOverdue: actionable ? nominalDays : 0,
    status,
    actionable,
    openDisputeId: dispute?.id ?? null,
    scheduleId: scheduleOnTrack ? schedule!.id : schedule?.id ?? null,
  };
}

export function positionsOf(portfolio: Portfolio, referenceDate: string): Position[] {
  return portfolio.invoices.map((invoice) => positionOf(portfolio, invoice, referenceDate));
}
