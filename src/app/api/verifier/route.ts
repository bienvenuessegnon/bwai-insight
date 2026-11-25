import { formatCfa, formatDate } from "@/domain/format";
import { findIssued } from "@/server/registry";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sceau = new URL(request.url).searchParams.get("sceau") ?? "";
  const document = await findIssued(sceau);
  if (!document) {
    return Response.json({ ok: false, reason: "Ce code ne correspond à aucune facture du registre." });
  }
  return Response.json({
    ok: true,
    number: document.number,
    clientName: document.clientName,
    totalLabel: formatCfa(document.totals.totalCfa),
    issuedOnLabel: formatDate(document.issuedOn),
    kind: document.kind === "avoir" ? "Avoir" : "Facture",
    lines: document.lines.map((line) => `${line.designation} × ${line.qty}`),
  });
}
