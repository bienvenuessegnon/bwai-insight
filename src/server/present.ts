import { formatCfa, formatDate } from "@/domain/format";
import { draftMessage, referenceComparison, worklist } from "@/domain/preflight";
import { rankAll } from "@/domain/priority";
import type { AppState, Channel, Decision, Intent, JournalKind, PrimaryStatus } from "@/domain/types";
import type { Dashboard, DossierView, JournalLine } from "@/shared/dashboard";

const STATUS: Record<PrimaryStatus, string> = {
  soldee: "Soldée",
  contestee: "Contestée",
  echeancier: "Échéancier tenu",
  non_echue: "Pas encore due",
  partiellement_payee: "Partiellement payée",
  echue: "En retard",
};

const DECISION: Record<Decision, string> = {
  envoyer: "Relance prête",
  annuler: "Pas de relance",
  revue: "À valider",
  deja_traite: "Déjà traitée",
};

const CHANNEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Courriel",
};

const NEXT: Record<string, string> = {
  solde_nul: "Soldée",
  echeancier: "Échéancier tenu",
  litige: "Litige à trancher",
  pas_echu: "Pas encore due",
  contestation_message: "Contestation",
  paiement_annonce: "Paiement à vérifier",
  incertain: "Réponse à lire",
  promesse: "Promesse reçue",
  delai: "Délai demandé",
  opt_out: "Ne pas contacter",
  suspendu: "Suspendue",
  palier: "Trop tôt",
  deja_traite: "Déjà faite",
  deja_aujourdhui: "Déjà relancée aujourd'hui",
  sequence: "Appel à passer",
  seuil: "Montant à valider",
  plafond: "Plafond du mois atteint",
  une_par_jour: "Un seul message aujourd'hui",
  introuvable: "Introuvable",
};

const READING: Record<Intent, string> = {
  promesse: "Promesse de paiement",
  contestation: "Contestation",
  deja_paye: "Dit avoir payé",
  delai: "Demande un délai",
  incertain: "Réponse pas assez claire",
};

const JOURNAL: Record<JournalKind, string> = {
  import: "Portefeuille",
  relance_envoyee: "Relance",
  relance_annulee: "Pas de relance",
  revue_demandee: "À valider",
  revue_humaine: "Décision",
  paiement: "Règlement",
  message_classe: "Réponse client",
  reprise: "Reprise",
};

const PAYMENT: Record<string, string> = {
  momo_mtn: "Mobile Money MTN",
  momo_moov: "Mobile Money Moov",
  especes: "Espèces",
  virement: "Virement",
};

function plainReason(reasonCode: string, reason: string): string {
  if (reasonCode === "incertain") return "La réponse du client n'est pas assez claire. Une personne la lit avant tout message.";
  if (reasonCode === "sequence") return "Le rappel automatique est épuisé. Une personne doit appeler avant toute suite.";
  return reason;
}

function when(value: string): string {
  return value.replace("T", " ").slice(0, 16);
}

function journalLine(entry: AppState["journal"][number], clients: Map<string, string>): JournalLine {
  const client = entry.clientId ? clients.get(entry.clientId) : null;
  let text = entry.summary;
  if (entry.kind === "message_classe") {
    const intent = entry.detail.intention;
    if (typeof intent === "string" && intent in READING) {
      text = client
        ? `${client} : ${READING[intent as Intent].toLowerCase()}.`
        : READING[intent as Intent];
    }
  }
  return {
    id: entry.id,
    when: when(entry.at),
    title: JOURNAL[entry.kind],
    text,
  };
}

