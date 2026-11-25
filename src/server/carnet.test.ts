import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCarnet } from "./carnet";

describe("moteur servi", () => {
  it("calcule l'encours, le retard et les erreurs qu'une date seule enverrait", () => {
    const opened = runCarnet({ state: null, action: null });
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    assert.ok(opened.view.encoursCfa > 0);
    assert.ok(opened.view.retardCount > 0);
    assert.equal(opened.view.erreursEvitees, 8);
    assert.equal(opened.view.rows.some((row) => row.order === 1), true);
    assert.equal(opened.view.rows.some((row) => /\d,\d\d/.test(row.balanceLabel)), false);
  });

  it("prépare les relances sur le serveur et n'écrit pas un second envoi", () => {
    const opened = runCarnet({ state: null, action: { type: "classifyAll" } });
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const prepared = runCarnet({ state: opened.state, action: { type: "prepare" } });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    assert.ok(prepared.view.letters.some((letter) => letter.stateLabel === "Envoyée"));
    assert.equal(
      prepared.view.letters.some((letter) => letter.invoiceId === "fac-1114"),
      false,
    );
    assert.ok(prepared.view.reviews.some((item) => item.id === "fac-1114"));
    assert.ok(prepared.view.aValider > 0);
    assert.ok(prepared.view.relancesParties > 0);
    const again = runCarnet({ state: prepared.state, action: { type: "prepare" } });
    assert.equal(again.ok, true);
    if (!again.ok) return;
    assert.equal(again.view.relancesParties, prepared.view.relancesParties);
  });

  it("refuse un carnet illisible et un règlement diminue l'encours", () => {
    const refused = runCarnet({ state: { version: 1 }, action: null });
    assert.equal(refused.ok, false);
    const opened = runCarnet({ state: null, action: null });
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const target = opened.view.rows.find((row) => row.id === "fac-1155");
    assert.ok(target);
    const paid = runCarnet({
      state: opened.state,
      action: { type: "pay", invoiceId: "fac-1155", amountCfa: opened.view.dossiers.find((item) => item.id === "fac-1155")?.balanceCfa },
    });
    assert.equal(paid.ok, true);
    if (!paid.ok) return;
    assert.ok(paid.view.encoursCfa < opened.view.encoursCfa);
    const dossier = paid.view.dossiers.find((item) => item.id === "fac-1155");
    assert.equal(dossier?.balanceCfa, 0);
    assert.match(dossier?.formula ?? "", /Solde =/);
  });
});
