"use client";

import { decide } from "@/domain/preflight";
import { rankAll } from "@/domain/priority";
import type { AppState } from "@/domain/types";
import { formatCfa, formatDate, formatScore } from "@/domain/format";
import { CHANNEL_LABEL, DECISION_LABEL, INTENT_LABEL, STATUS_LABEL } from "@/components/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function Dossier({
  state,
  invoiceId,
  onApprove,
  onSuspend,
  onPay,
  onCloseDispute,
}: {
  state: AppState;
  invoiceId: string;
  onApprove: () => void;
  onSuspend: () => void;
  onPay: () => void;
  onCloseDispute: () => void;
}) {
  const invoice = state.portfolio.invoices.find((item) => item.id === invoiceId);
  const client = state.portfolio.clients.find((item) => item.id === invoice?.clientId);
  if (!invoice || !client) {
    return <p className="text-muted-foreground">Cette facture n'est plus dans le carnet.</p>;
  }
  const work = decide(state, invoice.id);
  const rank = rankAll(state).find((item) => item.invoiceId === invoice.id);
  const payments = state.portfolio.payments.filter((item) => item.invoiceId === invoice.id);
  const credits = state.portfolio.creditNotes.filter((item) => item.invoiceId === invoice.id);
  const schedule = state.portfolio.schedules.find((item) => item.invoiceId === invoice.id);
  const dispute = state.portfolio.disputes.find((item) => item.invoiceId === invoice.id);
  const messages = state.messages.filter((item) => item.invoiceId === invoice.id);
  const events = state.journal.filter((item) => item.invoiceId === invoice.id);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card>
        <CardHeader>
          <CardDescription>
            {invoice.number} · {client.name} · {client.city}
          </CardDescription>
          <CardTitle className="font-heading text-2xl">{invoice.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Montant</dt>
              <dd className="font-medium tabular-nums">{formatCfa(rank?.amountCfa ?? invoice.amountCfa)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Encaissé</dt>
              <dd className="font-medium tabular-nums">{formatCfa(rank?.paidCfa ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Avoirs</dt>
              <dd className="font-medium tabular-nums">{formatCfa(rank?.creditCfa ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Solde</dt>
              <dd className="font-medium tabular-nums">{formatCfa(rank?.balanceCfa ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Échéance</dt>
              <dd className="font-medium">{formatDate(invoice.dueOn)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Statut</dt>
              <dd className="font-medium">{rank ? STATUS_LABEL[rank.status] : "—"}</dd>
            </div>
          </dl>
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">
            Solde = {formatCfa(invoice.amountCfa)} − {formatCfa(rank?.paidCfa ?? 0)} − {formatCfa(rank?.creditCfa ?? 0)} ={" "}
            <strong className="tabular-nums">{formatCfa(rank?.balanceCfa ?? 0)}</strong>. Ce calcul ne passe pas par le classifieur.
          </p>
          {rank?.actionable ? (
            <p className="text-sm text-muted-foreground">
              Priorité {formatScore(rank.score)} = {state.settings.weights.anciennete} × ancienneté ({rank.daysOverdue}/{state.settings.weights.plafondJours}) + {state.settings.weights.solde} × solde + {state.settings.weights.historique} × historique ({Math.round(rank.lateRatio * 100)} %). Ce n'est pas une probabilité de non-paiement.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Cette facture n'entre pas dans la file de relance. Le score de priorité est laissé à zéro.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="lg" onClick={onPay} disabled={(rank?.balanceCfa ?? 0) <= 0}>
              Encaisser le solde
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={onSuspend}>
              Suspendre 14 jours
            </Button>
            {(work.reasonCode === "seuil" || work.reasonCode === "sequence") && (
              <Button type="button" size="lg" onClick={onApprove}>
                Approuver et envoyer
              </Button>
            )}
            {dispute?.status === "ouverte" && (
              <Button type="button" size="lg" variant="secondary" onClick={onCloseDispute}>
                Clôturer le litige
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deuxième regard</CardTitle>
          <CardDescription>
            {DECISION_LABEL[work.decision]} · {work.reason}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-2">
            {work.checks.map((check) => (
              <li key={check.code} className="flex items-start gap-2 text-sm">
                <span
                  className={
                    check.state === "ok"
                      ? "mt-0.5 text-primary"
                      : check.state === "stop"
                        ? "mt-0.5 text-destructive"
                        : "mt-0.5 text-muted-foreground"
                  }
                  aria-hidden
                >
                  {check.state === "ok" ? "●" : check.state === "stop" ? "■" : "○"}
                </span>
                <span>
                  <span className="sr-only">
                    {check.state === "ok" ? "Tenu. " : check.state === "stop" ? "Décision. " : "Non exécuté. "}
                  </span>
                  {check.label}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Clé {work.idempotencyKey}
            {work.channel ? ` · canal ${CHANNEL_LABEL[work.channel]}` : ""}
          </p>
          {work.message && (
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap">
              {work.message}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Pièces et événements</CardTitle>
          <CardDescription>Tout ce qui explique le solde et la décision.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-medium">Paiements</h3>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun encaissement.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {payments.map((payment) => (
                  <li key={payment.id}>
                    {formatDate(payment.paidOn)} · {formatCfa(payment.amountCfa)} · {payment.reference}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mt-4 mb-2 text-sm font-medium">Avoirs</h3>
            {credits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun avoir.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {credits.map((note) => (
                  <li key={note.id}>
                    {formatDate(note.issuedOn)} · {formatCfa(note.amountCfa)} · {note.reason}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-2 text-sm font-medium">Échéancier et litige</h3>
            {schedule ? (
              <ul className="space-y-1 text-sm">
                {schedule.installments.map((part) => (
                  <li key={part.dueOn}>
                    Traite du {formatDate(part.dueOn)} · {formatCfa(part.amountCfa)} · {part.paidOn ? `réglée le ${formatDate(part.paidOn)}` : "ouverte"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Pas d'échéancier retenu.</p>
            )}
            {dispute && (
              <p className="mt-3 text-sm">
                <Badge variant={dispute.status === "ouverte" ? "destructive" : "secondary"}>
                  Litige {dispute.status}
                </Badge>{" "}
                {dispute.reason}
              </p>
            )}
            <h3 className="mt-4 mb-2 text-sm font-medium">Messages</h3>
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun message reçu.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {messages.map((message) => (
                  <li key={message.id}>
                    <span className="text-muted-foreground">{formatDate(message.receivedOn)} · </span>
                    {message.text}{" "}
                    {message.classification && (
                      <Badge variant="outline">{INTENT_LABEL[message.classification.intent]}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mt-4 mb-2 text-sm font-medium">Journal de la facture</h3>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune écriture.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {[...events].reverse().map((event) => (
                  <li key={event.id}>
                    <span className="text-muted-foreground">{event.at.slice(0, 16).replace("T", " ")} · </span>
                    {event.summary}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
