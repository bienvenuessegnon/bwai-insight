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

## Ce qu'on montre

Date de référence figée : **24 novembre 2026**. Les mêmes pièces redonnent les mêmes soldes.

1. **Lire les messages**, puis **Préparer les relances**. Le journal écrit chaque envoi, chaque annulation et chaque revue.
2. **Rejouer la préparation**. Une clé d'idempotence empêche un second envoi du même palier.
3. **Couper la liaison**, préparer, puis **Reprendre la file**. La file reste dans le navigateur. Au retour, chaque brouillon est recalculé.
4. **Jouer le piège : paiement pendant la file** (facture FAC-2026-1155, peinture de la cantine). La relance est mise en attente, le solde est encaissé, la reprise annule l'envoi.
5. Puces de scénario : déjà payée (FAC-2026-1042), gros montant (FAC-2026-1120), litige (FAC-2026-1122), piège paiement (FAC-2026-1155).

Le carnet est enregistré dans le navigateur (`localStorage`, clé `deuxieme-regard-v1`). **Réinitialiser le portefeuille** retrouve le jeu de départ. Fermer l'onglet et le rouvrir reprend le journal là où il s'est arrêté.

## Réglages

- Seuil de revue, en francs CFA entiers. Défaut : 200 000. Au-dessus, une personne approuve avant l'envoi.
- Canal simulé : préférence du client, WhatsApp, SMS ou courriel. Rien n'est expédié.

## Comptes de test

Il n'y en a pas. L'application ne demande pas d'identité. Les téléphones du jeu sont tous `+229 01 00 00 00 00` et les courriels finissent par `@adjovi.example`.

## Mettre en ligne

Le même dépôt GitHub alimente les deux hébergeurs. Aucune variable secrète n'est nécessaire.

1. Créez le dépôt GitHub depuis Cursor (pilule **Create repo**), ou poussez cette branche vers un dépôt vide, par exemple `bienvenuessegnon/deuxieme-regard`.
2. Render : ouvrez `https://dashboard.render.com/blueprint/new?repo=` suivi de l'adresse HTTPS du dépôt, puis appliquez le fichier `render.yaml`. Le service écoute `0.0.0.0` et le port fourni par la plateforme. Le plan gratuit s'endort après un quart d'heure sans visite : le premier chargement du jury peut prendre une minute.
3. Vercel : importez le même dépôt, framework Next.js, sans variable d'environnement. Désactivez la protection d'authentification du déploiement si le jury doit ouvrir l'adresse sans compte Vercel.

## Licences

Le code original de ce dépôt est sous licence MIT (`LICENSE`).

Dépendances principales, chacune sous sa propre licence : Next.js (MIT), React (MIT), Tailwind CSS (MIT), shadcn/ui (MIT), Base UI (MIT), Lucide (ISC).

## Documents

- [Rapport](docs/rapport.md) : besoin, parcours, architecture, contrôles, mesures, limites, coûts.
- [Fiche IA](docs/fiche-ia.md) : lexique local, jeu illustratif, seuils, ce que l'IA ne calcule pas.
