import { formatCfa, formatDate } from "./format";
import { positionOf } from "./ledger";
import type {
  AppState,
  Channel,
  Check,
  Client,
  Decision,
  Invoice,
  ReminderStep,
  WorkItem,
} from "./types";

type Gate = {
  code: string;
  label: string;
  pass: boolean;
  decision: Decision;
  reasonCode: string;
  reason: string;
};

const TONE: Record<ReminderStep["tone"], string> = {
  courtois: "Nous nous permettons un premier rappel.",
  rappel: "Nous revenons vers vous, le solde étant toujours ouvert.",
  ferme: "Sans nouvelle, le dossier sera remis à une personne de l'équipe. Aucune pénalité n'est appliquée par ce message.",
  passage: "Ce texte est un projet pour validation humaine. Il n'a pas été envoyé automatiquement.",
};

export function draftMessage(
  client: Client,
  invoice: Invoice,
  balanceCfa: number,
  step: ReminderStep,
): string {
  const reference = `FICTIF-MOMO-${invoice.number}`;
  return [
    `Bonjour ${client.name},`,
    TONE[step.tone],
    `Sauf erreur de notre part, la facture ${invoice.number} (${invoice.label}), échue le ${formatDate(invoice.dueOn)}, présente un solde de ${formatCfa(balanceCfa)}.`,
    `Référence Mobile Money de démonstration, fictive, sans compte réel : ${reference}.`,
    "Si le paiement est déjà parti ou si un point est à clarifier, répondez avant toute nouvelle relance.",
    "— Maison Adjovi & Fils, Cotonou",
  ].join("\n");
}

function channelFor(state: AppState, client: Client): Channel {
  return state.settings.channelMode === "preference" ? client.channel : state.settings.channelMode;
}

function stepKey(invoiceId: string, step: number): string {
  return `${invoiceId}:etape:${step}`;
}

function alreadySent(state: AppState, key: string): boolean {
  return state.journal.some((entry) => entry.idempotencyKey === key && entry.kind === "relance_envoyee");
}

function inOutbox(state: AppState, key: string): boolean {
  return state.outbox.some((item) => item.idempotencyKey === key);
}

function remindersThisMonth(state: AppState, clientId: string): number {
  const month = state.settings.referenceDate.slice(0, 7);
  const sent = state.journal.filter(
    (entry) =>
      entry.kind === "relance_envoyee" &&
      entry.clientId === clientId &&
      entry.at.slice(0, 7) === month,
  ).length;
  const queued = state.outbox.filter((item) => item.clientId === clientId).length;
  return sent + queued;
}

function sentTodayForInvoice(state: AppState, invoiceId: string): boolean {
  const day = state.settings.referenceDate;
  return state.journal.some(
    (entry) =>
      entry.kind === "relance_envoyee" &&
      entry.invoiceId === invoiceId &&
      entry.at.slice(0, 10) === day,
  );
}

function busyWithAnotherInvoice(state: AppState, clientId: string, invoiceId: string): boolean {
  const day = state.settings.referenceDate;
  const sentToday = state.journal.some(
    (entry) =>
      entry.kind === "relance_envoyee" &&
      entry.clientId === clientId &&
      entry.invoiceId !== invoiceId &&
      entry.at.slice(0, 10) === day,
  );
  const queued = state.outbox.some((item) => item.clientId === clientId && item.invoiceId !== invoiceId);
  return sentToday || queued;
}

function latestMessage(state: AppState, invoiceId: string) {
  return state.messages
    .filter((message) => message.invoiceId === invoiceId && message.classification)
    .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn))[0];
}

function emptyItem(invoiceId: string, clientId: string, decision: Decision, reasonCode: string, reason: string): WorkItem {
  return {
    invoiceId,
    clientId,
    idempotencyKey: `${invoiceId}:${decision}:${reasonCode}`,
    step: null,
    decision,
    reasonCode,
    reason,
    channel: null,
    message: null,
    checks: [{ code: reasonCode, label: reason, state: "stop" }],
  };
}

