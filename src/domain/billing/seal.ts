import { randomBytes } from "node:crypto";
import type { IssuedDocument } from "./types";

export function newSealToken(): string {
  return randomBytes(18).toString("base64url");
}

export function invoiceFingerprint(
  document: Pick<
    IssuedDocument,
    | "number"
    | "issuedOn"
    | "clientName"
    | "clientCity"
    | "kind"
    | "lines"
    | "totals"
    | "dueOn"
    | "terms"
    | "discountRate"
    | "linkedNumber"
  >,
): string {
  return JSON.stringify({
    n: document.number,
    d: document.issuedOn,
    c: document.clientName,
    city: document.clientCity,
    k: document.kind,
    due: document.dueOn,
    terms: document.terms,
    discount: document.discountRate,
    link: document.linkedNumber,
    lines: document.lines.map((line) => [line.designation, line.qty, line.unitPriceCfa, line.lineCfa]),
    t: document.totals,
  });
}
