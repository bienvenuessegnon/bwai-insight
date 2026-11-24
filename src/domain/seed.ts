import { importPortfolio, type RawPortfolio } from "./import-portfolio";
import type { AppState, InboundMessage } from "./types";
import {
  DEFAULT_STEPS,
  DEFAULT_THRESHOLD_CFA,
  DEFAULT_WEIGHTS,
  REFERENCE_DATE,
  STATE_VERSION,
} from "./types";

const client = (
  id: string,
  name: string,
  city: string,
  channel: "whatsapp" | "sms" | "email",
) => ({
  id,
  name,
  city,
  phone: "+229 01 00 00 00 00",
  email: `${id}@adjovi.example`,
  channel,
  optOut: false,
  maxPerMonth: 3,
});

export const RAW_PORTFOLIO: RawPortfolio = {
  clients: [
    client("cli-hotel", "Hôtel du Port", "Cotonou", "whatsapp"),
    client("cli-sena", "Atelier Sèna Couture", "Porto-Novo", "sms"),
    client("cli-pharma", "Pharmacie Akpakpa", "Cotonou", "whatsapp"),
    client("cli-ecole", "École Les Palmiers", "Abomey-Calavi", "email"),
    client("cli-garage", "Garage Tokpa", "Cotonou", "whatsapp"),
    client("cli-coop", "Coopérative des maraîchers de Ouidah", "Ouidah", "sms"),
    client("cli-adjoua", "Boutique Adjoua", "Abomey-Calavi", "whatsapp"),
    client("cli-froid", "Société Béninoise de Froid", "Cotonou", "email"),
  ],
  invoices: [
    { id: "fac-1001", clientId: "cli-adjoua", number: "FAC-2026-1001", label: "Tissus wax, lot de juin", issuedOn: "2026-05-20", dueOn: "2026-06-01", amountCfa: 20_000 },
    { id: "fac-1002", clientId: "cli-adjoua", number: "FAC-2026-1002", label: "Fil et boutons", issuedOn: "2026-06-15", dueOn: "2026-07-01", amountCfa: 18_000 },
    { id: "fac-1042", clientId: "cli-hotel", number: "FAC-2026-1042", label: "Linge de table, commande d'octobre", issuedOn: "2026-09-02", dueOn: "2026-10-02", amountCfa: 180_000 },
    { id: "fac-1088", clientId: "cli-hotel", number: "FAC-2026-1088", label: "Ampoules et douilles", issuedOn: "2026-06-20", dueOn: "2026-07-15", amountCfa: 150_000 },
    { id: "fac-1090", clientId: "cli-sena", number: "FAC-2026-1090", label: "Machine à coudre d'atelier", issuedOn: "2026-07-10", dueOn: "2026-08-01", amountCfa: 60_000 },
    { id: "fac-1108", clientId: "cli-sena", number: "FAC-2026-1108", label: "Tissus de saison", issuedOn: "2026-10-01", dueOn: "2026-10-20", amountCfa: 95_000 },
    { id: "fac-1114", clientId: "cli-pharma", number: "FAC-2026-1114", label: "Rayonnages et présentoirs", issuedOn: "2026-10-28", dueOn: "2026-11-12", amountCfa: 240_000 },
    { id: "fac-1120", clientId: "cli-ecole", number: "FAC-2026-1120", label: "Mobilier de deux salles de classe", issuedOn: "2026-09-15", dueOn: "2026-10-15", amountCfa: 850_000 },
    { id: "fac-1122", clientId: "cli-garage", number: "FAC-2026-1122", label: "Pièces de freinage", issuedOn: "2026-10-20", dueOn: "2026-11-01", amountCfa: 76_000 },
    { id: "fac-1130", clientId: "cli-coop", number: "FAC-2026-1130", label: "Bâches et outils de récolte", issuedOn: "2026-09-01", dueOn: "2026-09-30", amountCfa: 300_000 },
    { id: "fac-1133", clientId: "cli-adjoua", number: "FAC-2026-1133", label: "Pagnes, commande de novembre", issuedOn: "2026-11-05", dueOn: "2026-11-20", amountCfa: 45_000 },
    { id: "fac-1138", clientId: "cli-froid", number: "FAC-2026-1138", label: "Groupe froid, acompte à venir", issuedOn: "2026-11-10", dueOn: "2026-11-28", amountCfa: 420_000 },
    { id: "fac-1140", clientId: "cli-pharma", number: "FAC-2026-1140", label: "Retour de présentoirs abîmés", issuedOn: "2026-10-20", dueOn: "2026-11-05", amountCfa: 80_000 },
    { id: "fac-1144", clientId: "cli-adjoua", number: "FAC-2026-1144", label: "Mercerie, reste de septembre", issuedOn: "2026-08-20", dueOn: "2026-09-01", amountCfa: 22_000 },
    { id: "fac-1150", clientId: "cli-pharma", number: "FAC-2026-1150", label: "Étagères de réserve", issuedOn: "2026-11-01", dueOn: "2026-11-17", amountCfa: 125_000 },
    { id: "fac-1155", clientId: "cli-ecole", number: "FAC-2026-1155", label: "Peinture de la cantine", issuedOn: "2026-11-08", dueOn: "2026-11-22", amountCfa: 38_000 },
    { id: "fac-1160", clientId: "cli-hotel", number: "FAC-2026-1160", label: "Vaisselle de décembre", issuedOn: "2026-11-12", dueOn: "2026-12-05", amountCfa: 200_000 },
    { id: "fac-1150", clientId: "cli-pharma", number: "FAC-2026-1150", label: "Doublon Excel", issuedOn: "2026-11-01", dueOn: "2026-11-17", amountCfa: 125_000 },
    { id: "ligne-18", number: "SANS-CLIENT", label: "Ligne sans client", issuedOn: "2026-11-01", dueOn: "2026-11-15", amountCfa: 10_000 },
    { id: "fac-neg", clientId: "cli-hotel", number: "NEG", label: "Montant illisible", issuedOn: "2026-11-01", dueOn: "2026-11-02", amountCfa: -5 },
  ],
  payments: [
    { id: "pay-1001", invoiceId: "fac-1001", paidOn: "2026-07-02", amountCfa: 20_000, channel: "momo_mtn", reference: "MM-1001" },
    { id: "pay-1002", invoiceId: "fac-1002", paidOn: "2026-07-01", amountCfa: 18_000, channel: "especes", reference: "ESP-1002" },
    { id: "pay-1042", invoiceId: "fac-1042", paidOn: "2026-10-01", amountCfa: 180_000, channel: "virement", reference: "VIR-1042" },
    { id: "pay-1088", invoiceId: "fac-1088", paidOn: "2026-07-14", amountCfa: 150_000, channel: "momo_moov", reference: "MV-1088" },
    { id: "pay-1090", invoiceId: "fac-1090", paidOn: "2026-09-12", amountCfa: 60_000, channel: "momo_mtn", reference: "MM-1090" },
    { id: "pay-1114", invoiceId: "fac-1114", paidOn: "2026-11-10", amountCfa: 100_000, channel: "momo_mtn", reference: "MM-88421" },
    { id: "pay-1130", invoiceId: "fac-1130", paidOn: "2026-10-31", amountCfa: 100_000, channel: "momo_moov", reference: "MV-1130" },
    { id: "pay-1160", invoiceId: "fac-1160", paidOn: "2026-11-20", amountCfa: 50_000, channel: "virement", reference: "VIR-1160" },
    { id: "pay-orphelin", invoiceId: "fac-9999", paidOn: "2026-11-01", amountCfa: 5_000, channel: "especes", reference: "ORPHELIN" },
  ],
  creditNotes: [
    { id: "av-1140", invoiceId: "fac-1140", issuedOn: "2026-11-05", amountCfa: 80_000, reason: "Retour de marchandises abîmées au déballage." },
  ],
  schedules: [
    {
      id: "ech-1130",
      invoiceId: "fac-1130",
      installments: [
        { dueOn: "2026-10-31", amountCfa: 100_000, paidOn: "2026-10-31" },
        { dueOn: "2026-11-30", amountCfa: 100_000, paidOn: null },
        { dueOn: "2026-12-31", amountCfa: 100_000, paidOn: null },
      ],
    },
    {
      id: "ech-mauvais",
      invoiceId: "fac-1155",
      installments: [{ dueOn: "2026-12-01", amountCfa: 10, paidOn: null }],
    },
  ],
  disputes: [
    { id: "lit-1122", invoiceId: "fac-1122", openedOn: "2026-11-18", reason: "Pièces non conformes au bon de commande.", status: "ouverte" },
  ],
};

