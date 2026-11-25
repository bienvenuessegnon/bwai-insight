import { ARTICLES, CLIENTS } from "./catalog";
import type { Confidence, Draft, DraftLine, FieldSource } from "./types";

const MONTHS: Record<string, string> = {
  janvier: "01",
  fevrier: "02",
  mars: "03",
  avril: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  aout: "08",
  septembre: "09",
  octobre: "10",
  novembre: "11",
  decembre: "12",
};

export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function source(label: string, excerpt: string | null, confidence: Confidence): FieldSource {
  return { label, excerpt, confidence };
}

function absent(label: string): FieldSource {
  return source(label, null, "absent");
}

function money(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  return Number.isInteger(value) ? value : null;
}

function windowAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + length + 28);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function parseOrder(text: string, id: string, sourceLabel: string): Draft {
  const folded = fold(text);
  const clients = [...CLIENTS].sort((a, b) => b.name.length - a.name.length);
  const known = clients.find((client) => folded.includes(fold(client.name)));
  let clientName = known?.name ?? null;
  const clientId = known?.id ?? null;
  const clientCity = known?.city ?? null;
  let clientSource = known
    ? source("Référentiel clients", known.name, "sur")
    : absent("Client");

  if (!known) {
    const first = text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !/^bonjour\b/i.test(line) && !/adjovi/i.test(line));
    if (first && first.length < 80 && !/\d{3,}/.test(first)) {
      clientName = first.replace(/[.,]$/, "");
      clientSource = source("Message", first, "a_relire");
    }
  }

  const articles = [...ARTICLES].sort((a, b) => b.aliases[0].length - a.aliases[0].length);
  const used: { start: number; end: number }[] = [];
  const lines: DraftLine[] = [];
  for (const article of articles) {
    const alias = [...article.aliases].sort((a, b) => b.length - a.length).find((name) => folded.includes(fold(name)));
    if (!alias) continue;
    const at = folded.indexOf(fold(alias));
    if (used.some((range) => at >= range.start && at < range.end)) continue;
    used.push({ start: at, end: at + fold(alias).length });
    const before = folded.slice(Math.max(0, at - 32), at);
    const after = text.slice(at, Math.min(text.length, at + alias.length + 24));
    const qtyMatch = before.match(/(\d+)\s*(?:sacs?|pots?|bidons?|tables?|unites?|pieces?|groupes?)?\s*(?:de\s+|d')?\s*$/i);
    const priceMatch = after.match(/à\s+([\d\s\u00a0\u202f]+)\s*(?:f|fcfa|cfa)?/i);
    const qty = qtyMatch ? Number(qtyMatch[1]) : null;
    const unitPriceCfa = priceMatch ? money(priceMatch[1]) : null;
    const confidence: Confidence = qty && unitPriceCfa ? "sur" : "a_relire";
    lines.push({
      id: `${id}-l${lines.length + 1}`,
      designation: article.label,
      articleId: article.id,
      qty,
      deliveredQty: null,
      unitPriceCfa,
      source: source(
        unitPriceCfa ? "Message" : "Message, prix non écrit",
        windowAround(text, text.toLowerCase().indexOf(alias.slice(0, 6).toLowerCase()), alias.length),
        qty || unitPriceCfa ? confidence : "absent",
      ),
    });
  }

  const delivered = text.match(/livr[^\d]{0,16}(\d+)/i);
  if (delivered && lines.length === 1) lines[0].deliveredQty = Number(delivered[1]);

  const discountMatch = text.match(/remise\s+(\d+(?:[.,]\d+)?)\s*%/i);
  const discountRate = discountMatch ? Number(discountMatch[1].replace(",", ".")) : null;
  const totalMatch = text.match(/total(?:\s+annonc\w*)?\s*:?\s*([\d\s\u00a0\u202f]+)\s*(?:f|fcfa|cfa)?/i);
  const dueMatch = text.match(/éch[ée]ance\s+le\s+(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/i);
  const termsMatch = text.match(/paiement\s+sous\s+\d+\s+jours/i);
  let dueOn: string | null = null;
  if (dueMatch) {
    const month = MONTHS[fold(dueMatch[2])];
    if (month) dueOn = `${dueMatch[3]}-${month}-${dueMatch[1].padStart(2, "0")}`;
  }

  return {
    id,
    sourceText: text,
    sourceLabel,
    clientName,
    clientId,
    clientCity,
    clientSource,
    lines,
    discountRate,
    discountSource: discountMatch
      ? source("Message", discountMatch[0], "sur")
      : source("Aucune remise écrite", null, "sur"),
    announcedTotalCfa: totalMatch ? money(totalMatch[1]) : null,
    totalSource: totalMatch ? source("Message", totalMatch[0], "a_relire") : absent("Total annoncé"),
    dueOn,
    dueSource: dueOn ? source("Message", dueMatch?.[0] ?? dueOn, "sur") : absent("Échéance"),
    terms: termsMatch ? termsMatch[0] : dueOn ? "Échéance indiquée dans le message" : null,
    confirmed: false,
    acceptUnknownClient: false,
    acceptUnusualPrice: false,
    acceptAnnouncedGap: false,
    billDeliveredQty: false,
  };
}