export function present(state: AppState): Dashboard {
  const clients = new Map(state.portfolio.clients.map((client) => [client.id, client.name]));
  const ranks = rankAll(state);
  const items = worklist(state);
  const byInvoice = new Map(items.map((item) => [item.invoiceId, item]));
  const comparison = referenceComparison(state);
  const actionable = ranks.filter((rank) => rank.actionable).sort((a, b) => b.score - a.score || a.number.localeCompare(b.number));
  const order = new Map(actionable.map((rank, index) => [rank.invoiceId, index + 1]));

  const ordered = [...ranks].sort((a, b) => {
    const left = order.get(a.invoiceId);
    const right = order.get(b.invoiceId);
    if (left && right) return left - right;
    if (left) return -1;
    if (right) return 1;
    return a.number.localeCompare(b.number);
  });

  const rows = ordered.map((rank) => {
    const item = byInvoice.get(rank.invoiceId);
    return {
      id: rank.invoiceId,
      number: rank.number,
      label: rank.label,
      clientName: clients.get(rank.clientId) ?? rank.clientId,
      dueLabel: formatDate(rank.dueOn),
      daysOverdue: rank.daysOverdue,
      balanceLabel: formatCfa(rank.balanceCfa),
      status: rank.status,
      statusLabel: STATUS[rank.status],
      order: order.get(rank.invoiceId) ?? null,
      decision: item?.decision ?? "annuler",
      nextStep: item ? (NEXT[item.reasonCode] ?? DECISION[item.decision]) : "—",
    };
  });

  const readyIds = new Set(
    items.filter((item) => item.decision === "envoyer" && item.message).map((item) => item.invoiceId),
  );
  const letters = [
    ...items
      .filter((item) => item.decision === "envoyer" && item.message)
      .map((item) => {
        const rank = ranks.find((entry) => entry.invoiceId === item.invoiceId);
        return {
          id: `prete-${item.invoiceId}`,
          invoiceId: item.invoiceId,
          number: rank?.number ?? item.invoiceId,
          clientName: clients.get(item.clientId) ?? item.clientId,
          channelLabel: item.channel ? CHANNEL[item.channel] : "Canal du client",
          balanceLabel: formatCfa(rank?.balanceCfa ?? 0),
          stateLabel: state.settings.offline ? "En attente dans l'appareil" : "Prête",
          message: item.message ?? "",
        };
      }),
    ...state.outbox
      .filter((item) => item.message && !readyIds.has(item.invoiceId))
      .map((item) => {
        const rank = ranks.find((entry) => entry.invoiceId === item.invoiceId);
        return {
          id: `file-${item.idempotencyKey}`,
          invoiceId: item.invoiceId,
          number: rank?.number ?? item.invoiceId,
          clientName: clients.get(item.clientId) ?? item.clientId,
          channelLabel: item.channel ? CHANNEL[item.channel] : "Canal du client",
          balanceLabel: formatCfa(rank?.balanceCfa ?? 0),
          stateLabel: "En attente dans l'appareil",
          message: item.message ?? "",
        };
      }),
    ...state.journal
      .filter((entry) => entry.kind === "relance_envoyee" && entry.invoiceId)
      .map((entry) => {
        const current = byInvoice.get(entry.invoiceId ?? "");
        if (current && current.decision !== "deja_traite" && current.decision !== "envoyer") return null;
        const invoice = state.portfolio.invoices.find((item) => item.id === entry.invoiceId);
        const client = invoice ? state.portfolio.clients.find((item) => item.id === invoice.clientId) : undefined;
        const rank = ranks.find((item) => item.invoiceId === entry.invoiceId);
        const stepNumber = Number(entry.detail.etape);
        const step = state.settings.steps.find((item) => item.step === stepNumber);
        if (!invoice || !client || !step || !rank) return null;
        return {
          id: entry.id,
          invoiceId: invoice.id,
          number: invoice.number,
          clientName: client.name,
          channelLabel: typeof entry.detail.canal === "string" && entry.detail.canal in CHANNEL ? CHANNEL[entry.detail.canal as Channel] : CHANNEL[client.channel],
          balanceLabel: formatCfa(rank.balanceCfa),
          stateLabel: "Envoyée",
          message: draftMessage(client, invoice, rank.balanceCfa, step),
        };
      })
      .filter((letter) => letter !== null),
  ];

  const reviews = items
    .filter((item) => item.decision === "revue")
    .map((item) => {
      const rank = ranks.find((entry) => entry.invoiceId === item.invoiceId);
      const dispute = state.portfolio.disputes.some(
        (entry) => entry.invoiceId === item.invoiceId && entry.status === "ouverte",
      );
      return {
        id: item.invoiceId,
        number: rank?.number ?? item.invoiceId,
        clientName: clients.get(item.clientId) ?? item.clientId,
        balanceLabel: formatCfa(rank?.balanceCfa ?? 0),
        reason: plainReason(item.reasonCode, item.reason),
        canApprove: item.reasonCode === "seuil" || item.reasonCode === "sequence",
        canCloseDispute: dispute,
        message: item.message,
      };
    });

  const dossiers: DossierView[] = ranks.map((rank) => {
    const client = state.portfolio.clients.find((item) => item.id === rank.clientId);
    const item = byInvoice.get(rank.invoiceId);
    const place = order.get(rank.invoiceId) ?? null;
    const payments = state.portfolio.payments.filter((entry) => entry.invoiceId === rank.invoiceId);
    const credits = state.portfolio.creditNotes.filter((entry) => entry.invoiceId === rank.invoiceId);
    const schedule = state.portfolio.schedules.find((entry) => entry.invoiceId === rank.invoiceId);
    const dispute = state.portfolio.disputes.find((entry) => entry.invoiceId === rank.invoiceId);
    return {
      id: rank.invoiceId,
      number: rank.number,
      label: rank.label,
      clientName: client?.name ?? rank.clientId,
      city: client?.city ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      channelLabel: client ? CHANNEL[client.channel] : "",
      amountLabel: formatCfa(rank.amountCfa),
      paidLabel: formatCfa(rank.paidCfa),
      creditLabel: formatCfa(rank.creditCfa),
      balanceLabel: formatCfa(rank.balanceCfa),
      balanceCfa: rank.balanceCfa,
      dueLabel: formatDate(rank.dueOn),
      statusLabel: STATUS[rank.status],
      formula: `Solde = ${formatCfa(rank.amountCfa)} − ${formatCfa(rank.paidCfa)} − ${formatCfa(rank.creditCfa)} = ${formatCfa(rank.balanceCfa)}`,
      orderLabel: place === null ? null : place === 1 ? "1er dossier à traiter aujourd'hui" : `${place}e dossier à traiter aujourd'hui`,
      decisionLabel: item ? DECISION[item.decision] : "Pas de relance",
      reason: item ? plainReason(item.reasonCode, item.reason) : "Pièce introuvable.",
      message: item?.message ?? null,
      canPay: rank.balanceCfa > 0,
      canApprove: item?.reasonCode === "seuil" || item?.reasonCode === "sequence",
      canCloseDispute: dispute?.status === "ouverte",
      payments: payments.map(
        (payment) =>
          `${formatDate(payment.paidOn)} · ${formatCfa(payment.amountCfa)} · ${PAYMENT[payment.channel] ?? payment.channel} · ${payment.reference}`,
      ),
      credits: credits.map((note) => `${formatDate(note.issuedOn)} · ${formatCfa(note.amountCfa)} · ${note.reason}`),
      schedule: schedule
        ? schedule.installments.map(
            (part) =>
              `${formatDate(part.dueOn)} · ${formatCfa(part.amountCfa)} · ${part.paidOn ? `réglée le ${formatDate(part.paidOn)}` : "ouverte"}`,
          )
        : [],
      dispute: dispute
        ? `${dispute.status === "ouverte" ? "Litige ouvert" : "Litige clos"} · ${dispute.reason}`
        : null,
      replies: state.messages
        .filter((message) => message.invoiceId === rank.invoiceId)
        .map((message) => ({
          when: formatDate(message.receivedOn),
          text: message.text,
          reading: message.classification ? READING[message.classification.intent] : null,
        })),
      events: state.journal
        .filter((entry) => entry.invoiceId === rank.invoiceId)
        .map((entry) => journalLine(entry, clients))
        .reverse()
        .map((entry) => ({ when: entry.when, text: entry.text })),
      checks: (item?.checks ?? []).map((check) => ({
        label:
          check.code === "message_incertain"
            ? "La dernière réponse du client est claire"
            : check.label.replaceAll("lexique", "lecture").replaceAll("Lexique", "Lecture"),
        state: check.state,
      })),
    };
  });

  const encours = ranks.reduce((sum, rank) => sum + Math.max(rank.balanceCfa, 0), 0);
  const retard = actionable.reduce((sum, rank) => sum + Math.max(rank.balanceCfa, 0), 0);
  const reglements = state.portfolio.payments.reduce((sum, payment) => sum + payment.amountCfa, 0);
  const suspendues =
    state.suppressions.filter((item) => item.until >= state.settings.referenceDate).length + state.outbox.length;

  return {
    asOfLabel: formatDate(state.settings.referenceDate),
    company: "Maison Adjovi & Fils",
    city: "Cotonou",
    encoursLabel: formatCfa(encours),
    encoursCfa: encours,
    retardLabel: formatCfa(retard),
    retardCount: actionable.length,
    aValider: reviews.length,
    suspendues,
    reglementsLabel: formatCfa(reglements),
    reglementsCount: state.portfolio.payments.length,
    relancesPretes: letters.length,
    relancesParties: state.journal.filter((entry) => entry.kind === "relance_envoyee").length,
    erreursEvitees: comparison.naiveErrors.length,
    referenceCount: comparison.referenceCount,
    offline: state.settings.offline,
    fileLocale: state.outbox.length,
    seuilLabel: formatCfa(state.settings.thresholdCfa),
    thresholdCfa: state.settings.thresholdCfa,
    channelMode: state.settings.channelMode,
    rows,
    letters,
    reviews,
    journal: [...state.journal].reverse().map((entry) => journalLine(entry, clients)),
    dossiers,
    refused: state.issues.map((issue) => issue.message),
  };
}