const MESSAGES: InboundMessage[] = [
  {
    id: "msg-garage",
    clientId: "cli-garage",
    invoiceId: "fac-1122",
    receivedOn: "2026-11-23",
    channel: "whatsapp",
    text: "La marchandise était abîmée, je ne paie pas tant que ce n'est pas repris.",
    classification: null,
  },
  {
    id: "msg-pharma",
    clientId: "cli-pharma",
    invoiceId: "fac-1114",
    receivedOn: "2026-11-24",
    channel: "whatsapp",
    text: "J'ai envoyé 100000 par MoMo, réf MM-88421.",
    classification: null,
  },
  {
    id: "msg-adjoua",
    clientId: "cli-adjoua",
    invoiceId: "fac-1133",
    receivedOn: "2026-11-24",
    channel: "whatsapp",
    text: "Je paie vendredi sans faute.",
    classification: null,
  },
  {
    id: "msg-froid",
    clientId: "cli-froid",
    invoiceId: "fac-1138",
    receivedOn: "2026-11-24",
    channel: "whatsapp",
    text: "Bonjour, c'est pour la climatisation du bureau.",
    classification: null,
  },
  {
    id: "msg-hotel",
    clientId: "cli-hotel",
    invoiceId: "fac-1042",
    receivedOn: "2026-11-24",
    channel: "whatsapp",
    text: "C'est déjà réglé depuis octobre.",
    classification: null,
  },
];

