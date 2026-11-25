import type { ChannelMode, Decision, PrimaryStatus } from "@/domain/types";

export type DeskSection = "tableau" | "relances" | "validation" | "journal" | "reglages" | "dossier";

export type CheckView = {
  label: string;
  state: "ok" | "stop" | "skip";
};

export type MoneyRow = {
  id: string;
  number: string;
  label: string;
  clientName: string;
  dueLabel: string;
  daysOverdue: number;
  balanceLabel: string;
  status: PrimaryStatus;
  statusLabel: string;
  order: number | null;
  decision: Decision;
  nextStep: string;
};

export type Letter = {
  id: string;
  invoiceId: string;
  number: string;
  clientName: string;
  channelLabel: string;
  balanceLabel: string;
  stateLabel: string;
  message: string;
};

export type ReviewItem = {
  id: string;
  number: string;
  clientName: string;
  balanceLabel: string;
  reason: string;
  canApprove: boolean;
  canCloseDispute: boolean;
  message: string | null;
};

export type JournalLine = {
  id: string;
  when: string;
  title: string;
  text: string;
};

export type DossierView = {
  id: string;
  number: string;
  label: string;
  clientName: string;
  city: string;
  phone: string;
  email: string;
  channelLabel: string;
  amountLabel: string;
  paidLabel: string;
  creditLabel: string;
  balanceLabel: string;
  balanceCfa: number;
  dueLabel: string;
  statusLabel: string;
  formula: string;
  orderLabel: string | null;
  decisionLabel: string;
  reason: string;
  message: string | null;
  canPay: boolean;
  canApprove: boolean;
  canCloseDispute: boolean;
  payments: string[];
  credits: string[];
  schedule: string[];
  dispute: string | null;
  replies: { when: string; text: string; reading: string | null }[];
  events: { when: string; text: string }[];
  checks: CheckView[];
};

export type Dashboard = {
  asOfLabel: string;
  company: string;
  city: string;
  encoursLabel: string;
  encoursCfa: number;
  retardLabel: string;
  retardCount: number;
  aValider: number;
  suspendues: number;
  reglementsLabel: string;
  reglementsCount: number;
  relancesPretes: number;
  relancesParties: number;
  erreursEvitees: number;
  referenceCount: number;
  offline: boolean;
  fileLocale: number;
  seuilLabel: string;
  thresholdCfa: number;
  channelMode: ChannelMode;
  rows: MoneyRow[];
  letters: Letter[];
  reviews: ReviewItem[];
  journal: JournalLine[];
  dossiers: DossierView[];
  refused: string[];
};
