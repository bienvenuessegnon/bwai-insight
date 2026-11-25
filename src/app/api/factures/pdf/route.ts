import { findIssued } from "@/server/registry";
import { renderInvoicePdf } from "@/server/invoice-pdf";
import { requestOrigin } from "@/server/billing";
import { readLimitedJson } from "@/server/body";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readLimitedJson(request);
  if (!body.ok) return Response.json({ error: body.error }, { status: body.status });
  const sceau = body.value && typeof body.value === "object" ? (body.value as { sceau?: unknown }).sceau : undefined;
  if (typeof sceau !== "string") return Response.json({ error: "Facture absente." }, { status: 422 });
  const document = await findIssued(sceau);
  if (!document) return Response.json({ error: "Cette pièce n'est pas au registre." }, { status: 422 });
  const pdf = await renderInvoicePdf(document, requestOrigin(request));
  const filename = /^(FAC|AV)-2026-\d+$/.test(document.number) ? document.number : "facture";
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}.pdf"`,
    },
  });
}
