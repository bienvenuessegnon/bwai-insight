import type { CatalogArticle, CatalogClient } from "./types";

export const CLIENTS: CatalogClient[] = [
  { id: "cli-hotel", name: "Hôtel du Port", city: "Cotonou" },
  { id: "cli-sena", name: "Atelier Sèna Couture", city: "Porto-Novo" },
  { id: "cli-pharma", name: "Pharmacie Akpakpa", city: "Cotonou" },
  { id: "cli-ecole", name: "École Les Palmiers", city: "Abomey-Calavi" },
  { id: "cli-garage", name: "Garage Tokpa", city: "Cotonou" },
  { id: "cli-coop", name: "Coopérative des maraîchers de Ouidah", city: "Ouidah" },
  { id: "cli-adjoua", name: "Boutique Adjoua", city: "Abomey-Calavi" },
  { id: "cli-froid", name: "Société Béninoise de Froid", city: "Cotonou" },
];

export const ARTICLES: CatalogArticle[] = [
  { id: "ciment", label: "Ciment 42,5 kg", aliases: ["ciment 42,5", "ciment"], priceCfa: 6_500 },
  { id: "peinture", label: "Peinture blanche 4 L", aliases: ["peinture blanche", "peinture"], priceCfa: 8_000 },
  { id: "table", label: "Table d'écolier", aliases: ["tables d'écolier", "table d'écolier"], priceCfa: 35_000 },
  { id: "groupe", label: "Groupe électrogène", aliases: ["groupes électrogènes", "groupe électrogène"], priceCfa: 420_000 },
  { id: "ampoule", label: "Ampoule LED", aliases: ["ampoules led", "ampoule led"], priceCfa: 1_500 },
];

export const CLEAN_ORDER = `Hôtel du Port
10 sacs de ciment 42,5 à 6 500 F
Échéance le 10 décembre 2026, paiement sous 15 jours.
Total 76 700 F`;

export const GAP_ORDER = `Hôtel du Port
10 sacs de ciment 42,5 à 6 500 F
4 pots de peinture blanche à 8 000 F
Remise 5 %
Échéance le 10 décembre 2026.
Total 95 000 F`;

export const DELIVERY_ORDER = `École Les Palmiers
20 tables d'écolier
Livré : 18`;

export const UNKNOWN_ORDER = `Société Kpakpa
2 groupes électrogènes à 50 000 F
Échéance le 15 décembre 2026.`;
