# Fiche IA — lexique-1

## Tâche

Classer un message entrant, en français, dans une intention : promesse, contestation, déjà payé, demande de délai, ou incertain. Le résultat sert à choisir une porte (écarter, ou revue humaine). Il ne sert pas à rédiger le montant.

## Modèle

Version `lexique-1`. Liste de tournures, repliées sans accent, chacune avec un poids. Pas de réseau. Pas de modèle génératif. Le texte de relance est un gabarit : numéro de facture, date d'échéance, solde déjà calculé par le grand livre, référence `FICTIF-MOMO-…`.

## Données et partage

Jeu illustratif de 17 phrases, dans `src/domain/classifier.ts` (`EVAL_SET`). Elles ont été écrites en même temps que le lexique, pour couvrir les catégories du cas 1, y compris les messages de la démo. Il n'y a pas de jeu séparé d'entraînement et de test : la liste est le lexique, et ces phrases le décrivent. Ce n'est pas un échantillon de terrain.

## Évaluation

Mesure du 24 novembre 2026, sur ce jeu : **17/17**. Le test `classifieur` exige au moins 0,8 et constate 1. Une phrase isolée comme « MoMo », « vendredi » ou « ok » est classée incertaine (poids insuffisant, ou deux intentions à égalité).

Seuils : au moins 3 points, et une confiance d'au moins 0,6, sinon le résultat est incertain. L'incertain, la contestation et le « déjà payé » dont le solde est encore ouvert vont à une personne. Le grand livre est relu avant : si le solde est nul, la décision s'arrête là, même si le message dit autre chose.

## Erreurs observées

Sur le jeu illustratif, aucune phrase ne sort de la catégorie prévue. L'erreur que le seuil est fait pour attraper est le mot trop court : un « MoMo » sans verbe ne doit pas solder une facture ni lancer une relance. Le prototype le laisse incertain.

## Ce qui n'est pas un résultat d'IA

Les soldes, les retards, les six statuts, le score de priorité et le décompte des relances évitées viennent du grand livre. Ils sont exacts sur le jeu, parce que les opérations sont des entiers et que les tests les figent. Les mélanger au 17/17 du lexique serait faux : l'un vérifie des francs, l'autre devine une intention dans une phrase.

## Limites

Le lexique rate une formulation qu'il n'a pas listée, et il peut sur-réagir à une tournure courte. Il ne comprend pas une pièce jointe, un vocal, ni un montant écrit en toutes lettres s'il n'est pas dans la liste. Tant qu'un cas est incertain, aucune relance automatique ne part.
