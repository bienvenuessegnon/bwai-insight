import type { Anomaly, BillingJournal, IssuedKind } from "@/domain/billing/types";

export type SheetLine = {
  id: string | null;
  designation: string;
  qty: number | null;
  deliveredQty: number | null;
  unitPriceCfa: number | null;
  unitLabel: string;
  lineLabel: string;
  source: string;
  confidence: string;
};

export type Sheet = {
  sourceLabel: string;
  sourceText: string;
  clientName: string | null;
  clientCity: string | null;
  clientNote: string;
  lines: SheetLine[];
  discountLabel: string;
  announcedLabel: string | null;
  dueLabel: string | null;
  dueOn: string | null;
  terms: string | null;
  subtotalLabel: string;
  discountAmountLabel: string;
  baseLabel: string;
  taxLabel: string;
  totalLabel: string;
  totalCfa: number;
  anomalies: Anomaly[];
  confirmed: boolean;
  canValidate: boolean;
};

export type IssuedCard = {
  id: string;
  kind: IssuedKind;
  number: string;
  clientName: string;
  clientCity: string | null;
  totalLabel: string;
  totalCfa: number;
  dueLabel: string | null;
  terms: string | null;
  lines: { designation: string; qty: number; unitLabel: string; lineLabel: string }[];
  subtotalLabel: string;
  discountAmountLabel: string;
  baseLabel: string;
  taxLabel: string;
  sceau: string;
  qrDataUrl: string;
  linkedNumber: string | null;
  issuedOnLabel: string;
};

export type BillingView = {
  taxRate: number;
  sheet: Sheet | null;
  issued: IssuedCard[];
  journal: BillingJournal[];
};
