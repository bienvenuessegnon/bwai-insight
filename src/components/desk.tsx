"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Action } from "@/domain/reduce";
import type { AppState, ChannelMode, PrimaryStatus } from "@/domain/types";
import { STATE_VERSION } from "@/domain/types";
import type { Dashboard, DeskSection, DossierView } from "@/shared/dashboard";

const STORAGE_KEY = "deuxieme-regard-v1";

const NAV: { id: DeskSection; label: string }[] = [
  { id: "tableau", label: "Tableau" },
  { id: "relances", label: "Relances" },
  { id: "validation", label: "À valider" },
  { id: "journal", label: "Journal" },
  { id: "reglages", label: "Réglages" },
];

function storedState(value: unknown): AppState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as AppState;
  if (state.version !== STATE_VERSION || !Array.isArray(state.portfolio?.invoices) || !Array.isArray(state.journal)) {
    return null;
  }
  return state;
}

function statusClass(status: PrimaryStatus): string {
  if (status === "echue" || status === "contestee") return "bg-red-50 text-red-900 border-red-100";
  if (status === "soldee" || status === "echeancier") return "bg-emerald-50 text-emerald-950 border-emerald-100";
  if (status === "partiellement_payee") return "bg-amber-50 text-amber-950 border-amber-100";
  return "bg-muted text-muted-foreground border-transparent";
}

