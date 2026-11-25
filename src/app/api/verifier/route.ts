import { readSeal } from "@/domain/billing/seal";
import { formatCfa, formatDate } from "@/domain/format";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sceau = new URL(request.url).searchParams.get("sceau") ?? "";
  const result = readSeal(sceau);
  if (!result.ok) return Response.json({ ok: false, reason: result.reason });
  return Response.json({
    ok: true,
    number: result.facts.number,
    clientName: result.facts.clientName,
    totalLabel: formatCfa(result.facts.totalTtc),
    issuedOnLabel: formatDate(result.facts.issuedOn),
    kind: result.facts.kind === "avoir" ? "Avoir" : "Facture",
  });
}
