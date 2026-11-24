"use client";

import { evaluateClassifier, LEXICON_VERSION, SCORE_FLOOR } from "@/domain/classifier";
import { INTENT_LABEL } from "@/components/labels";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function FichePanel() {
  const evaluation = evaluateClassifier();
  const misses = evaluation.rows.filter((row) => !row.hit);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Fiche IA</CardTitle>
          <CardDescription>
            {LEXICON_VERSION} · tâche : classer un message client · le lexique ne voit pas les montants du grand livre
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>
            Le modèle est une liste de tournures, avec un poids. Au-dessous de {SCORE_FLOOR} points, ou si deux intentions arrivent ensemble, le résultat est « incertain » et une personne lit le message. Il n'y a pas d'appel réseau et pas de modèle génératif : le texte de relance est un gabarit rempli avec le numéro, l'échéance et le solde déjà calculés.
          </p>
          <p>
            Jeu illustratif : {evaluation.hits}/{evaluation.total} ({Math.round(evaluation.accuracy * 100)} %). Ces phrases ont été écrites pour couvrir les catégories du hackathon. Ce n'est pas un échantillon de vrais messages de clients, et ce score n'est pas le taux d'exactitude des soldes. Les soldes, eux, sont contrôlés par les tests du grand livre.
          </p>
          {misses.length === 0 ? (
            <p>Sur ce jeu, aucune phrase ne sort de la catégorie prévue. La limite reste le mot isolé : « MoMo » ou « vendredi » seuls restent incertains, volontairement.</p>
          ) : (
            <p>{misses.length} phrase(s) s'écartent de l'attendu. Elles sont marquées dans le tableau.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lecture du jeu</CardTitle>
          <CardDescription>Attendu et obtenu, pour chaque phrase.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Phrase</th>
                <th className="py-2 pr-3 font-medium">Attendu</th>
                <th className="py-2 font-medium">Obtenu</th>
              </tr>
            </thead>
            <tbody>
              {evaluation.rows.map((row) => (
                <tr key={row.text} className="border-t border-border">
                  <td className="py-2 pr-3">{row.text}</td>
                  <td className="py-2 pr-3">{INTENT_LABEL[row.expected]}</td>
                  <td className="py-2">
                    <Badge variant={row.hit ? "secondary" : "destructive"}>{INTENT_LABEL[row.actual]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
