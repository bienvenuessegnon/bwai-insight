import pg from "pg";
import { invoiceFingerprint } from "@/domain/billing/seal";
import type { IssuedDocument } from "@/domain/billing/types";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const memory: IssuedDocument[] = [];
let pool: pg.Pool | undefined;
let ready: Promise<void> | undefined;

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

async function database(): Promise<pg.Pool> {
  pool ??= new pg.Pool({ connectionString: databaseUrl, max: 3 });
  ready ??= pool
    .query(
      `create table if not exists issued_documents (
        sceau text primary key,
        number text not null unique,
        fingerprint text not null,
        payload text not null,
        created_at timestamptz not null default now()
      )`,
    )
    .then(() => undefined);
  await ready;
  return pool;
}

export async function listIssued(): Promise<IssuedDocument[]> {
  if (databaseUrl === "") return [...memory];
  const db = await database();
  const rows = (await db.query<Row>("select sceau, number, fingerprint, payload from issued_documents order by created_at")).rows;
  return rows.flatMap((row) => {
    const document = parseDocument(row);
    return document ? [document] : [];
  });
}

export async function findIssued(sceau: string): Promise<IssuedDocument | null> {
  const token = sceau.trim().slice(0, 80);
  if (!token) return null;
  if (databaseUrl === "") return memory.find((item) => item.sceau === token) ?? null;
  const db = await database();
  const rows = (await db.query<Row>("select sceau, number, fingerprint, payload from issued_documents where sceau = $1", [token])).rows;
  return rows[0] ? parseDocument(rows[0]) : null;
}

export async function saveIssued(document: IssuedDocument): Promise<"ok" | "duplicate"> {
  if (databaseUrl === "") {
    if (memory.some((item) => item.sceau === document.sceau || item.number === document.number)) return "duplicate";
    memory.push(document);
    return "ok";
  }
  const db = await database();
  try {
    await db.query(
      "insert into issued_documents (sceau, number, fingerprint, payload) values ($1, $2, $3, $4)",
      [document.sceau, document.number, invoiceFingerprint(document), JSON.stringify(document)],
    );
    return "ok";
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "23505") return "duplicate";
    throw error;
  }
}
