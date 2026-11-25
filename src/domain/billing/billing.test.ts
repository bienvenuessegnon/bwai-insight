import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anomaliesOf, totalsOf, priceLines } from "./calc";
import { CLEAN_ORDER, DELIVERY_ORDER, GAP_ORDER, UNKNOWN_ORDER } from "./catalog";
import { parseOrder } from "./parse";
import { createBillingState, reduceBilling } from "./reduce";
import { invoiceFingerprint } from "./seal";

function readyClean() {
  let state = createBillingState();
  state = reduceBilling(state, { type: "parse", text: CLEAN_ORDER, label: "Commande propre" });
  state = reduceBilling(state, { type: "confirm", confirmed: true });
  return state;
}

describe("facturation", () => {
  it("met en forme une commande propre et ne crée pas deux numéros", () => {
    const draft = parseOrder(CLEAN_ORDER, "d1", "Commande propre");
    assert.equal(draft.clientName, "Hôtel du Port");
    assert.equal(draft.lines[0].qty, 10);
    assert.equal(draft.lines[0].unitPriceCfa, 6500);
    assert.equal(anomaliesOf(draft, [], 18).length, 0);
    const totals = totalsOf(priceLines(draft), draft.discountRate, 18);
    assert.equal(totals.totalCfa, 76_700);
    const ready = readyClean();
    const once = reduceBilling(ready, { type: "validate" });
    assert.equal(once.issued.length, 1);
    assert.equal(once.issued[0].totals.totalCfa, 76_700);
    const again = reduceBilling(once, { type: "validate" });
    assert.equal(again.issued.length, 1);
    const replay = reduceBilling({ ...once, draft: ready.draft }, { type: "validate" });
    assert.equal(replay.issued.length, 1);
    assert.match(replay.journal.at(-1)?.summary ?? "", /déjà émise/);
  });

  it("signale un total annoncé faux et n'invente pas un prix manquant", () => {
    const gap = parseOrder(GAP_ORDER, "d2", "Écart");
    const messages = anomaliesOf(gap, [], 18).map((item) => item.code);
    assert.ok(messages.includes("total_divergent"));
    const missing = parseOrder(DELIVERY_ORDER, "d3", "Livraison");
    const codes = anomaliesOf(missing, [], 18).map((item) => item.code);
    assert.deepEqual(codes.sort(), ["echeance_absente", "livraison_ecart", "prix_absent"].sort());
    assert.equal(missing.lines[0].unitPriceCfa, null);
    assert.equal(missing.lines[0].deliveredQty, 18);
  });

  it("bloque un client inconnu et un prix hors catalogue tant qu'une personne ne tranche pas", () => {
    const odd = parseOrder(UNKNOWN_ORDER, "d4", "Inconnu");
    assert.equal(odd.clientId, null);
    assert.equal(odd.clientCity, null);
    const codes = anomaliesOf(odd, [], 18).map((item) => item.code);
    assert.ok(codes.includes("client_inconnu"));
    assert.ok(codes.includes("prix_inhabituel"));
    let state = createBillingState();
    state = reduceBilling(state, { type: "parse", text: UNKNOWN_ORDER, label: "Inconnu" });
    state = reduceBilling(state, { type: "confirm", confirmed: true });
    const refused = reduceBilling(state, { type: "validate" });
    assert.equal(refused.issued.length, 0);
  });

  it("laisse la facture intacte quand un avoir est établi, et le sceau refuse une modification", () => {
    const issued = reduceBilling(readyClean(), { type: "validate" });
    const original = JSON.stringify(issued.issued[0]);
    const credited = reduceBilling(issued, { type: "credit", documentId: issued.issued[0].id });
    assert.equal(JSON.stringify(credited.issued[0]), original);
    assert.equal(credited.issued[1].kind, "avoir");
    assert.equal(credited.issued[1].linkedNumber, credited.issued[0].number);
    const changed = { ...issued.issued[0], clientName: "Autre client", lines: issued.issued[0].lines.map((line) => ({ ...line, qty: line.qty + 1 })) };
    assert.notEqual(invoiceFingerprint(changed), invoiceFingerprint(issued.issued[0]));
    assert.match(issued.issued[0].sceau, /^[A-Za-z0-9_-]{20,}$/);
  });
});