export function decide(state: AppState, invoiceId: string): WorkItem {
  const invoice = state.portfolio.invoices.find((item) => item.id === invoiceId);
  const client = invoice ? state.portfolio.clients.find((item) => item.id === invoice.clientId) : undefined;
  if (!invoice || !client) {
    return emptyItem(invoiceId, invoice?.clientId ?? "", "annuler", "introuvable", "Pièce introuvable dans le portefeuille.");
  }

  const position = positionOf(state.portfolio, invoice, state.settings.referenceDate);
  const message = latestMessage(state, invoice.id);
  const intent = message?.classification?.intent ?? null;
  const dueSteps = state.settings.steps.filter((step) => position.daysOverdue >= step.minDays);
  const pending = dueSteps.find((step) => !alreadySent(state, stepKey(invoice.id, step.step))) ?? null;
  const approved = pending
    ? state.approvals.some((approval) => approval.invoiceId === invoice.id && approval.step === pending.step)
    : false;
  const suppressed = state.suppressions.some(
    (item) => item.invoiceId === invoice.id && item.until >= state.settings.referenceDate,
  );
  const key = pending ? stepKey(invoice.id, pending.step) : `${invoice.id}:aucun-palier`;

  const gates: Gate[] = [
    {
      code: "solde",
      label: `Solde recalculé : ${formatCfa(position.balanceCfa)}`,
      pass: position.balanceCfa > 0,
      decision: "annuler",
      reasonCode: "solde_nul",
      reason: position.balanceCfa < 0 ? "Trop-perçu : aucune relance." : "Solde nul : la facture est soldée.",
    },
    {
      code: "echeancier",
      label: "Aucun échéancier en cours ne couvre le solde",
      pass: position.status !== "echeancier",
      decision: "annuler",
      reasonCode: "echeancier",
      reason: "Échéancier respecté : on n'ajoute pas une relance.",
    },
    {
      code: "litige",
      label: "Aucun litige ouvert",
      pass: position.status !== "contestee",
      decision: "revue",
      reasonCode: "litige",
      reason: "Litige ouvert : une personne tranche avant toute suite.",
    },
    {
      code: "echeance",
      label: "Échéance dépassée",
      pass: position.actionable,
      decision: "annuler",
      reasonCode: "pas_echu",
      reason: "Échéance non atteinte : rien n'est envoyé.",
    },
    {
      code: "message_contestation",
      label: "Le dernier message n'est pas une contestation",
      pass: intent !== "contestation",
      decision: "revue",
      reasonCode: "contestation_message",
      reason: "Le client conteste : revue humaine, sans relance.",
    },
    {
      code: "message_paiement",
      label: "Pas d'annonce de paiement encore absente du livre",
      pass: !(intent === "deja_paye" && position.balanceCfa > 0),
      decision: "revue",
      reasonCode: "paiement_annonce",
      reason: "Le client dit avoir payé, le solde est encore ouvert : on vérifie avant d'écrire.",
    },
    {
      code: "message_incertain",
      label: "Le dernier message classé est assez clair",
      pass: intent !== "incertain",
      decision: "revue",
      reasonCode: "incertain",
      reason: "Message ambigu : le lexique ne tranche pas, une personne lit.",
    },
    {
      code: "promesse",
      label: "Pas de promesse de paiement en cours",
      pass: intent !== "promesse",
      decision: "annuler",
      reasonCode: "promesse",
      reason: "Promesse enregistrée : pas de nouvelle sollicitation aujourd'hui.",
    },
    {
      code: "delai",
      label: "Pas de demande de délai en cours",
      pass: intent !== "delai",
      decision: "annuler",
      reasonCode: "delai",
      reason: "Délai demandé : on suspend la relance automatique.",
    },
    {
      code: "preference",
      label: "Le client accepte d'être contacté",
      pass: !client.optOut,
      decision: "annuler",
      reasonCode: "opt_out",
      reason: "Préférence du client : ne pas relancer.",
    },
    {
      code: "suspension",
      label: "Pas de suspension décidée par l'équipe",
      pass: !suppressed,
      decision: "annuler",
      reasonCode: "suspendu",
      reason: "Suspension humaine encore active.",
    },
    {
      code: "palier",
      label: pending ? `Palier ${pending.step} dû` : "Aucun palier de relance dû",
      pass: pending !== null || dueSteps.some((step) => alreadySent(state, stepKey(invoice.id, step.step))),
      decision: "annuler",
      reasonCode: "palier",
      reason: "Le prochain palier n'est pas encore atteint.",
    },
    {
      code: "deja",
      label: "Il reste un palier à traiter",
      pass: pending !== null,
      decision: "deja_traite",
      reasonCode: "deja_traite",
      reason: "Les paliers dus sont déjà partis.",
    },
    {
      code: "rythme",
      label: "Pas déjà une relance aujourd'hui pour cette facture",
      pass: !sentTodayForInvoice(state, invoice.id),
      decision: "deja_traite",
      reasonCode: "deja_aujourdhui",
      reason: "Une relance est déjà partie aujourd'hui : le palier suivant attendra.",
    },
    {
      code: "doublon",
      label: "Cette étape n'est ni envoyée ni déjà dans la file",
      pass: pending ? !inOutbox(state, key) && !alreadySent(state, key) : true,
      decision: "deja_traite",
      reasonCode: "deja_traite",
      reason: "Déjà traité : la reprise ne crée pas une seconde action.",
    },
    {
      code: "sequence",
      label: "Le palier peut partir sans validation, ou il a été approuvé",
      pass: pending ? pending.auto || approved : true,
      decision: "revue",
      reasonCode: "sequence",
      reason: "Séquence automatique épuisée : le passage à une personne est obligatoire.",
    },
    {
      code: "seuil",
      label: `Solde sous le seuil de ${formatCfa(state.settings.thresholdCfa)}, ou approuvé`,
      pass: position.balanceCfa < state.settings.thresholdCfa || approved,
      decision: "revue",
      reasonCode: "seuil",
      reason: `Montant au-dessus du seuil (${formatCfa(state.settings.thresholdCfa)}) : validation humaine.`,
    },
    {
      code: "plafond",
      label: `Moins de ${client.maxPerMonth} relances ce mois-ci (${remindersThisMonth(state, client.id)})`,
      pass: approved || remindersThisMonth(state, client.id) < client.maxPerMonth,
      decision: "annuler",
      reasonCode: "plafond",
      reason: "Plafond mensuel de sollicitations atteint.",
    },
    {
      code: "une_par_jour",
      label: "Pas d'autre relance automatique pour ce client aujourd'hui",
      pass: approved || !busyWithAnotherInvoice(state, client.id, invoice.id),
      decision: "annuler",
      reasonCode: "une_par_jour",
      reason: "Une seule relance automatique par client et par jour.",
    },
  ];

  const checks: Check[] = [];
  let failed: Gate | null = null;
  for (const gate of gates) {
    if (failed) {
      checks.push({ code: gate.code, label: gate.label, state: "skip" });
      continue;
    }
    if (!gate.pass) {
      failed = gate;
      checks.push({ code: gate.code, label: gate.label, state: "stop" });
    } else {
      checks.push({ code: gate.code, label: gate.label, state: "ok" });
    }
  }

  const decision = failed?.decision ?? "envoyer";
  const reasonCode = failed?.reasonCode ?? "pre_vol";
  const reason = failed?.reason ?? "Pré-vol tenu : solde, statut, préférence et palier sont encore vrais.";
  const channel = channelFor(state, client);
  const draft =
    pending && (decision === "envoyer" || decision === "revue" || decision === "deja_traite")
      ? draftMessage(client, invoice, position.balanceCfa, pending)
      : null;

  return {
    invoiceId: invoice.id,
    clientId: client.id,
    idempotencyKey: decision === "envoyer" || decision === "deja_traite" ? key : `${invoice.id}:${decision}:${reasonCode}`,
    step: pending?.step ?? null,
    decision,
    reasonCode,
    reason,
    channel,
    message: draft,
    checks,
  };
}

export function worklist(state: AppState): WorkItem[] {
  return [...state.portfolio.invoices]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((invoice) => decide(state, invoice.id));
}

export function referenceComparison(state: AppState) {
  const items = worklist(state);
  const byId = new Map(items.map((item) => [item.invoiceId, item]));
  const reference = state.portfolio.invoices.filter((invoice) => invoice.dueOn <= state.settings.referenceDate);
  const wrong = reference.filter((invoice) => {
    const position = positionOf(state.portfolio, invoice, state.settings.referenceDate);
    return position.status === "soldee" || position.status === "contestee" || position.status === "echeancier";
  });
  return {
    referenceCount: reference.length,
    ourSendCount: items.filter((item) => item.decision === "envoyer").length,
    reviewCount: items.filter((item) => item.decision === "revue").length,
    naiveErrors: wrong.map((invoice) => ({
      invoiceId: invoice.id,
      number: invoice.number,
      status: positionOf(state.portfolio, invoice, state.settings.referenceDate).status,
      ourDecision: byId.get(invoice.id)?.decision ?? "annuler",
    })),
  };
}
