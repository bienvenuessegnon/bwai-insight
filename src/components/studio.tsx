"use client";

import { useEffect, useMemo, useState } from "react";
import { Dossier } from "@/components/dossier";
import { ArchitecturePanel } from "@/components/architecture-panel";
import { FichePanel } from "@/components/fiche-panel";
import { CHANNEL_LABEL, DECISION_LABEL, STATUS_LABEL } from "@/components/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { referenceComparison, worklist } from "@/domain/preflight";
import { rankAll } from "@/domain/priority";
import { reduce, type Action } from "@/domain/reduce";
import { createInitialState } from "@/domain/seed";
import type { AppState, ChannelMode, Decision, PrimaryStatus } from "@/domain/types";
import { STATE_VERSION } from "@/domain/types";
import { formatCfa, formatDate, formatScore } from "@/domain/format";

const STORAGE_KEY = "deuxieme-regard-v1";

const SCENARIOS = [
  { id: "fac-1042", label: "Déjà payée" },
  { id: "fac-1120", label: "Gros montant" },
  { id: "fac-1122", label: "Litige" },
  { id: "fac-1155", label: "Piège paiement" },
];

function isState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const state = value as AppState;
  return state.version === STATE_VERSION && Array.isArray(state.portfolio?.invoices) && Array.isArray(state.journal);
}

function statusVariant(status: PrimaryStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "echue" || status === "contestee") return "destructive";
  if (status === "soldee" || status === "echeancier") return "secondary";
  return "outline";
}

function decisionVariant(decision: Decision): "default" | "secondary" | "destructive" | "outline" {
  if (decision === "envoyer") return "default";
  if (decision === "revue") return "destructive";
  if (decision === "annuler") return "secondary";
  return "outline";
}

