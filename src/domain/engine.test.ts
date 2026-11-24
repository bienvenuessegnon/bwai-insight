import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateClassifier } from "./classifier";
import { formatCfa } from "./format";
import { importPortfolio } from "./import-portfolio";
import { positionOf } from "./ledger";
import { decide, referenceComparison } from "./preflight";
import { rankAll } from "./priority";
import { reduce } from "./reduce";
import { createInitialState, RAW_PORTFOLIO } from "./seed";
import type { PrimaryStatus } from "./types";

const EXPECTED: Record<string, PrimaryStatus> = {
  "fac-1001": "soldee",
  "fac-1002": "soldee",
  "fac-1042": "soldee",
  "fac-1088": "soldee",
  "fac-1090": "soldee",
  "fac-1108": "echue",
  "fac-1114": "partiellement_payee",
  "fac-1120": "echue",
  "fac-1122": "contestee",
  "fac-1130": "echeancier",
  "fac-1133": "echue",
  "fac-1138": "non_echue",
  "fac-1140": "soldee",
  "fac-1144": "echue",
  "fac-1150": "echue",
  "fac-1155": "echue",
  "fac-1160": "partiellement_payee",
};

function balance(state: ReturnType<typeof createInitialState>, invoiceId: string) {
  const invoice = state.portfolio.invoices.find((item) => item.id === invoiceId);
  assert.ok(invoice);
  return positionOf(state.portfolio, invoice, state.settings.referenceDate);
}

describe("import et grand livre", () => {
  it("refuse doublon, ligne sans client, montant illisible, paiement orphelin et échéancier incohérent", () => {
    const { portfolio, issues } = importPortfolio(RAW_PORTFOLIO);
    assert.equal(portfolio.invoices.filter((invoice) => invoice.id === "fac-1150").length, 1);
    assert.equal(portfolio.invoices.some((invoice) => invoice.id === "ligne-18"), false);
    assert.equal(portfolio.invoices.some((invoice) => invoice.id === "fac-neg"), false);
    assert.equal(portfolio.payments.some((payment) => payment.id === "pay-orphelin"), false);
    assert.equal(portfolio.schedules.some((schedule) => schedule.id === "ech-mauvais"), false);
    assert.ok(issues.some((item) => item.code === "doublon" && item.id === "fac-1150"));
    assert.ok(issues.some((item) => item.id === "ligne-18"));
    assert.ok(issues.some((item) => item.id === "pay-orphelin"));
    assert.ok(issues.some((item) => item.code === "echeancier_incoherent"));
  });

  it("calcule des statuts et des soldes reproductibles au 24 novembre 2026", () => {
    const state = createInitialState();
    for (const [id, status] of Object.entries(EXPECTED)) {
      assert.equal(balance(state, id).status, status, id);
    }
    assert.equal(balance(state, "fac-1114").balanceCfa, 140_000);
    assert.equal(balance(state, "fac-1114").daysOverdue, 12);
    assert.equal(balance(state, "fac-1140").balanceCfa, 0);
    assert.equal(balance(state, "fac-1130").balanceCfa, 200_000);
    assert.equal(balance(state, "fac-1160").actionable, false);
    assert.equal(balance(state, "fac-1108").daysOverdue, 35);
    assert.equal(balance(state, "fac-1120").nominalDays, 40);
  });

  it("classe deux fois de la même façon, sans présenter le score comme une probabilité", () => {
    const state = createInitialState();
    const first = rankAll(state).map((item) => [item.invoiceId, item.score]);
    const second = rankAll(state).map((item) => [item.invoiceId, item.score]);
    assert.deepEqual(first, second);
    for (const item of rankAll(state)) {
      assert.ok(item.score >= 0 && item.score <= 1);
    }
  });
});

