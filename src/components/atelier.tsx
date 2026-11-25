"use client";

import { Fraunces } from "next/font/google";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CLEAN_ORDER, DELIVERY_ORDER, GAP_ORDER, UNKNOWN_ORDER } from "@/domain/billing/catalog";
import type { BillingAction } from "@/domain/billing/reduce";
import { BILLING_VERSION, type BillingState } from "@/domain/billing/types";
import type { BillingView, IssuedCard, Sheet } from "@/shared/invoice";

const display = Fraunces({ subsets: ["latin"], weight: ["500", "600"] });

const STORAGE_KEY = "adjovi-factures-v1";

const SAMPLES = [
  { label: "Commande propre", text: CLEAN_ORDER },
  { label: "Total à vérifier", text: GAP_ORDER },
  { label: "Livraison incomplète", text: DELIVERY_ORDER },
  { label: "Client inconnu", text: UNKNOWN_ORDER },
];

function stored(value: unknown): BillingState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as BillingState;
  if (state.version !== BILLING_VERSION || !Array.isArray(state.issued)) return null;
  return state;
}

export function Atelier() {
  const [state, setState] = useState<BillingState | null>(null);
  const [view, setView] = useState<BillingView | null>(null);
  const [text, setText] = useState(CLEAN_ORDER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  async function exchange(current: BillingState | null, action: BillingAction | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/factures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: current, action }),
      });
      const payload = (await response.json()) as { state?: BillingState; view?: BillingView; error?: string };
      if (!response.ok || !payload.state || !payload.view) {
        setError(payload.error ?? "Le moteur n'a pas pu mettre la facture en forme.");
        return;
      }
      setState(payload.state);
      setView(payload.view);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.state));
    } catch {
      setError("Le moteur de facturation ne répond pas.");
    } finally {
      setBusy(false);
      setReady(true);
    }
  }

  useEffect(() => {
    let initial: BillingState | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) initial = stored(JSON.parse(raw));
    } catch {
      initial = null;
    }
    void exchange(initial, null);
  }, []);

  function dispatch(action: BillingAction) {
    if (!state || busy) return;
    void exchange(state, action);
  }

  async function download(documentId: string) {
    const document = state?.issued.find((item) => item.id === documentId);
    if (!document) return;
    setNotice(null);
    const response = await fetch("/api/factures/pdf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sceau: document.sceau }),
    });
    if (!response.ok) {
      setError("Le PDF n'a pas pu être scellé.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${document.number}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function share(card: IssuedCard) {
    const url = `${window.location.origin}/verifier?sceau=${encodeURIComponent(card.sceau)}`;
    const payload = { title: card.number, text: `${card.number} · ${card.clientName} · ${card.totalLabel}`, url };
    if (navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* L'utilisateur a fermé la feuille de partage. */
      }
    }
    await navigator.clipboard.writeText(url);
    setNotice("Lien de vérification copié.");
  }

  if (!ready || !view || !state) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4efe6] px-6">
        <p className="text-sm text-[#5c5346]">{error ?? "Ouverture de l'atelier…"}</p>
      </main>
    );
  }

  const latest = view.issued[0] ?? null;

  return (
    <div className="min-h-screen bg-[#efe7da] text-[#1a2744]">
      <header className="no-print mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <p className="text-xs tracking-[0.16em] text-[#7a6a52] uppercase">Maison Adjovi & Fils</p>
          <h1 className={`${display.className} text-3xl`}>Atelier facture</h1>
        </div>
        <Link className="text-sm underline-offset-4 hover:underline" href="/recouvrement">
          Recouvrement
        </Link>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="no-print space-y-4">
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((sample) => (
              <button
                key={sample.label}
                type="button"
                className="rounded-full border border-[#d9cbb6] bg-white/70 px-3 py-1 text-sm hover:bg-white"
                onClick={() => {
                  setText(sample.text);
                  dispatch({ type: "parse", text: sample.text, label: sample.label });
                }}
              >
                {sample.label}
              </button>
            ))}
          </div>
          <label className="block text-sm" htmlFor="message">
            Message, devis ou bon
            <textarea
              id="message"
              className="mt-1 min-h-52 w-full rounded-xl border border-[#d9cbb6] bg-white p-3 text-sm leading-relaxed"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <Button type="button" size="lg" disabled={busy} onClick={() => dispatch({ type: "parse", text, label: "Message collé" })}>
            Mettre en forme
          </Button>
          <p className="text-xs text-[#7a6a52]">La mise en page est immédiate. Un champ absent reste vide.</p>
          {error && <p className="text-sm text-red-800" role="alert">{error}</p>}
          {notice && <p className="text-sm">{notice}</p>}
          {view.sheet && <Anomalies sheet={view.sheet} busy={busy} onAction={dispatch} />}
          {view.journal.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold">Journal</h2>
              <ul className="mt-2 space-y-1 text-sm text-[#3d4a63]">
                {view.journal.slice(0, 6).map((entry) => (
                  <li key={entry.id}>{entry.summary}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section>
          {view.sheet ? (
            <DraftSheet sheet={view.sheet} busy={busy} taxRate={view.taxRate} onAction={dispatch} />
          ) : latest ? (
            <IssuedSheet card={latest} onDownload={() => void download(latest.id)} onShare={() => void share(latest)} onCredit={() => dispatch({ type: "credit", documentId: latest.id })} />
          ) : (
            <p className="rounded-xl border border-dashed border-[#d9cbb6] px-4 py-16 text-center text-sm text-[#7a6a52]">
              Collez une commande. La feuille apparaît ici.
            </p>
          )}
          {view.issued.length > 1 && (
            <ul className="no-print mt-4 space-y-2 text-sm">
              {view.issued.slice(view.sheet ? 0 : 1).map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2">
                  <span>
                    {item.kind === "avoir" ? "Avoir" : "Facture"} {item.number} · {item.clientName} · {item.totalLabel}
                  </span>
                  <button type="button" className="underline-offset-4 hover:underline" onClick={() => void download(item.id)}>
                    PDF
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Anomalies({ sheet, busy, onAction }: { sheet: Sheet; busy: boolean; onAction: (action: BillingAction) => void }) {
  if (sheet.anomalies.length === 0) return <p className="text-sm text-[#0e6b4f]">Aucun écart. Les montants affichés sont ceux du recalcul.</p>;
  return (
    <ul className="space-y-2">
      {sheet.anomalies.map((item) => (
        <li key={item.code} className="rounded-lg bg-white px-3 py-2 text-sm">
          <p>{item.message}</p>
          {item.code === "client_inconnu" && (
            <Button type="button" className="mt-2" variant="outline" disabled={busy} onClick={() => onAction({ type: "acceptUnknownClient" })}>
              Retenir ce nom
            </Button>
          )}
          {item.code === "prix_inhabituel" && (
            <Button type="button" className="mt-2" variant="outline" disabled={busy} onClick={() => onAction({ type: "acceptUnusualPrice" })}>
              Confirmer le prix écrit
            </Button>
          )}
          {item.code === "total_divergent" && (
            <Button type="button" className="mt-2" variant="outline" disabled={busy} onClick={() => onAction({ type: "acceptAnnouncedGap" })}>
              Garder le total recalculé
            </Button>
          )}
          {item.code === "livraison_ecart" && (
            <Button type="button" className="mt-2" variant="outline" disabled={busy} onClick={() => onAction({ type: "billDelivered" })}>
              Facturer la quantité livrée
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function DraftSheet({
  sheet,
  busy,
  taxRate,
  onAction,
}: {
  sheet: Sheet;
  busy: boolean;
  taxRate: number;
  onAction: (action: BillingAction) => void;
}) {
  return (
    <article id="feuille" className="overflow-hidden rounded-sm bg-[#fffaf3] shadow-[0_20px_50px_rgba(26,39,68,0.12)]">
      <header className="flex items-end justify-between bg-[#1a2744] px-6 py-5 text-[#fffaf3]">
        <div>
          <p className="text-xs tracking-[0.18em] uppercase">Quincaillerie · Cotonou</p>
          <h2 className={`${display.className} text-3xl`}>Maison Adjovi & Fils</h2>
        </div>
        <p className={`${display.className} text-2xl text-[#f0d48a]`}>Brouillon</p>
      </header>
      <div className="space-y-5 px-6 py-6">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="text-xs text-[#7a6a52]">Client · {sheet.clientNote}</p>
            <p className={`${display.className} text-2xl`}>{sheet.clientName ?? "Client non lu"}</p>
            <p className="text-sm text-[#5c5346]">{sheet.clientCity ?? "Adresse non écrite"}</p>
          </div>
          <div className="text-sm text-[#5c5346]">
            <p>{sheet.dueLabel ? `Échéance ${sheet.dueLabel}` : "Échéance absente"}</p>
            <p>{sheet.terms ?? "Condition non écrite"}</p>
            <p>Source : {sheet.sourceLabel}</p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs tracking-wide text-[#0e6b4f] uppercase">
            <tr>
              <th className="py-2 font-medium">Désignation</th>
              <th className="py-2 font-medium">Qté</th>
              <th className="py-2 text-right font-medium">Prix</th>
              <th className="py-2 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody>
            {sheet.lines.map((line) => (
              <tr key={line.id} className="border-t border-[#eadfce]">
                <td className="py-2">
                  {line.designation}
                  {line.confidence !== "Sûr" ? <span className="block text-xs text-[#7a6a52]">{line.confidence}</span> : null}
                </td>
                <td className="py-2 tabular-nums">
                  {line.qty ?? "—"}
                  {line.deliveredQty !== null ? <span className="block text-xs">Livré {line.deliveredQty}</span> : null}
                </td>
                <td className="py-2 text-right">
                  {line.unitPriceCfa === null && line.id ? (
                    <PriceField disabled={busy} onCommit={(unitPriceCfa) => onAction({ type: "setPrice", lineId: line.id!, unitPriceCfa })} />
                  ) : (
                    <span className="tabular-nums">{line.unitLabel}</span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">{line.lineLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sheet.dueOn && (
          <label className="no-print block text-sm" htmlFor="echeance">
            Échéance
            <input
              id="echeance"
              type="date"
              className="mt-1 rounded-md border border-[#d9cbb6] bg-white px-2 py-1"
              onChange={(event) => {
                if (event.target.value) onAction({ type: "setDue", dueOn: event.target.value });
              }}
            />
          </label>
        )}
        <Totals
          rows={[
            ["Sous-total", sheet.subtotalLabel],
            [draftDiscount(sheet.discountLabel), sheet.discountAmountLabel],
            [`TVA ${taxRate} %`, sheet.taxLabel],
          ]}
          total={sheet.totalLabel}
        />
        {sheet.announcedLabel && <p className="text-sm text-[#7a6a52]">Total écrit dans le message : {sheet.announcedLabel}. La feuille retient le recalcul.</p>}
        <div className="no-print flex flex-wrap items-center gap-3 border-t border-[#eadfce] pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sheet.confirmed} onChange={(event) => onAction({ type: "confirm", confirmed: event.target.checked })} />
            Je confirme les valeurs lues
          </label>
          <Button type="button" disabled={busy || !sheet.canValidate} onClick={() => onAction({ type: "validate" })}>
            Valider et émettre
          </Button>
        </div>
      </div>
    </article>
  );
}

function IssuedSheet({
  card,
  onDownload,
  onShare,
  onCredit,
}: {
  card: IssuedCard;
  onDownload: () => void;
  onShare: () => void;
  onCredit: () => void;
}) {
  return (
    <article id="feuille" className="overflow-hidden rounded-sm bg-[#fffaf3] shadow-[0_20px_50px_rgba(26,39,68,0.12)]">
      <header className="flex items-end justify-between bg-[#1a2744] px-6 py-5 text-[#fffaf3]">
        <div>
          <p className="text-xs tracking-[0.18em] uppercase">Quincaillerie · Cotonou</p>
          <h2 className={`${display.className} text-3xl`}>Maison Adjovi & Fils</h2>
        </div>
        <div className="text-right">
          <p className={`${display.className} text-2xl text-[#f0d48a]`}>{card.kind === "avoir" ? "Avoir" : "Facture"}</p>
          <p className="text-sm">{card.number}</p>
        </div>
      </header>
      <div className="grid gap-6 px-6 py-6 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div>
          <p className={`${display.className} text-2xl`}>{card.clientName}</p>
          <p className="text-sm text-[#5c5346]">{card.clientCity ?? "Sans adresse au référentiel"}</p>
          <p className="mt-1 text-sm text-[#5c5346]">
            Émise le {card.issuedOnLabel}
            {card.dueLabel ? ` · échéance ${card.dueLabel}` : ""}
            {card.linkedNumber ? ` · liée à ${card.linkedNumber}` : ""}
          </p>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {card.lines.map((line) => (
                <tr key={line.designation} className="border-t border-[#eadfce]">
                  <td className="py-2">{line.designation}</td>
                  <td className="py-2 tabular-nums">{line.qty}</td>
                  <td className="py-2 text-right tabular-nums">{line.unitLabel}</td>
                  <td className="py-2 text-right tabular-nums">{line.lineLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4">
            <Totals
              rows={[
                ["Sous-total", card.subtotalLabel],
                ["Remise", card.discountAmountLabel],
                ["TVA", card.taxLabel],
              ]}
              total={card.totalLabel}
            />
          </div>
        </div>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.qrDataUrl} alt={`QR de vérification de ${card.number}`} className="mx-auto h-36 w-36" />
          <p className="mt-2 text-xs text-[#5c5346]">Scanner pour vérifier</p>
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfce] px-6 py-4 text-xs text-[#7a6a52]">
        <p>Mobile Money de démonstration, référence FICTIF. Aucun paiement réel.</p>
        <div className="no-print flex gap-2">
          <Button type="button" onClick={onDownload}>Télécharger</Button>
          <Button type="button" variant="outline" onClick={onShare}>Partager</Button>
          <Button type="button" variant="outline" onClick={() => window.print()}>Imprimer</Button>
          {card.kind === "facture" && (
            <Button type="button" variant="ghost" onClick={onCredit}>Établir un avoir</Button>
          )}
        </div>
      </footer>
    </article>
  );
}

function draftDiscount(label: string): string {
  return label === "Aucune remise écrite" ? "Remise" : `Remise ${label}`;
}

function Totals({ rows, total }: { rows: [string, string][]; total: string }) {
  return (
    <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
      {rows.map(([name, value]) => (
        <p key={name} className="flex justify-between gap-4 text-[#5c5346]">
          <span>{name}</span>
          <span className="tabular-nums">{value}</span>
        </p>
      ))}
      <p className={`${display.className} flex justify-between gap-4 border-t border-[#eadfce] pt-2 text-2xl text-[#0e6b4f]`}>
        <span>Total</span>
        <span className="tabular-nums">{total}</span>
      </p>
    </div>
  );
}

function PriceField({ disabled, onCommit }: { disabled: boolean; onCommit: (value: number) => void }) {
  const [value, setValue] = useState("");
  return (
    <input
      aria-label="Prix unitaire en francs CFA"
      inputMode="numeric"
      disabled={disabled}
      className="w-28 rounded-md border border-[#d9cbb6] bg-white px-2 py-1 text-right"
      placeholder="Prix"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => {
        const next = Number(value.replace(/[^\d]/g, ""));
        if (Number.isInteger(next) && next > 0) onCommit(next);
      }}
    />
  );
}
