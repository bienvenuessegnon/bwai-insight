import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLEAN_ORDER } from "@/domain/billing/catalog";
import type { BillingState } from "@/domain/billing/types";
import { POST as pdfPost } from "@/app/api/factures/pdf/route";
import { POST as facturesPost } from "@/app/api/factures/route";
import { GET as verifyGet } from "@/app/api/verifier/route";
import { readLimitedJson } from "./body";
import { findIssued } from "./registry";

async function issueClean(): Promise<BillingState> {
  const parsed = await facturesPost(
    new Request("http://localhost/api/factures", {
      method: "POST",
      body: JSON.stringify({ state: null, action: { type: "parse", text: CLEAN_ORDER, label: "Propre" } }),
    }),
  );
  const first = (await parsed.json()) as { state: BillingState };
  const confirmed = await facturesPost(
    new Request("http://localhost/api/factures", {
      method: "POST",
      body: JSON.stringify({ state: first.state, action: { type: "confirm", confirmed: true } }),
    }),
  );
  const ready = (await confirmed.json()) as { state: BillingState };
  const issued = await facturesPost(
    new Request("http://localhost/api/factures", {
      method: "POST",
      body: JSON.stringify({ state: ready.state, action: { type: "validate" } }),
    }),
  );
  const payload = (await issued.json()) as { state: BillingState };
  return payload.state;
}

describe("registre des factures", () => {
  it("n'accepte que la pièce enregistrée, pas le corps envoyé par le visiteur", async () => {
    const state = await issueClean();
    const document = state.issued.at(-1);
    assert.ok(document);
    const stored = await findIssued(document.sceau);
    assert.equal(stored?.clientName, "Hôtel du Port");
    assert.equal(stored?.lines[0]?.qty, 10);
    assert.equal(await findIssued(`${document.sceau}x`), null);

    const forged = await facturesPost(
      new Request("http://localhost/api/factures", {
        method: "POST",
        body: JSON.stringify({
          state: {
            ...state,
            issued: [{ ...document, sceau: "intrus", number: "FAC-2026-9999", clientName: "Pirate" }],
          },
          action: null,
        }),
      }),
    );
    const kept = (await forged.json()) as { state: BillingState };
    assert.equal(kept.state.issued.some((item) => item.clientName === "Pirate"), false);
    assert.equal(kept.state.issued.some((item) => item.sceau === document.sceau), true);

    const pdf = await pdfPost(
      new Request("http://localhost/api/factures/pdf", {
        method: "POST",
        body: JSON.stringify({
          sceau: document.sceau,
          document: { clientName: "Pirate", lines: [{ designation: "Or", qty: 1, unitPriceCfa: 1, lineCfa: 1 }] },
        }),
      }),
    );
    assert.equal(pdf.status, 200);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    assert.equal(bytes.includes(Buffer.from("Pirate")), false);

    const verdict = await verifyGet(new Request(`http://localhost/api/verifier?sceau=${encodeURIComponent(document.sceau)}`));
    const body = (await verdict.json()) as { ok: boolean; clientName: string; totalLabel: string };
    assert.equal(body.ok, true);
    assert.equal(body.clientName, "Hôtel du Port");
    assert.match(body.totalLabel, /76/);

    const refused = await verifyGet(new Request("http://localhost/api/verifier?sceau=inconnu"));
    const missing = (await refused.json()) as { ok: boolean };
    assert.equal(missing.ok, false);
  });

  it("refuse une demande trop lourde", async () => {
    const heavy = await readLimitedJson(new Request("http://localhost/api/factures", { method: "POST", body: "x".repeat(32_001) }));
    assert.equal(heavy.ok, false);
    if (!heavy.ok) assert.equal(heavy.status, 413);
  });
});
