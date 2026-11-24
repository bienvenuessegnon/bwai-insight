# Rapport — Deuxième Regard

Cas 1 du hackathon BWAI 2026. Recouvrement d'un portefeuille fictif. Date de référence : 24 novembre 2026.

## 1. Besoin

Amina tient la quincaillerie Maison Adjovi & Fils, à Cotonou. Le vendredi, elle ouvre un classeur, trie les lignes dont la date est passée, et écrit sur WhatsApp. Trois choses lui font perdre la matinée, et parfois un client.

Le classeur ne sait pas qu'un paiement est arrivé mardi. Il ne sait pas qu'un avoir a soldé la ligne. Il ne sait pas qu'un litige est ouvert, ni qu'un échéancier est respecté. La relance part quand même. Le client qui a déjà payé répond sèchement. Celui qui conteste se braque. Celui qui a promis vendredi reçoit un second message le même jour.

Le besoin n'est pas d'envoyer plus. C'est d'envoyer seulement ce qui est encore vrai, et de laisser une personne trancher dès que le texte ou le montant sort du cadre.

## 2. Parcours

Le carnet s'ouvre sur le tableau : encours, factures à relancer, relances qu'un tri par date enverrait à tort. Chaque ligne mène à son dossier. Le dossier montre la formule du solde, les pièces, le message reçu, et la liste des contrôles du dernier regard.

Amina lit d'abord les réponses (« Lire les messages »). Une promesse écarte la relance du jour. Un « j'ai payé » dont le solde est encore ouvert passe en revue, sans changer un franc. Un message que le lexique ne comprend pas passe aussi en revue.

Elle prépare ensuite. Les brouillons prêts portent le numéro, l'échéance, le solde et une référence Mobile Money marquée FICTIF. Un litige, un montant au-dessus du seuil, ou le palier « passage à une personne » n'écrit pas d'envoi. Elle approuve, suspend quatorze jours, ou clôt le litige. Clôturer le litige ne déclenche pas un message : si la réponse du client est encore une contestation, la revue reste.

Si le réseau tombe, elle coupe la liaison. La file reste dans l'appareil. Au retour, chaque brouillon est relu. Le bouton du piège joue ce cas sur la peinture de la cantine : la relance est mise de côté, le solde est encaissé, la reprise annule l'envoi.

## 3. Architecture

Tout tient dans le navigateur. Le moteur est du TypeScript pur, sous `src/domain`, testé sans l'écran.

```
Portefeuille brut
    → import (refus des lignes fausses)
    → grand livre (soldes entiers, six statuts)
    → priorité (ordre de travail, pas une probabilité)
    → lexique (intention du message, jamais un montant)
    → pré-vol (une décision par facture)
    → journal ou file locale
```

Le grand livre précède tout le reste. Solde = montant − paiements − avoirs, en francs CFA entiers. Le statut suit un ordre fixe : soldée (y compris un trop-perçu), puis contestée, puis échéancier tenu, puis partiellement payée, puis non échue, puis échue. Un échéancier dont la somme des traites n'est pas le montant de la facture est refusé à l'import : il ne peut pas cacher une dette.

La priorité ne s'applique qu'aux factures actionnables (échue, ou partielle et en retard). Elle vaut

0,45 × min(jours, 90) / 90 + 0,35 × min(solde, 500 000) / 500 000 + 0,20 × part des autres factures du client payées après l'échéance.

Le score reste dans [0, 1]. Il ordonne la matinée. Il ne dit pas qu'un client ne paiera pas.

Les paliers sont 1 jour (courtois), 7 jours (rappel), 15 jours (ferme), 30 jours (une personne). On prend le plus bas palier dû qui n'est pas déjà parti. On n'en envoie qu'un par facture et par jour, et un seul automatique par client et par jour. Le plafond mensuel est de 3, réglage du client.

La file hors ligne et le journal partagent les mêmes clés. Envoyer : `facture:etape:n`. Annuler ou revue : `facture:décision:motif`. Rejouer la préparation retrouve la clé et n'écrit rien de plus.

## 4. Contrôles

Le pré-vol s'arrête au premier motif. Un litige, une contestation, un paiement annoncé, un message incertain ou un solde au-dessus du seuil restent devant une personne, même si une autre facture du même client est déjà partie aujourd'hui. Le plafond du jour ne cache pas ces cas. Il ne s'applique qu'aux envois automatiques. Une approbation humaine laisse partir le palier visé, puis le suivant attend le lendemain.