export function createInitialState(): AppState {
  const { portfolio, issues } = importPortfolio(RAW_PORTFOLIO);
  return {
    version: STATE_VERSION,
    portfolio,
    issues,
    journal: [
      {
        id: "j-hist-1114",
        at: "2026-11-13T09:30:00.000Z",
        kind: "relance_envoyee",
        invoiceId: "fac-1114",
        clientId: "cli-pharma",
        idempotencyKey: "fac-1114:etape:1",
        summary: "Relance 1 déjà partie le 13 novembre, ton courtois, canal WhatsApp.",
        detail: { etape: 1, canal: "whatsapp", solde: 140_000 },
      },
      {
        id: "j-import",
        at: "2026-11-24T07:50:00.000Z",
        kind: "import",
        invoiceId: null,
        clientId: null,
        idempotencyKey: "import:portefeuille",
        summary: `Portefeuille importé : ${portfolio.invoices.length} factures retenues, ${issues.length} lignes refusées.`,
        detail: { factures: portfolio.invoices.length, refus: issues.length },
      },
    ],
    messages: MESSAGES.map((message) => ({ ...message })),
    settings: {
      referenceDate: REFERENCE_DATE,
      thresholdCfa: DEFAULT_THRESHOLD_CFA,
      channelMode: "preference",
      offline: false,
      weights: { ...DEFAULT_WEIGHTS },
      steps: DEFAULT_STEPS.map((step) => ({ ...step })),
    },
    outbox: [],
    approvals: [],
    suppressions: [],
    clock: "2026-11-24T08:00:00.000Z",
    seq: 1,
  };
}
