import { createHmac, timingSafeEqual } from "node:crypto";
import type { IssuedKind } from "./types";

const KEY = "adjovi-demonstration-sceau-2026";

export type SealFacts = {
  number: string;
  issuedOn: string;
  clientName: string;
  totalTtc: number;
  kind: IssuedKind;
};

export function sealFacts(facts: SealFacts): { sceau: string; code: string } {
  const body = Buffer.from(
    JSON.stringify({
      n: facts.number,
      d: facts.issuedOn,
      c: facts.clientName,
      t: facts.totalTtc,
      k: facts.kind,
    }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", KEY).update(body).digest("base64url").slice(0, 12);
  const sceau = `${body}.${sig}`;
  return { sceau, code: sceau };
}

export function readSeal(input: string): { ok: true; facts: SealFacts } | { ok: false; reason: string } {
  const raw = input.trim();
  const sceau = raw.includes("sceau=") ? decodeURIComponent(raw.split("sceau=").pop() ?? "") : raw;
  const dot = sceau.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "Ce code ne porte pas de sceau." };
  const body = sceau.slice(0, dot);
  const sig = sceau.slice(dot + 1);
  const expected = createHmac("sha256", KEY).update(body).digest("base64url").slice(0, 12);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, reason: "Sceau altéré : le montant ou le nom ne correspond plus." };
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      n?: unknown;
      d?: unknown;
      c?: unknown;
      t?: unknown;
      k?: unknown;
    };
    if (
      typeof parsed.n !== "string" ||
      typeof parsed.d !== "string" ||
      typeof parsed.c !== "string" ||
      typeof parsed.t !== "number" ||
      (parsed.k !== "facture" && parsed.k !== "avoir")
    ) {
      return { ok: false, reason: "Sceau illisible." };
    }
    return {
      ok: true,
      facts: { number: parsed.n, issuedOn: parsed.d, clientName: parsed.c, totalTtc: parsed.t, kind: parsed.k },
    };
  } catch {
    return { ok: false, reason: "Sceau illisible." };
  }
}
