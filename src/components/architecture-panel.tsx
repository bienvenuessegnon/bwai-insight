import { DEFAULT_STEPS, DEFAULT_THRESHOLD_CFA, DEFAULT_WEIGHTS, REFERENCE_DATE } from "@/domain/types";
import { formatCfa } from "@/domain/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    title: "Importer",
    text: "Le portefeuille Excel est lu en local. Une ligne incomplète, un doublon ou un paiement sans facture est refusé. Rien n'est inventé à la place.",
  },
  {
    title: "Calculer",
    text: "Le grand livre fait solde = montant − paiements − avoirs, en francs entiers. Le statut suit un ordre fixe : soldée, contestée, échéancier, partiellement payée, non échue, échue.",
  },
  {
    title: "Prioriser",
    text: "L'ancienneté, le solde et l'historique de retard ordonnent le travail humain. Le score n'est pas une prédiction de défaut.",
  },
  {
    title: "Lire les réponses",
    text: "Un lexique classe une promesse, une contestation, un paiement annoncé, un délai, ou dit qu'il ne sait pas. Il ne modifie jamais un franc.",
  },
  {
    title: "Préparer",
    text: "La séquence est courtoise, puis un rappel, puis un ton plus ferme, puis une personne. On ne saute pas un palier, et on n'en envoie qu'un par jour.",
  },
  {
    title: "Revérifier",
    text: "Juste avant l'envoi simulé, le solde, le litige, le seuil, la préférence et la file sont relus. Si le motif a disparu, la relance est annulée.",
  },
  {
    title: "Écrire",
    text: "Chaque décision a une clé. Rejouer la préparation, couper la liaison ou reprendre la file ne crée ni un second envoi ni un second encaissement.",
  },
];

export function ArchitecturePanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Comment le carnet décide</CardTitle>
          <CardDescription>
            Maison Adjovi & Fils, quincaillerie à Cotonou. Amina relançait dans WhatsApp en relisant un Excel déjà dépassé. Deuxième Regard sépare ce qui se calcule de ce qui se lit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>
            La date de référence est figée au {REFERENCE_DATE.split("-").reverse().join("/")} pour que le même portefeuille redonne les mêmes soldes. Les numéros Mobile Money portent la marque FICTIF : aucun paiement réel ne part.
          </p>
          <p>
            L'idée tient en une phrase : la relance n'est pas le classement. C'est un brouillon, recompté au dernier moment. Le chiffre que l'on montre au jury n'est pas le nombre de messages partis, c'est le nombre de relances qu'un Excel pressé aurait envoyées à tort.
          </p>
        </CardContent>
      </Card>

      <ol className="grid gap-3 md:grid-cols-2">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Card className="h-full">
              <CardHeader>
                <CardDescription>Étape {index + 1}</CardDescription>
                <CardTitle>{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{step.text}</CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>Où vit chaque décision</CardTitle>
          <CardDescription>Tout reste dans le navigateur. Couper la liaison n'efface pas la file.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg bg-muted p-3">
              <p className="font-medium">Grand livre</p>
              <p className="mt-1 text-muted-foreground">Factures, paiements, avoirs, échéanciers, litiges. Calcul déterministe.</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="font-medium">File locale</p>
              <p className="mt-1 text-muted-foreground">Relances prêtes pendant une coupure. À la reprise, chacune est revérifiée.</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="font-medium">Journal</p>
              <p className="mt-1 text-muted-foreground">Imports, envois, annulations, revues, encaissements. La clé empêche le double.</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Priorité = {DEFAULT_WEIGHTS.anciennete} ancienneté (plafond {DEFAULT_WEIGHTS.plafondJours} jours) + {DEFAULT_WEIGHTS.solde} solde (plafond {formatCfa(DEFAULT_WEIGHTS.plafondSolde)}) + {DEFAULT_WEIGHTS.historique} historique. Seuil humain par défaut : {formatCfa(DEFAULT_THRESHOLD_CFA)}. Paliers : {DEFAULT_STEPS.map((step) => `${step.step} dès ${step.minDays} j${step.auto ? "" : " (personne)"}`).join(", ")}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ce que le cahier des charges demande, et où c'est fait</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>Contrôle des champs et des doublons : écran Tableau, bloc « Lignes refusées à l'import ».</li>
            <li>Soldes, retards et six statuts : dossier de chaque facture, formule affichée.</li>
            <li>Priorité documentée, sans prédiction : phrase sous le score, dans le dossier.</li>
            <li>Séquence courtoise et canal simulé : message du dossier, réglage du canal.</li>
            <li>Litige, gros montant, message incertain : file Revue, avant tout envoi.</li>
            <li>Revérification et annulation : bouton « Jouer le piège : paiement pendant la file ».</li>
            <li>Reprise sans doublon : « Rejouer la préparation » n'ajoute aucune écriture.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