export function Studio() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState("tableau");
  const [invoiceId, setInvoiceId] = useState("fac-1042");
  const [resumed, setResumed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isState(parsed)) {
          setState(parsed);
          setResumed(true);
          return;
        }
      }
    } catch {
      setError("Le carnet local était illisible. Le portefeuille de démonstration a été rouvert.");
    }
    setState(createInitialState());
  }, []);

  useEffect(() => {
    if (!state) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const view = useMemo(() => {
    if (!state) return null;
    const ranks = rankAll(state);
    const items = worklist(state);
    const byInvoice = new Map(items.map((item) => [item.invoiceId, item]));
    const comparison = referenceComparison(state);
    const encours = ranks.reduce((sum, rank) => sum + Math.max(rank.balanceCfa, 0), 0);
    const overdue = ranks.filter((rank) => rank.actionable);
    return { ranks, items, byInvoice, comparison, encours, overdue };
  }, [state]);

  function dispatch(action: Action) {
    setError(null);
    setState((current) => {
      if (!current) return current;
      try {
        return reduce(current, action);
      } catch {
        setError("Cette action n'a pas pu être écrite dans le carnet.");
        return current;
      }
    });
  }

  function openInvoice(id: string) {
    setInvoiceId(id);
    setTab("dossier");
  }

  if (!state || !view) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4">
        <p className="text-muted-foreground">Ouverture du carnet local…</p>
      </main>
    );
  }

  const clientName = (id: string) => state.portfolio.clients.find((client) => client.id === id)?.name ?? id;
  const reviews = view.items.filter((item) => item.decision === "revue");
  const ready = view.items.filter((item) => item.decision === "envoyer");

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm text-muted-foreground">BWAI 2026 · cas 1 · Maison Adjovi & Fils, Cotonou</p>
          <h1 className="font-heading mt-1 text-4xl tracking-tight text-balance">Deuxième Regard</h1>
          <p className="mt-2 text-pretty text-muted-foreground">
            La relance ne part que si le solde est encore vrai. Portefeuille fictif, date figée au {formatDate(state.settings.referenceDate)}, messages et Mobile Money simulés.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <Switch
            id="liaison"
            checked={state.settings.offline}
            onCheckedChange={(checked) => dispatch({ type: "setOffline", offline: checked })}
          />
          <Label htmlFor="liaison">Couper la liaison</Label>
        </div>
      </header>

      {resumed && (
        <p className="mb-4 rounded-lg bg-accent px-3 py-2 text-sm">
          Carnet repris sur cet appareil. Les décisions déjà écrites sont conservées.
        </p>
      )}
      {state.settings.offline && (
        <p className="mb-4 rounded-lg bg-accent px-3 py-2 text-sm">
          Liaison coupée. {state.outbox.length} relance(s) restent dans le carnet. Rien ne part deux fois au retour.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => dispatch({ type: "classifyAll" })}>
          Lire les messages
        </Button>
        <Button type="button" onClick={() => dispatch({ type: "prepare" })}>
          Préparer les relances
        </Button>
        <Button type="button" variant="outline" onClick={() => dispatch({ type: "prepare" })}>
          Rejouer la préparation
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={state.settings.offline || state.outbox.length === 0}
          onClick={() => dispatch({ type: "flush" })}
        >
          Reprendre la file
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setResumed(false);
            dispatch({ type: "playPaymentTrap", invoiceId: "fac-1155" });
            setInvoiceId("fac-1155");
            setTab("journal");
          }}
        >
          Jouer le piège : paiement pendant la file
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setResumed(false);
            setError(null);
            dispatch({ type: "reset" });
          }}
        >
          Réinitialiser le portefeuille
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-1">
          <Label htmlFor="seuil">Seuil de revue (F CFA)</Label>
          <Input
            id="seuil"
            className="w-40"
            type="number"
            min={0}
            step={10000}
            value={state.settings.thresholdCfa}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 0) dispatch({ type: "setThreshold", thresholdCfa: value });
            }}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="canal">Canal simulé</Label>
          <select
            id="canal"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
            value={state.settings.channelMode}
            onChange={(event) =>
              dispatch({ type: "setChannelMode", channelMode: event.target.value as ChannelMode })
            }
          >
            <option value="preference">Préférence du client</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Courriel</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {SCENARIOS.map((scenario) => (
            <Button key={scenario.id} type="button" size="sm" variant="outline" onClick={() => openInvoice(scenario.id)}>
              {scenario.label}
            </Button>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value)}>
        <TabsList className="mb-4 h-auto! w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="tableau">Tableau</TabsTrigger>
          <TabsTrigger value="file">File</TabsTrigger>
          <TabsTrigger value="revue">Revue</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="dossier">Dossier</TabsTrigger>
          <TabsTrigger value="fonctionnement">Fonctionnement</TabsTrigger>
          <TabsTrigger value="fiche">Fiche IA</TabsTrigger>
        </TabsList>

        <TabsContent value="tableau" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Encours ouvert" value={formatCfa(view.encours)} hint="Soldes encore dus, trop-perçus exclus" />
            <Metric label="À relancer" value={String(view.overdue.length)} hint="Échues ou partielles et en retard" />
            <Metric label="Prêtes / à relire" value={`${ready.length} / ${reviews.length}`} hint="Décision du moment, avant ou après préparation" />
            <Metric
              label="Relances évitées"
              value={String(view.comparison.naiveErrors.length)}
              hint={`Sur ${view.comparison.referenceCount} factures qu'un Excel daterait comme échues`}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Face au réflexe Excel</CardTitle>
              <CardDescription>
                Relancer toute facture dont l'échéance est passée enverrait {view.comparison.referenceCount} messages, dont {view.comparison.naiveErrors.length} à tort : déjà soldées, contestées, ou tenues par un échéancier. Au moment de cette lecture, {view.comparison.ourSendCount} passent le pré-vol et {view.comparison.reviewCount} attendent une personne. Une seule relance par client et par jour : préparer la file peut encore en écarter.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <caption className="sr-only">Portefeuille classé au {formatDate(state.settings.referenceDate)}</caption>
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Facture</th>
                    <th className="py-2 pr-3 font-medium">Client</th>
                    <th className="py-2 pr-3 font-medium">Solde</th>
                    <th className="py-2 pr-3 font-medium">Retard</th>
                    <th className="py-2 pr-3 font-medium">Statut</th>
                    <th className="py-2 pr-3 font-medium">Priorité</th>
                    <th className="py-2 font-medium">Décision</th>
                  </tr>
                </thead>
                <tbody>
                  {view.ranks.map((rank) => {
                    const item = view.byInvoice.get(rank.invoiceId);
                    return (
                      <tr key={rank.invoiceId} className="border-t border-border">
                        <td className="py-2 pr-3">
                          <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => openInvoice(rank.invoiceId)}>
                            {rank.number}
                          </button>
                          <span className="block text-xs text-muted-foreground">{rank.label}</span>
                        </td>
                        <td className="py-2 pr-3">{clientName(rank.clientId)}</td>
                        <td className="py-2 pr-3 tabular-nums">{formatCfa(rank.balanceCfa)}</td>
                        <td className="py-2 pr-3 tabular-nums">{rank.daysOverdue > 0 ? `${rank.daysOverdue} j` : "—"}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={statusVariant(rank.status)}>{STATUS_LABEL[rank.status]}</Badge>
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{rank.actionable ? formatScore(rank.score) : "—"}</td>
                        <td className="py-2">
                          {item && <Badge variant={decisionVariant(item.decision)}>{DECISION_LABEL[item.decision]}</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Lignes refusées à l'import</CardTitle>
              <CardDescription>Un doublon, un montant illisible ou un échéancier qui ne couvre pas la facture ne protège pas une dette.</CardDescription>
            </CardHeader>
            <CardContent>
              {state.issues.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune ligne refusée.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {state.issues.map((issue) => (
                    <li key={`${issue.code}-${issue.id}`}>
                      <span className="text-muted-foreground">{issue.code} · </span>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="file" className="space-y-3">
          {state.outbox.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>En attente dans le carnet</CardTitle>
                <CardDescription>Préparées hors liaison. La reprise relit le solde avant d'écrire l'envoi.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {state.outbox.map((item) => (
                  <p key={item.idempotencyKey}>
                    {item.invoiceId} · palier {item.step} · {item.channel ? CHANNEL_LABEL[item.channel] : "canal"}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
          {ready.length === 0 && state.outbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune relance prête. Lisez les messages, puis préparez : une facture soldée, contestée ou couverte par un échéancier n'entre pas dans la file.
            </p>
          ) : (
            ready.map((item) => {
              const rank = view.ranks.find((entry) => entry.invoiceId === item.invoiceId);
              return (
                <Card key={item.idempotencyKey}>
                  <CardHeader>
                    <CardDescription>
                      {rank?.number} · {clientName(item.clientId)} · palier {item.step}
                    </CardDescription>
                    <CardTitle className="text-lg">{item.reason}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{item.message}</pre>
                    <Button type="button" variant="outline" onClick={() => openInvoice(item.invoiceId)}>
                      Ouvrir le dossier
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="revue" className="space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Rien n'attend une personne. Un litige, un montant au-dessus du seuil ou un message incertain apparaîtra ici, avant tout envoi.
            </p>
          ) : (
            reviews.map((item) => {
              const dispute = state.portfolio.disputes.find(
                (entry) => entry.invoiceId === item.invoiceId && entry.status === "ouverte",
              );
              return (
                <Card key={item.idempotencyKey}>
                  <CardHeader>
                    <CardDescription>{clientName(item.clientId)}</CardDescription>
                    <CardTitle className="text-lg">{item.reason}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {item.message && (
                      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">{item.message}</pre>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(item.reasonCode === "seuil" || item.reasonCode === "sequence") && (
                        <Button type="button" onClick={() => dispatch({ type: "approve", invoiceId: item.invoiceId })}>
                          Approuver et envoyer
                        </Button>
                      )}
                      <Button type="button" variant="outline" onClick={() => dispatch({ type: "suspend", invoiceId: item.invoiceId })}>
                        Suspendre 14 jours
                      </Button>
                      {dispute && (
                        <Button type="button" variant="secondary" onClick={() => dispatch({ type: "closeDispute", invoiceId: item.invoiceId })}>
                          Clôturer le litige
                        </Button>
                      )}
                      <Button type="button" variant="ghost" onClick={() => openInvoice(item.invoiceId)}>
                        Ouvrir le dossier
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="journal">
          {state.journal.length === 0 ? (
            <p className="text-sm text-muted-foreground">Le journal est vide.</p>
          ) : (
            <ol className="space-y-2">
              {[...state.journal].reverse().map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {entry.at.replace("T", " ").slice(0, 16)} · {entry.kind}
                    {entry.idempotencyKey ? ` · ${entry.idempotencyKey}` : ""}
                  </p>
                  <p>{entry.summary}</p>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="dossier">
          <div className="mb-3 grid max-w-md gap-1">
            <Label htmlFor="piece">Pièce</Label>
            <select
              id="piece"
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              value={invoiceId}
              onChange={(event) => setInvoiceId(event.target.value)}
            >
              {view.ranks.map((rank) => (
                <option key={rank.invoiceId} value={rank.invoiceId}>
                  {rank.number} · {clientName(rank.clientId)}
                </option>
              ))}
            </select>
          </div>
          <Dossier
            state={state}
            invoiceId={invoiceId}
            onApprove={() => dispatch({ type: "approve", invoiceId })}
            onSuspend={() => dispatch({ type: "suspend", invoiceId })}
            onPay={() => {
              const rank = view.ranks.find((item) => item.invoiceId === invoiceId);
              if (rank && rank.balanceCfa > 0) dispatch({ type: "pay", invoiceId, amountCfa: rank.balanceCfa });
            }}
            onCloseDispute={() => dispatch({ type: "closeDispute", invoiceId })}
          />
        </TabsContent>

        <TabsContent value="fonctionnement">
          <ArchitecturePanel />
        </TabsContent>
        <TabsContent value="fiche">
          <FichePanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-heading text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
    </Card>
  );
}