export function Desk() {
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState<Dashboard | null>(null);
  const [section, setSection] = useState<DeskSection>("tableau");
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [ready, setReady] = useState(false);

  async function exchange(current: AppState | null, action: Action | null, fromDisk = false) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/carnet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: current, action }),
      });
      const payload = (await response.json()) as { state?: AppState; view?: Dashboard; error?: string };
      if (!response.ok || !payload.state || !payload.view) {
        setLinked(false);
        setError(payload.error ?? "Le moteur n'a pas pu recalculer le portefeuille.");
        return;
      }
      setState(payload.state);
      setView(payload.view);
      setLinked(true);
      if (fromDisk) setResumed(true);
      if (action?.type === "reset") setResumed(false);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.state));
    } catch {
      setLinked(false);
      setError("Le moteur de calcul ne répond pas. Aucun chiffre n'a été inventé sur cet écran.");
    } finally {
      setBusy(false);
      setReady(true);
    }
  }

  useEffect(() => {
    let initial: AppState | null = null;
    let fromDisk = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        initial = storedState(JSON.parse(raw));
        fromDisk = initial !== null;
      }
    } catch {
      initial = null;
    }
    void exchange(initial, null, fromDisk);
  }, []);

  function dispatch(action: Action) {
    if (!state || busy) return;
    void exchange(state, action);
  }

  function openInvoice(id: string) {
    setInvoiceId(id);
    setSection("dossier");
  }

  if (!ready || !view) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">
          {error ?? "Ouverture du portefeuille et calcul des soldes…"}
        </p>
      </main>
    );
  }

  const dossier = view.dossiers.find((item) => item.id === invoiceId) ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-border bg-card lg:border-r lg:border-b-0">
          <div className="px-4 py-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Quincaillerie</p>
            <p className="mt-1 text-base font-semibold">{view.company}</p>
            <p className="text-sm text-muted-foreground">{view.city}</p>
          </div>
          <nav className="flex flex-wrap gap-1 px-3 pb-3 lg:flex-col lg:flex-nowrap" aria-label="Sections">
            {NAV.map((item) => {
            const count =
              item.id === "validation" ? view.aValider : item.id === "relances" ? view.letters.length : null;
              const active = section === item.id || (section === "dossier" && item.id === "tableau");
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex h-9 items-center justify-between rounded-md px-3 text-sm lg:w-full ${
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  onClick={() => setSection(item.id)}
                >
                  <span>{item.label}</span>
                  {count ? <span className="ml-3 text-xs tabular-nums">{count}</span> : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h1 className="text-lg font-semibold">Recouvrement clients</h1>
              <p className="text-sm text-muted-foreground">Situation au {view.asOfLabel}. Soldes en francs CFA entiers.</p>
            </div>
            <p className={`text-sm ${linked ? "text-primary" : "text-destructive"}`}>
              {linked ? "Moteur de calcul relié" : "Moteur injoignable"}
              {busy ? " · calcul…" : ""}
            </p>
          </header>

          <div className="space-y-4 px-4 py-5 sm:px-6">
            {resumed && (
              <p className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                Carnet repris sur cet appareil. Les soldes viennent d'être recalculés par le serveur.
              </p>
            )}
            {view.offline && (
              <p className="rounded-md border border-border bg-accent px-3 py-2 text-sm">
                Liaison coupée. {view.fileLocale} relance{view.fileLocale > 1 ? "s" : ""} reste{view.fileLocale > 1 ? "nt" : ""} dans l'appareil. Au retour, chaque solde est relu avant envoi.
              </p>
            )}
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            {section !== "reglages" && section !== "dossier" && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="lg" disabled={busy || !linked} onClick={() => dispatch({ type: "classifyAll" })}>
                  Lire les réponses
                </Button>
                <Button type="button" size="lg" variant="outline" disabled={busy || !linked} onClick={() => dispatch({ type: "prepare" })}>
                  Préparer les relances
                </Button>
              </div>
            )}

            {section === "tableau" && <Board view={view} onOpen={openInvoice} />}
            {section === "relances" && (
              <Letters view={view} onOpen={openInvoice} onFlush={() => dispatch({ type: "flush" })} busy={busy || !linked} />
            )}
            {section === "validation" && <Reviews view={view} busy={busy || !linked} onOpen={openInvoice} onAction={dispatch} />}
            {section === "journal" && <Journal view={view} />}
            {section === "reglages" && <Settings view={view} busy={busy || !linked} onAction={dispatch} />}
            {section === "dossier" && (
              <Dossier
                dossier={dossier}
                busy={busy || !linked}
                onBack={() => setSection("tableau")}
                onAction={dispatch}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Board({ view, onOpen }: { view: Dashboard; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Encours" value={view.encoursLabel} hint="Somme des soldes encore dus" />
        <Kpi label="En retard" value={view.retardLabel} hint={`${view.retardCount} facture${view.retardCount > 1 ? "s" : ""} à traiter`} />
        <Kpi label="À valider" value={String(view.aValider)} hint="Litige, gros montant ou réponse à clarifier" />
        <Kpi label="Règlements" value={view.reglementsLabel} hint={`${view.reglementsCount} encaissements, tous fictifs`} />
      </section>

      <section className="rounded-lg border border-border bg-card px-4 py-3 text-sm leading-relaxed">
            <h2 className="text-sm font-semibold">Ce qu'il faut retenir</h2>
        <p className="mt-1 text-muted-foreground">
          Un tri sur la date seule relancerait {view.referenceCount} factures. {view.erreursEvitees} partiraient à tort : déjà réglées, contestées, ou tenues par un échéancier. Elles ne reçoivent pas de message.{" "}
          {view.aValider === 0
            ? "Aucun dossier n'attend une personne"
            : `${view.aValider} dossier${view.aValider > 1 ? "s" : ""} attend${view.aValider > 1 ? "ent" : ""} une personne`}
          {view.suspendues === 0
            ? ", et aucune action n'est suspendue."
            : `, et ${view.suspendues} action${view.suspendues > 1 ? "s sont suspendues" : " est suspendue"}.`}
        </p>
      </section>

      <section className="max-w-full overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Créances, les plus urgentes d'abord</h2>
          <p className="text-xs text-muted-foreground">Ancienneté, montant, retards déjà observés</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <caption className="sr-only">Portefeuille au {view.asOfLabel}</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Ordre</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Facture</th>
                <th className="px-3 py-2 font-medium">Échéance</th>
                <th className="px-3 py-2 font-medium">Retard</th>
                <th className="px-3 py-2 text-right font-medium">Solde</th>
                <th className="px-3 py-2 font-medium">Situation</th>
                <th className="px-4 py-2 font-medium">Suite</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{row.order ?? "—"}</td>
                  <td className="px-3 py-2.5">{row.clientName}</td>
                  <td className="px-3 py-2.5">
                    <button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => onOpen(row.id)}>
                      {row.number}
                    </button>
                    <span className="block text-xs text-muted-foreground">{row.label}</span>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{row.dueLabel}</td>
                  <td className="px-3 py-2.5 tabular-nums">{row.daysOverdue > 0 ? `${row.daysOverdue} j` : "—"}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{row.balanceLabel}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className={statusClass(row.status)}>
                      {row.statusLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">{row.nextStep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {view.refused.length > 0 && (
        <section className="rounded-lg border border-border bg-card px-4 py-3">
          <h2 className="text-sm font-semibold">Lignes écartées à l'import</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {view.refused.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}

function Letters({
  view,
  onOpen,
  onFlush,
  busy,
}: {
  view: Dashboard;
  onOpen: (id: string) => void;
  onFlush: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {view.relancesParties} relance{view.relancesParties > 1 ? "s" : ""} déjà inscrite{view.relancesParties > 1 ? "s" : ""} au journal. Un second passage n'en ajoute pas.
        </p>
        <Button type="button" variant="outline" disabled={busy || view.fileLocale === 0 || view.offline} onClick={onFlush}>
          Reprendre la file locale ({view.fileLocale})
        </Button>
      </div>
      {view.letters.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
          Aucune relance prête. Lisez d'abord les réponses, puis préparez. Une facture soldée, contestée ou couverte par un échéancier n'est pas écrite.
        </p>
      ) : (
        view.letters.map((letter) => (
          <article key={letter.id} className="rounded-lg border border-border bg-card">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">
                {letter.clientName} · {letter.number}
              </h2>
              <p className="text-sm text-muted-foreground">
                {letter.channelLabel} · {letter.balanceLabel} · {letter.stateLabel}
              </p>
            </header>
            <p className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">{letter.message}</p>
            <div className="px-4 pb-3">
              <Button type="button" variant="ghost" onClick={() => onOpen(letter.invoiceId)}>
                Ouvrir le dossier
              </Button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function Reviews({
  view,
  busy,
  onOpen,
  onAction,
}: {
  view: Dashboard;
  busy: boolean;
  onOpen: (id: string) => void;
  onAction: (action: Action) => void;
}) {
  if (view.reviews.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
        Rien n'attend une personne. Un litige, un montant au-dessus de {view.seuilLabel} ou une réponse ambiguë s'arrête ici, avant tout envoi.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {view.reviews.map((item) => (
        <article key={item.id} className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="text-xs text-muted-foreground">
            {item.clientName} · {item.number} · {item.balanceLabel}
          </p>
          <h2 className="mt-1 text-base font-semibold">{item.reason}</h2>
          {item.message && <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{item.message}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {item.canApprove && (
              <Button type="button" disabled={busy} onClick={() => onAction({ type: "approve", invoiceId: item.id })}>
                Approuver l'envoi
              </Button>
            )}
            <Button type="button" variant="outline" disabled={busy} onClick={() => onAction({ type: "suspend", invoiceId: item.id })}>
              Suspendre 14 jours
            </Button>
            {item.canCloseDispute && (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => onAction({ type: "closeDispute", invoiceId: item.id })}>
                Clôturer le litige
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpen(item.id)}>
              Ouvrir le dossier
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function Journal({ view }: { view: Dashboard }) {
  if (view.journal.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune décision enregistrée.</p>;
  }
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {view.journal.map((entry) => (
        <li key={entry.id} className="px-4 py-3 text-sm">
          <p className="text-xs text-muted-foreground">
            {entry.when} · {entry.title}
          </p>
          <p className="mt-0.5">{entry.text}</p>
        </li>
      ))}
    </ol>
  );
}

function Dossier({
  dossier,
  busy,
  onBack,
  onAction,
}: {
  dossier: DossierView | null;
  busy: boolean;
  onBack: () => void;
  onAction: (action: Action) => void;
}) {
  if (!dossier) {
    return (
      <div className="space-y-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          Retour au tableau
        </Button>
        <p className="text-sm text-muted-foreground">Cette facture n'est plus dans le portefeuille.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" onClick={onBack}>
        Retour au tableau
      </Button>
      <section className="rounded-lg border border-border bg-card px-4 py-4">
        <p className="text-sm text-muted-foreground">
          {dossier.clientName} · {dossier.city} · {dossier.channelLabel}
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          {dossier.number} · {dossier.label}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {dossier.phone} · {dossier.email}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Fact label="Montant" value={dossier.amountLabel} />
          <Fact label="Encaissé" value={dossier.paidLabel} />
          <Fact label="Avoirs" value={dossier.creditLabel} />
          <Fact label="Solde" value={dossier.balanceLabel} />
          <Fact label="Échéance" value={dossier.dueLabel} />
          <Fact label="Situation" value={dossier.statusLabel} />
        </dl>
        <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm">{dossier.formula}</p>
        {dossier.orderLabel && <p className="mt-2 text-sm text-muted-foreground">{dossier.orderLabel}, selon l'ancienneté, le montant et les retards passés.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy || !dossier.canPay}
            onClick={() => onAction({ type: "pay", invoiceId: dossier.id, amountCfa: dossier.balanceCfa })}
          >
            Enregistrer le règlement du solde
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onAction({ type: "suspend", invoiceId: dossier.id })}>
            Suspendre 14 jours
          </Button>
          {dossier.canApprove && (
            <Button type="button" disabled={busy} onClick={() => onAction({ type: "approve", invoiceId: dossier.id })}>
              Approuver l'envoi
            </Button>
          )}
          {dossier.canCloseDispute && (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => onAction({ type: "closeDispute", invoiceId: dossier.id })}>
              Clôturer le litige
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Le règlement est simulé. La référence porte la marque FICTIF.</p>
      </section>

      <section className="rounded-lg border border-border bg-card px-4 py-4">
        <h3 className="text-sm font-semibold">{dossier.decisionLabel}</h3>
        <p className="mt-1 text-sm">{dossier.reason}</p>
        {dossier.message && <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">{dossier.message}</p>}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">Contrôles effectués avant envoi</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {dossier.checks.map((check) => (
              <li key={check.label} className="flex gap-2">
                <span className={check.state === "stop" ? "text-destructive" : "text-muted-foreground"} aria-hidden>
                  {check.state === "ok" ? "●" : check.state === "stop" ? "■" : "○"}
                </span>
                <span>
                  <span className="sr-only">{check.state === "stop" ? "Arrêt. " : check.state === "ok" ? "Passé. " : "Non atteint. "}</span>
                  {check.label}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-lg border border-border bg-card px-4 py-4 text-sm">
          <h3 className="font-semibold">Pièces</h3>
          <h4 className="mt-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Paiements</h4>
          <List lines={dossier.payments} empty="Aucun encaissement." />
          <h4 className="mt-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Avoirs</h4>
          <List lines={dossier.credits} empty="Aucun avoir." />
          <h4 className="mt-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Échéancier</h4>
          <List lines={dossier.schedule} empty="Pas d'échéancier." />
          {dossier.dispute && <p className="mt-3">{dossier.dispute}</p>}
        </article>
        <article className="rounded-lg border border-border bg-card px-4 py-4 text-sm">
          <h3 className="font-semibold">Réponses et historique</h3>
          {dossier.replies.length === 0 ? (
            <p className="mt-2 text-muted-foreground">Aucune réponse reçue.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {dossier.replies.map((reply) => (
                <li key={`${reply.when}-${reply.text}`}>
                  <span className="text-muted-foreground">{reply.when}</span>
                  {reply.reading ? ` · ${reply.reading}` : ""}
                  <span className="mt-0.5 block">{reply.text}</span>
                </li>
              ))}
            </ul>
          )}
          <h4 className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">Journal</h4>
          <List lines={dossier.events.map((event) => `${event.when} · ${event.text}`)} empty="Aucune écriture." />
        </article>
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function List({ lines, empty }: { lines: string[]; empty: string }) {
  if (lines.length === 0) return <p className="mt-1 text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-1 space-y-1">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function Settings({ view, busy, onAction }: { view: Dashboard; busy: boolean; onAction: (action: Action) => void }) {
  const [threshold, setThreshold] = useState(String(view.thresholdCfa));
  useEffect(() => setThreshold(String(view.thresholdCfa)), [view.thresholdCfa]);

  return (
    <div className="max-w-xl space-y-6">
      <section className="space-y-3 rounded-lg border border-border bg-card px-4 py-4">
        <h2 className="text-sm font-semibold">Avant d'envoyer</h2>
        <div className="grid gap-1">
          <Label htmlFor="seuil">Montant au-dessus duquel une personne valide (F CFA)</Label>
          <Input
            id="seuil"
            className="w-40"
            inputMode="numeric"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            onBlur={() => {
              const next = Number(threshold);
              if (Number.isInteger(next) && next >= 0) onAction({ type: "setThreshold", thresholdCfa: next });
              else setThreshold(String(view.thresholdCfa));
            }}
          />
          <p className="text-xs text-muted-foreground">Aujourd'hui : {view.seuilLabel}.</p>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="canal">Canal du message</Label>
          <select
            id="canal"
            className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
            value={view.channelMode}
            onChange={(event) => onAction({ type: "setChannelMode", channelMode: event.target.value as ChannelMode })}
          >
            <option value="preference">Celui choisi par le client</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Courriel</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="liaison"
            checked={view.offline}
            disabled={busy}
            onCheckedChange={(checked) => onAction({ type: "setOffline", offline: checked })}
          />
          <Label htmlFor="liaison">Travailler sans réseau</Label>
        </div>
      </section>
      <section className="space-y-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => onAction({ type: "playPaymentTrap", invoiceId: "fac-1155" })}
        >
          Simuler un paiement arrivé pendant la coupure
        </Button>
        <p className="text-xs text-muted-foreground">
          La peinture de la cantine est mise en file, puis réglée. À la reprise, la relance est annulée et le solde est à zéro.
        </p>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => onAction({ type: "reset" })}>
          Revenir au portefeuille de démonstration
        </Button>
      </section>
    </div>
  );
}