describe("pré-vol, humain et idempotence", () => {
  it("n'envoie pas une facture soldée, un échéancier, une contestation ni un gros montant", () => {
    const state = createInitialState();
    assert.equal(decide(state, "fac-1042").decision, "annuler");
    assert.equal(decide(state, "fac-1140").reasonCode, "solde_nul");
    assert.equal(decide(state, "fac-1130").reasonCode, "echeancier");
    assert.equal(decide(state, "fac-1138").reasonCode, "pas_echu");
    assert.equal(decide(state, "fac-1122").reasonCode, "litige");
    assert.equal(decide(state, "fac-1120").reasonCode, "seuil");
    assert.equal(decide(state, "fac-1114").decision, "envoyer");
    assert.equal(decide(state, "fac-1114").step, 2);
  });

  it("prépare deux fois sans doubler les envois", () => {
    const once = reduce(createInitialState(), { type: "prepare" });
    const twice = reduce(once, { type: "prepare" });
    const sentOnce = once.journal.filter((entry) => entry.kind === "relance_envoyee" && entry.id.startsWith("j-"));
    const sentTwice = twice.journal.filter((entry) => entry.kind === "relance_envoyee" && entry.id.startsWith("j-"));
    assert.deepEqual(sentOnce.map((entry) => entry.idempotencyKey), sentTwice.map((entry) => entry.idempotencyKey));
    const keys = sentTwice.map((entry) => entry.idempotencyKey);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(twice.journal.length, once.journal.length);
    const read = reduce(createInitialState(), { type: "classifyAll" });
    const prepared = reduce(read, { type: "prepare" });
    const replayed = reduce(prepared, { type: "prepare" });
    assert.equal(replayed.journal.length, prepared.journal.length);
    assert.equal(decide(prepared, "fac-1120").reasonCode, "seuil");
    const afterSibling = reduce(prepared, { type: "approve", invoiceId: "fac-1120" });
    assert.equal(
      afterSibling.journal.some((entry) => entry.invoiceId === "fac-1120" && entry.kind === "relance_envoyee"),
      true,
    );
  });

  it("après lecture des messages, protège la promesse et le paiement annoncé", () => {
    const state = reduce(createInitialState(), { type: "classifyAll" });
    assert.equal(decide(state, "fac-1133").reasonCode, "promesse");
    assert.equal(decide(state, "fac-1114").reasonCode, "paiement_annonce");
    assert.equal(decide(state, "fac-1042").reasonCode, "solde_nul");
    const before = balance(createInitialState(), "fac-1114").balanceCfa;
    const after = balance(state, "fac-1114").balanceCfa;
    assert.equal(before, after);
  });

  it("une coupure met la file en local, un paiement annule la relance à la reprise", () => {
    const trapped = reduce(createInitialState(), { type: "playPaymentTrap", invoiceId: "fac-1155" });
    assert.equal(trapped.settings.offline, false);
    assert.equal(trapped.outbox.length, 0);
    assert.equal(balance(trapped, "fac-1155").balanceCfa, 0);
    assert.equal(
      trapped.journal.some((entry) => entry.invoiceId === "fac-1155" && entry.kind === "relance_envoyee"),
      false,
    );
    assert.equal(
      trapped.journal.some((entry) => entry.invoiceId === "fac-1155" && entry.kind === "relance_annulee"),
      true,
    );
    const sent = trapped.journal.filter((entry) => entry.kind === "relance_envoyee" && entry.id.startsWith("j-"));
    const keys = sent.map((entry) => entry.idempotencyKey);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("refuse d'approuver un litige et laisse partir un gros montant seulement après accord", () => {
    const refused = reduce(createInitialState(), { type: "approve", invoiceId: "fac-1122" });
    assert.equal(
      refused.journal.some((entry) => entry.invoiceId === "fac-1122" && entry.kind === "relance_envoyee"),
      false,
    );
    assert.match(refused.journal.at(-1)?.summary ?? "", /refusée/);
    const approved = reduce(createInitialState(), { type: "approve", invoiceId: "fac-1120" });
    const sent = approved.journal.find((entry) => entry.invoiceId === "fac-1120" && entry.kind === "relance_envoyee");
    assert.ok(sent);
    const draft = decide(approved, "fac-1120");
    assert.equal(draft.decision, "deja_traite");
    const prepared = decide(
      { ...createInitialState(), approvals: [{ invoiceId: "fac-1120", step: 1 }] },
      "fac-1120",
    );
    assert.equal(prepared.decision, "envoyer");
    assert.ok(prepared.message?.includes(`régler exactement ${formatCfa(850_000)}`));
    assert.ok(prepared.message?.includes("FICTIF-MOMO-FAC-2026-1120"));
  });

  it("un second encaissement du même solde ne crée pas un second paiement", () => {
    const once = reduce(createInitialState(), { type: "pay", invoiceId: "fac-1155", amountCfa: 38_000 });
    const twice = reduce(once, { type: "pay", invoiceId: "fac-1155", amountCfa: 38_000 });
    assert.equal(balance(twice, "fac-1155").balanceCfa, 0);
    assert.equal(twice.portfolio.payments.filter((payment) => payment.invoiceId === "fac-1155").length, 1);
  });

  it("respecte une préférence de ne pas être contacté", () => {
    const state = createInitialState();
    state.portfolio.clients = state.portfolio.clients.map((client) =>
      client.id === "cli-sena" ? { ...client, optOut: true } : client,
    );
    assert.equal(decide(state, "fac-1108").reasonCode, "opt_out");
  });

  it("compte les erreurs qu'une relance Excel aurait commises", () => {
    const comparison = referenceComparison(createInitialState());
    assert.ok(comparison.naiveErrors.length >= 8);
    assert.ok(comparison.naiveErrors.some((item) => item.invoiceId === "fac-1042"));
    assert.ok(comparison.naiveErrors.some((item) => item.invoiceId === "fac-1122"));
    assert.ok(comparison.naiveErrors.some((item) => item.invoiceId === "fac-1130"));
    assert.ok(comparison.ourSendCount < comparison.referenceCount);
  });
});

describe("classifieur", () => {
  it("sépare son score du calcul des francs et reste mesurable", () => {
    const evaluation = evaluateClassifier();
    assert.ok(evaluation.accuracy >= 0.8, JSON.stringify(evaluation.rows.filter((row) => !row.hit)));
    assert.equal(evaluation.total, 17);
  });
});
