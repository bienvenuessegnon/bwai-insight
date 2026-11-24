export const REFERENCE_DATE = "2026-11-24";
export const DEFAULT_THRESHOLD_CFA = 200_000;
export const STATE_VERSION = 1;

export type Channel = "whatsapp" | "sms" | "email";
export type ChannelMode = Channel | "preference";

export type Client = {
  id: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  channel: Channel;
  optOut: boolean;
  maxPerMonth: number;
};

export type Invoice = {
  id: string;
  clientId: string;
  number: string;
  label: string;
  issuedOn: string;
  dueOn: string;
  amountCfa: number;
};

export type PaymentChannel = "momo_mtn" | "momo_moov" | "especes" | "virement";

export type Payment = {
  id: string;
  invoiceId: string;
  paidOn: string;
  amountCfa: number;
  channel: PaymentChannel;
  reference: string;
};

export type CreditNote = {
  id: string;
  invoiceId: string;
  issuedOn: string;
  amountCfa: number;
  reason: string;
};

export type Installment = {
  dueOn: string;
  amountCfa: number;
  paidOn: string | null;
};

export type Schedule = {
  id: string;
  invoiceId: string;
  installments: Installment[];
};

export type Dispute = {
  id: string;
  invoiceId: string;
  openedOn: string;
  reason: string;
  status: "ouverte" | "closee";
};

export type Portfolio = {
  clients: Client[];
  invoices: Invoice[];
  payments: Payment[];
  creditNotes: CreditNote[];
  schedules: Schedule[];
  disputes: Dispute[];
};

export type ImportIssue = {
  code:
    | "doublon"
    | "champ_manquant"
    | "montant_invalide"
    | "reference_inconnue"
    | "echeancier_incoherent";
  entity: string;
  id: string;
  message: string;
};

export type PrimaryStatus =
  | "soldee"
  | "contestee"
  | "echeancier"
  | "non_echue"
  | "partiellement_payee"
  | "echue";

export type Position = {
  invoiceId: string;
  clientId: string;
  number: string;
  label: string;
  amountCfa: number;
  paidCfa: number;
  creditCfa: number;
  balanceCfa: number;
  dueOn: string;
  nominalDays: number;
  daysOverdue: number;
  status: PrimaryStatus;
  actionable: boolean;
  openDisputeId: string | null;
  scheduleId: string | null;
};

export type PriorityWeights = {
  anciennete: number;
  solde: number;
  historique: number;
  plafondJours: number;
  plafondSolde: number;
};

export const DEFAULT_WEIGHTS: PriorityWeights = {
  anciennete: 0.45,
  solde: 0.35,
  historique: 0.2,
  plafondJours: 90,
  plafondSolde: 500_000,
};

export type Ranked = Position & {
  score: number;
  lateRatio: number;
  parts: { anciennete: number; solde: number; historique: number };
};

export type ReminderTone = "courtois" | "rappel" | "ferme" | "passage";

export type ReminderStep = {
  step: number;
  minDays: number;
  tone: ReminderTone;
  auto: boolean;
};

export const DEFAULT_STEPS: ReminderStep[] = [
  { step: 1, minDays: 1, tone: "courtois", auto: true },
  { step: 2, minDays: 7, tone: "rappel", auto: true },
  { step: 3, minDays: 15, tone: "ferme", auto: true },
  { step: 4, minDays: 30, tone: "passage", auto: false },
];

export type JournalKind =
  | "import"
  | "relance_envoyee"
  | "relance_annulee"
  | "revue_demandee"
  | "revue_humaine"
  | "paiement"
  | "message_classe"
  | "reprise";

export type JournalEntry = {
  id: string;
  at: string;
  kind: JournalKind;
  invoiceId: string | null;
  clientId: string | null;
  idempotencyKey: string | null;
  summary: string;
  detail: Record<string, string | number | boolean | null>;
};

export type Intent =
  | "promesse"
  | "contestation"
  | "deja_paye"
  | "delai"
  | "incertain";

export type Classification = {
  intent: Intent;
  confidence: number;
  scores: Record<"promesse" | "contestation" | "deja_paye" | "delai", number>;
};

export type InboundMessage = {
  id: string;
  clientId: string;
  invoiceId: string | null;
  receivedOn: string;
  channel: Channel;
  text: string;
  classification: Classification | null;
};

export type Settings = {
  referenceDate: string;
  thresholdCfa: number;
  channelMode: ChannelMode;
  offline: boolean;
  weights: PriorityWeights;
  steps: ReminderStep[];
};

export type Decision = "envoyer" | "annuler" | "revue" | "deja_traite";

export type CheckState = "ok" | "stop" | "skip";

export type Check = {
  code: string;
  label: string;
  state: CheckState;
};

export type WorkItem = {
  invoiceId: string;
  clientId: string;
  idempotencyKey: string;
  step: number | null;
  decision: Decision;
  reasonCode: string;
  reason: string;
  channel: Channel | null;
  message: string | null;
  checks: Check[];
};

export type Approval = {
  invoiceId: string;
  step: number;
};

export type Suppression = {
  invoiceId: string;
  until: string;
};

export type AppState = {
  version: number;
  portfolio: Portfolio;
  issues: ImportIssue[];
  journal: JournalEntry[];
  messages: InboundMessage[];
  settings: Settings;
  outbox: WorkItem[];
  approvals: Approval[];
  suppressions: Suppression[];
  clock: string;
  seq: number;
};
