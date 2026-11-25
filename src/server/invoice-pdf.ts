import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { IssuedDocument } from "@/domain/billing/types";
import { formatCfa, formatDate } from "@/domain/format";

function plain(value: string): string {
  return value.replaceAll("\u202f", " ").replaceAll("−", "-");
}

export async function renderInvoicePdf(document: IssuedDocument, origin: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.15, 0.27);
  const green = rgb(0.05, 0.35, 0.28);
  page.drawRectangle({ x: 0, y: 760, width: 595, height: 82, color: ink });
  page.drawText("MAISON ADJOVI & FILS", { x: 40, y: 804, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Quincaillerie  ·  Cotonou", { x: 40, y: 784, size: 10, font, color: rgb(0.85, 0.9, 0.86) });
  page.drawText(document.kind === "avoir" ? "AVOIR" : "FACTURE", { x: 430, y: 804, size: 16, font: bold, color: rgb(0.95, 0.84, 0.55) });
  page.drawText(document.number, { x: 430, y: 784, size: 11, font, color: rgb(1, 1, 1) });
  page.drawText(plain(document.clientName), { x: 40, y: 720, size: 14, font: bold, color: ink });
  if (document.clientCity) page.drawText(plain(document.clientCity), { x: 40, y: 702, size: 11, font, color: ink });
  page.drawText(`Émise le ${formatDate(document.issuedOn)}`, { x: 380, y: 720, size: 10, font, color: ink });
  if (document.dueOn) page.drawText(`Échéance ${formatDate(document.dueOn)}`, { x: 380, y: 704, size: 10, font, color: ink });
  let y = 660;
  page.drawText("Désignation", { x: 40, y, size: 9, font: bold, color: green });
  page.drawText("Qté", { x: 320, y, size: 9, font: bold, color: green });
  page.drawText("Prix", { x: 380, y, size: 9, font: bold, color: green });
  page.drawText("Montant", { x: 470, y, size: 9, font: bold, color: green });
  y -= 18;
  for (const line of document.lines) {
    page.drawText(plain(line.designation), { x: 40, y, size: 11, font, color: ink });
    page.drawText(String(line.qty), { x: 320, y, size: 11, font, color: ink });
    page.drawText(plain(formatCfa(line.unitPriceCfa)), { x: 360, y, size: 10, font, color: ink });
    page.drawText(plain(formatCfa(line.lineCfa)), { x: 460, y, size: 10, font, color: ink });
    y -= 20;
  }
  y -= 10;
  const rows = [
    ["Sous-total", document.totals.subtotalCfa],
    ["Remise", document.totals.discountCfa],
    [`TVA ${document.totals.taxRate} %`, document.totals.taxCfa],
  ] as const;
  for (const [label, amount] of rows) {
    page.drawText(label, { x: 360, y, size: 10, font, color: ink });
    page.drawText(plain(formatCfa(amount)), { x: 460, y, size: 10, font, color: ink });
    y -= 16;
  }
  page.drawText("Total", { x: 360, y: y - 4, size: 13, font: bold, color: green });
  page.drawText(plain(formatCfa(document.totals.totalCfa)), { x: 450, y: y - 4, size: 13, font: bold, color: green });
  const url = `${origin}/verifier?sceau=${encodeURIComponent(document.sceau)}`;
  const png = await QRCode.toBuffer(url, { margin: 1, width: 160, color: { dark: "#1a2744", light: "#ffffff" } });
  const image = await pdf.embedPng(png);
  page.drawImage(image, { x: 40, y: 70, width: 90, height: 90 });
  page.drawText("Vérifier l'authenticité", { x: 144, y: 140, size: 11, font: bold, color: ink });
  page.drawText("Scannez le QR ou ouvrez le lien du sceau.", { x: 144, y: 122, size: 9, font, color: ink });
  page.drawText("Mobile Money de démonstration : FICTIF. Aucun paiement réel.", { x: 144, y: 96, size: 9, font, color: ink });
  page.drawText("Document de démonstration. La facture validée ne se modifie plus.", { x: 40, y: 42, size: 8, font, color: rgb(0.4, 0.42, 0.45) });
  return pdf.save();
}
