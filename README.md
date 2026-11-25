# Deuxième Regard

Prototype du **cas 1** du hackathon BWAI 2026 : recouvrement des factures impayées pour une PME béninoise fictive, la quincaillerie **Maison Adjovi & Fils** (Cotonou).

La relance n'est pas un classement. C'est un brouillon. Juste avant l'envoi simulé, le carnet relit le solde, le litige, le seuil et la préférence du client. Si le motif a disparu, le message ne part pas.

Aucune donnée réelle. Aucun paiement réel. Les références Mobile Money portent le préfixe `FICTIF`. Il n'y a pas de compte, pas de secret et pas d'appel à un modèle distant.

## Lancer

```bash
npm install
npm test
npm run dev
```

L'application écoute `0.0.0.0` sur le port **3847**, ou sur `$PORT` s'il est défini. Ouvrir `http://localhost:3847`.

```bash
npm run typecheck
npm run lint
npm run build
npm start
```

## Facturer

La page d'accueil met en forme une commande en facture. Quatre messages de démonstration couvrent une commande juste, un total annoncé faux, une livraison incomplète et un client absent du référentiel.

1. Choisir un message, ou coller le sien, puis **Mettre en forme**.
2. Lire les écarts. Confirmer les valeurs. **Valider et émettre**.
3. **Télécharger**, **Partager** ou **Imprimer**. Le QR et le code ouvrent `/verifier`.

Un second clic sur la même pièce ne crée pas un autre numéro. Un avoir n'altère pas la facture déjà émise. Les prix absents du message ne sont pas remplacés par le catalogue. Le code du QR est délivré par le registre du serveur : le PDF et la page de vérification relisent cette pièce, pas le fichier envoyé par le navigateur.

Le recouvrement du cas 1 reste sur `/recouvrement`.

## Recouvrement

Date de référence figée : **24 novembre 2026**. Les mêmes pièces redonnent les mêmes soldes.

1. **Lire les réponses**, puis **Préparer les relances**. Le journal écrit chaque envoi, chaque annulation et chaque validation.
2. **Préparer les relances** une seconde fois. La même étape ne part pas deux fois.
3. Dans **Réglages**, **Travailler sans réseau**, préparer, puis **Reprendre la file locale**. Au retour, chaque solde est relu.
4. **Simuler un paiement arrivé pendant la coupure** (facture FAC-2026-1155, peinture de la cantine). La relance est mise en attente, le solde est encaissé, la reprise annule l'envoi.
5. Ouvrir une facture depuis le tableau : déjà payée (FAC-2026-1042), gros montant (FAC-2026-1120), litige (FAC-2026-1122).

Le bouton **Revenir au portefeuille de démonstration**, dans Réglages, retrouve le jeu de départ.

Le même dépôt alimente l'écran et le calcul. L'écran demande chaque solde, chaque statut et chaque relance à `POST /api/carnet`. Le navigateur conserve le carnet (`localStorage`, clé `deuxieme-regard-v1`) pour reprendre après un rechargement, puis le serveur recalcule. Rien n'est envoyé pour de vrai.

## Réglages

- Seuil de revue, en francs CFA entiers. Défaut : 200 000. Au-dessus, une personne approuve avant l'envoi.
- Canal simulé : préférence du client, WhatsApp, SMS ou courriel. Rien n'est expédié.

## Comptes de test

Il n'y en a pas. L'application ne demande pas d'identité. Les téléphones du jeu sont tous `+229 01 00 00 00 00` et les courriels finissent par `@adjovi.example`.

## Mettre en ligne

Le dépôt est [github.com/bienvenuessegnon/bwai-insight](https://github.com/bienvenuessegnon/bwai-insight). L'écran et les API (`/api/carnet`, `/api/factures`, `/api/verifier`) sont le même service Next.js.

Render lit `render.yaml` : le service web `bwai-insight`, à Francfort, sert l'écran et les API. L'adresse est [bwai-insight.onrender.com](https://bwai-insight.onrender.com). Le compte a déjà sa base gratuite sur un autre projet, donc ce service garde le registre des factures dans sa mémoire : il reste disponible tant que l'instance est réveillée. Le plan gratuit s'endort après un quart d'heure sans visite. Le premier chargement peut prendre une minute.

Vercel : [importer le dépôt](https://vercel.com/new/import?s=https://github.com/bienvenuessegnon/bwai-insight&teamSlug=bienvenus-projects-7051ddc6), framework Next.js. Désactivez la protection d'authentification si le jury doit ouvrir l'adresse sans compte Vercel.

## Licences

Le code original de ce dépôt est sous licence MIT (`LICENSE`).

Dépendances principales, chacune sous sa propre licence : Next.js (MIT), React (MIT), Tailwind CSS (MIT), shadcn/ui (MIT), Base UI (MIT), Lucide (ISC).

## Documents

- [Rapport](docs/rapport.md) : besoin, parcours, architecture, contrôles, mesures, limites, coûts.
- [Fiche IA](docs/fiche-ia.md) : lexique local, jeu illustratif, seuils, ce que l'IA ne calcule pas.