Solde nul ou trop-perçu. Échéancier tenu. Litige ouvert. Facture pas encore à relancer. Message de contestation. Paiement annoncé alors que le solde est ouvert. Message incertain. Promesse. Demande de délai. Refus d'être contacté. Suspension humaine. Plafond du mois. Une relance par client et par jour. Palier disponible. Palier déjà parti aujourd'hui. Doublon de file ou de journal. Palier réservé à une personne. Montant au-dessus du seuil (200 000 F CFA par défaut).

Si tout passe, le brouillon est prêt. Hors ligne, il entre dans la file sans écriture d'envoi. En ligne, le journal note l'envoi simulé. Approuver un litige ou une contestation est refusé, même si l'on appuie sur le bouton : le journal le dit.

## 5. Protocole et résultats

`npm test` lance douze tests (`node:test`, via `tsx`) sur le moteur, sans l'écran. Ils couvrent l'import, les statuts au 24 novembre 2026, la stabilité du classement, le double passage, la lecture des messages, le piège du paiement, le refus d'approuver un litige, l'accord sur un gros montant, le second encaissement, le refus de contact, la comparaison au réflexe par date, et le lexique.

Portefeuille retenu : 17 factures. Cinq lignes refusées : doublon de FAC-2026-1150, facture sans client, montant négatif, paiement orphelin, échéancier dont la somme (10 F CFA) n'est pas le montant (38 000 F CFA).

Après « Lire les messages » puis « Préparer les relances », le journal enregistre quatre envois simulés : FAC-2026-1108 (SMS, palier 1), FAC-2026-1144, FAC-2026-1150 (WhatsApp, palier 1), FAC-2026-1155 (courriel, palier 1). Trois revues : FAC-2026-1114 (le client dit avoir envoyé 100 000, le solde reste 140 000), FAC-2026-1120 (850 000, au-dessus du seuil), FAC-2026-1122 (litige). FAC-2026-1133 est écartée pour promesse. Les factures soldées, l'échéancier de la coopérative et les échéances futures sont écartées. La relance du 13 novembre sur FAC-2026-1114 reste dans l'historique : le palier 1 n'est pas rejoué.

Le piège FAC-2026-1155, mesuré par le test : aucun envoi, au moins une annulation, file vide, clés d'envoi uniques. Un second encaissement d'un solde déjà nul n'ajoute pas de paiement.

## 6. Comparaison à la méthode de référence

La méthode de référence est le réflexe du classeur : toute facture dont l'échéance est antérieure ou égale au 24 novembre 2026 est relancée, sans regarder paiements, avoirs, litiges ni échéanciers. Cela fait 15 factures. Huit sont des erreurs : six déjà soldées (dont FAC-2026-1042, payée la veille de l'échéance, et FAC-2026-1140, soldée par un avoir le jour même), le litige FAC-2026-1122, et l'échéancier FAC-2026-1130.

Deuxième Regard n'en prépare aucune de ces huit pour envoi. Le chiffre affiché sur le tableau est le nombre de ces erreurs évitées, pas le nombre de messages partis.

## 7. Limites

Le portefeuille est un jeu écrit pour le jury, pas un extrait comptable. Le lexique a été évalué sur 17 phrases rédigées avec lui : 17/17 sur ce jeu, ce qui illustre les catégories et ne mesure pas des messages de clients. « MoMo » ou « vendredi » seuls restent incertains, et c'est voulu.

La priorité n'apprend rien des encaissements futurs. Elle ne doit pas être lue comme un risque de crédit. Les canaux sont simulés : brancher un vrai WhatsApp demanderait un consentement, un journal d'expédition et une revue juridique qui ne sont pas dans ce prototype. Le carnet local survit à un rechargement de page, pas à un autre navigateur.

## 8. Coûts estimés

Le prototype n'appelle aucun modèle payant. Le coût d'exécution de la démo est celui d'un poste et d'un navigateur. Un déploiement statique ou un petit service web, sans base, reste dans l'ordre d'un hébergement d'entrée de gamme (quelques milliers de francs CFA par mois si l'on veut une adresse publique).

Passer à un usage réel ajouterait : hébergement d'une base (le fichier local ne suffit plus), un canal d'envoi avec son tarif au message, et du temps de revue humaine sur les cas incertains. Le lexique peut rester local. Un modèle génératif n'est pas nécessaire pour remplir un gabarit dont le solde est déjà calculé.

## 9. Suite

Brancher l'import sur le fichier que la PME exporte déjà, en gardant les mêmes refus. Remplacer la file simulée par un connecteur dont chaque appel reprend la même clé. Constituer un jeu de messages réels, annoté à part du code, avant de toucher au lexique. Laisser le grand livre seul juge des francs.
