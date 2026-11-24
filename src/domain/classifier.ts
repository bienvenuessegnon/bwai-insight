import type { Classification, Intent } from "./types";

const PHRASES: { intent: Exclude<Intent, "incertain">; phrase: string; weight: number }[] =
  [
    { intent: "promesse", phrase: "sans faute", weight: 3 },
    { intent: "promesse", phrase: "je paie", weight: 2 },
    { intent: "promesse", phrase: "je vais payer", weight: 3 },
    { intent: "promesse", phrase: "promis", weight: 2 },
    { intent: "contestation", phrase: "je ne paie pas", weight: 3 },
    { intent: "contestation", phrase: "abim", weight: 3 },
    { intent: "contestation", phrase: "pas conforme", weight: 3 },
    { intent: "contestation", phrase: "litige", weight: 3 },
    { intent: "contestation", phrase: "contest", weight: 3 },
    { intent: "contestation", phrase: "erreur de facture", weight: 3 },
    { intent: "deja_paye", phrase: "deja pay", weight: 3 },
    { intent: "deja_paye", phrase: "deja regl", weight: 3 },
    { intent: "deja_paye", phrase: "c'est regle", weight: 3 },
    { intent: "deja_paye", phrase: "momo", weight: 2 },
    { intent: "deja_paye", phrase: "mobile money", weight: 2 },
    { intent: "deja_paye", phrase: "j'ai envoye", weight: 2 },
    { intent: "deja_paye", phrase: "recu de paiement", weight: 3 },
    { intent: "delai", phrase: "delai", weight: 3 },
    { intent: "delai", phrase: "reporter", weight: 2 },
    { intent: "delai", phrase: "reporte", weight: 2 },
    { intent: "delai", phrase: "fin du mois", weight: 2 },
    { intent: "delai", phrase: "pas avant", weight: 2 },
    { intent: "delai", phrase: "semaine prochaine", weight: 2 },
  ];

export const CONFIDENCE_FLOOR = 0.6;
export const SCORE_FLOOR = 3;
export const LEXICON_VERSION = "lexique-1";

export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function classify(text: string): Classification {
  const folded = fold(text);
  const scores = { promesse: 0, contestation: 0, deja_paye: 0, delai: 0 };
  for (const phrase of PHRASES) {
    if (folded.includes(phrase.phrase)) scores[phrase.intent] += phrase.weight;
  }
  const ranked = (
    Object.entries(scores) as [Exclude<Intent, "incertain">, number][]
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked[0][1];
  const second = ranked[1][1];
  const confidence = top <= 0 ? 0 : top / (top + second);
  if (top < SCORE_FLOOR || confidence < CONFIDENCE_FLOOR || top === second) {
    return { intent: "incertain", confidence, scores };
  }
  return { intent: ranked[0][0], confidence, scores };
}

export const EVAL_SET: { text: string; expected: Intent }[] = [
  { text: "Je paie vendredi sans faute.", expected: "promesse" },
  { text: "Promis, je vais payer demain.", expected: "promesse" },
  { text: "La marchandise était abîmée, je ne paie pas.", expected: "contestation" },
  { text: "Nous contestons les quantités.", expected: "contestation" },
  { text: "Il y a une erreur de facture sur la ligne 3.", expected: "contestation" },
  { text: "C'est déjà réglé depuis octobre.", expected: "deja_paye" },
  { text: "J'ai envoyé 100000 par MoMo, réf MM-88421.", expected: "deja_paye" },
  { text: "Voici le reçu de paiement.", expected: "deja_paye" },
  { text: "Pouvez-vous m'accorder un délai jusqu'à la fin du mois ?", expected: "delai" },
  { text: "Merci de reporter à la semaine prochaine.", expected: "delai" },
  { text: "Pas avant la semaine prochaine, désolé.", expected: "delai" },
  { text: "Bonjour, c'est pour la climatisation du bureau.", expected: "incertain" },
  { text: "ok", expected: "incertain" },
  { text: "Vendredi.", expected: "incertain" },
  { text: "MoMo", expected: "incertain" },
  { text: "Je vous ai envoyé le bon de commande.", expected: "incertain" },
  { text: "Le momo de la semaine prochaine", expected: "incertain" },
];

export function evaluateClassifier(set = EVAL_SET) {
  const rows = set.map((row) => {
    const result = classify(row.text);
    return { ...row, actual: result.intent, confidence: result.confidence, hit: result.intent === row.expected };
  });
  const hits = rows.filter((row) => row.hit).length;
  return { rows, hits, total: rows.length, accuracy: rows.length === 0 ? 0 : hits / rows.length };
}
