export const BILLING_DATE = "2026-11-24";
export const DEFAULT_TAX_RATE = 18;
export const BILLING_VERSION = 1;

export type Confidence = "sur" | "a_relire" | "absent";

export type FieldSource = {
  label: string;
  excerpt: string | null;
  confidence: Confidence;
};

export type CatalogClient = {
  id: string;
  name: string;
  city: string;
};

export type CatalogArticle = {
  id: string;
  label: string;
  aliases: string[];
  priceCfa: number;
};

export type DraftLine = {
  id: string;
  designation: string;
  articleId: string | null;
  qty: number | null;
  deliveredQty: number | null;
  unitPriceCfa: number | null;
  source: FieldSource;
};

export type Draft = {
  id: string;
  sourceText: string;
  sourceLabel: string;
  clientName: string | null;
  clientId: string | null;
  clientCity: string | null;
  clientSource: FieldSource;
  lines: DraftLine[];
  discountRate: number | null;
  discountSource: FieldSource;
  announcedTotalCfa: number | null;
  totalSource: FieldSource;
  dueOn: string | null;
  dueSource: FieldSource;
  terms: string | null;
  confirmed: boolean;
  acceptUnknownClient: boolean;
  acceptUnusualPrice: boolean;
  acceptAnnouncedGap: boolean;
  billDeliveredQty: boolean;
};

export type MoneyLine = {
  designation: string;
  qty: number;
  unitPriceCfa: number;
  lineCfa: number;
};

export type Totals = {
  subtotalCfa: number;
  discountCfa: number;
  baseCfa: number;
  taxRate: number;
  taxCfa: number;
  totalCfa: number;
};

export type Anomaly = {
  code:
    | "client_absent"
    | "client_inconnu"
    | "aucune_ligne"
    | "prix_absent"
    | "quantite_absente"
    | "prix_inhabituel"
    | "total_divergent"
    | "livraison_ecart"
    | "echeance_absente"
    | "doublon";
  blocking: boolean;
  message: string;
};

export type IssuedKind = "facture" | "avoir";

export type IssuedDocument = {
  id: string;
  draftId: string | null;
  kind: IssuedKind;
  number: string;
  issuedOn: string;
  clientName: string;
  clientCity: string | null;
  lines: MoneyLine[];
  totals: Totals;
  dueOn: string | null;
  terms: string | null;
  discountRate: number;
  sceau: string;
  code: string;
  linkedNumber: string | null;
  channel: "whatsapp";
};

export type BillingJournal = {
  id: string;
  at: string;
  summary: string;
};

export type BillingState = {
  version: number;
  taxRate: number;
  draft: Draft | null;
  issued: IssuedDocument[];
  journal: BillingJournal[];
  seq: number;
  clock: string;
};
