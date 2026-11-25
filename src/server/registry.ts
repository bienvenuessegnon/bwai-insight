import { invoiceFingerprint } from "@/domain/billing/seal";
import type { IssuedDocument } from "@/domain/billing/types";
import { sql } from "@/lib/db";

type Row = { sceau: string; number: string; fingerprint: string; payload: string };

function parseDocument(row: Row): IssuedDocument | null {
  try {
    const document = JSON.parse(row.payload) as IssuedDocument;
    if (!document || document.sceau !== row.sceau || document.number !== row.number) return null;
    if (invoiceFingerprint(document) !== row.fingerprint) return null;
    return document;
  } catch {
    return null;
  }
}

export async function listIssued(): Promise<IssuedDocument[]> {
  const rows = await sql<Row>("select sceau, number, fingerprint, payload from issued_documents order by created_at");
  return rows.flatMap((row) => {
    const document = parseDocument(row);
    return document ? [document] : [];
  });
}

export async function findIssued(sceau: string): Promise<IssuedDocument | null> {
  const token = sceau.trim().slice(0, 80);
  if (!token) return null;
  const rows = await sql<Row>(
    "select sceau, number, fingerprint, payload from issued_documents where sceau = $1",
    [token],
  );
  return rows[0] ? parseDocument(rows[0]) : null;
}

export async function saveIssued(document: IssuedDocument): Promise<"ok" | "duplicate"> {
  const fingerprint = invoiceFingerprint(document);
  try {
    await sql(
      "insert into issued_documents (sceau, number, fingerprint, payload) values ($1, $2, $3, $4)",
      [document.sceau, document.number, fingerprint, JSON.stringify(document)],
    );
    return "ok";
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "23505") return "duplicate";
    throw error;
  }
}
