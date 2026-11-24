import type { Channel, Decision, PrimaryStatus } from "@/domain/types";

export const STATUS_LABEL: Record<PrimaryStatus, string> = {
  soldee: "Soldée",
  contestee: "Contestée",
  echeancier: "Échéancier",
  non_echue: "Non échue",
  partiellement_payee: "Partiellement payée",
  echue: "Échue",
};

export const DECISION_LABEL: Record<Decision, string> = {
  envoyer: "Prête à partir",
  annuler: "Écartée",
  revue: "À relire",
  deja_traite: "Déjà traitée",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Courriel",
};

export const INTENT_LABEL = {
  promesse: "Promesse",
  contestation: "Contestation",
  deja_paye: "Déjà payé",
  delai: "Demande de délai",
  incertain: "Incertain",
} as const;
