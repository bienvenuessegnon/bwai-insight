import { readSeal } from "@/domain/billing/seal";
import type { IssuedDocument } from "@/domain/billing/types";
import { renderInvoicePdf } from "@/server/invoice-pdf";
import { requestOrigin } from "@/server/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "La demande est illisible." }, { status: 400 });
  }
  const document = body && typeof body === "object" ? (body as { document?: IssuedDocument }).document : undefined;
  if (!document?.sceau || !document.totals) return Response.json({ error: "Facture absente." }, { status: 422 });
  const seal = readSeal(document.sceau);
  if (!seal.ok || seal.facts.totalTtc !== document.totals.totalCfa || seal.facts.number !== document.number) {
    return Response.json({ error: "Le sceau ne correspond pas à cette facture." }, { status: 422 });
  }
  const pdf = await renderInvoicePdf(document, requestOrigin(request));
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${document.number}.pdf"`,
    },
  });
}
