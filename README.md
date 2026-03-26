# EGK - Gestion de Stock BTP (SPA)

Application complète de gestion de stock pour entreprise de matériaux de construction.

## Stack

- Frontend: HTML, CSS, Vanilla JS (SPA)
- Backend: Node.js + Express
- Base de données: SQLite locale (`data/egk.sqlite`)
- Export: PDF via `jsPDF`

## Fonctionnalités livrées

- Dashboard: KPIs + alertes stock bas/surstock + actions rapides (Entrée stock, Sortie stock, Nouvelle commande) + export CSV global
- Dashboard: sauvegarde/restauration SQLite en un clic
- Dashboard: tableau “À traiter aujourd’hui” (brouillons, livraisons en attente, stocks critiques)
- Journal d’audit simple (actions clés système/métier)
- Journal d’audit filtrable (action, entité, période)
- Journal d’audit: vue détail en panneau latéral (drawer)
- Journal d’audit: raccourcis contextuels vers l’enregistrement concerné (produit/client/commande/mouvement)
- Dashboard: widget retards de livraison (seuil configurable en jours)
- Dashboard: bloc “Actions urgentes” avec ouverture directe vers commande/produit concerné
- Dashboard: file d’attente livraisons (commandes validées) avec action rapide “Livrer”
- Dashboard: cartes Actions/Exports/Sauvegarde alignées horizontalement + cartes Retards/Stock bas/Surstock alignées horizontalement
- Topbar: recherche globale unifiée (détection du type et redirection Produits/Clients/Commandes/Mouvements)
- Produits: CRUD, recherche, pagination, statut stock visuel + filtre statut (bas/normal/surstock)
- Clients: CRUD, recherche, pagination
- Mouvements: ENTREE/SORTIE avec mise à jour temps réel + filtres type/date/produit
- Mouvements: prévalidation guidée des sorties (stock avant/après, alerte proximité stock_min, blocage visuel des cas refusés)
- Mouvements: modification et suppression (avec contrôles d’impact stock)
- Commandes: création multi-produits, liaison client, validation commande + statuts avancés (Brouillon / Validée / Livrée / Annulée) + filtres client/état/date/statut
- Commandes: assistant “rupture partielle” à la création (lignes bloquantes + quantité max suggérée lors de validation immédiate)
- Commandes: modification et suppression des commandes brouillon uniquement
- Commandes: génération facture PDF pour commandes livrées
- Commandes: action guidée “Livrer rapidement” (Brouillon → Validée → Livrée)
- Commandes: assistant livraison visuel en 2 étapes (checklist)
- Commandes: historique d’audit affiché en timeline dans le détail + événements système (création/validation/livraison/annulation)
- Fiche de stock: historique détaillé par produit + export PDF
- Notifications in-app (topbar): retards livraison, stocks critiques, brouillons à finaliser, commandes à livrer, actions “Ouvrir” et état “Lu” (session)
- UX: sidebar, modales, toasts, confirmations suppression, responsive, mode sombre
- UX: refonte visuelle moderne (sidebar/topbar, cartes KPI, tables/boutons harmonisés, micro-interactions légères)

## Règles métier appliquées (backend)

1. Impossible de sortir plus que le stock disponible
2. Impossible de dépasser `stock_max` (entrée)
3. Impossible de descendre sous `stock_min` (sortie/validation commande)
4. Toute commande doit contenir au moins une ligne produit
5. Validation stricte des champs critiques
6. Intégrité référentielle + prévention des incohérences (FK, contraintes, unicité)

## Installation & démarrage

```bash
npm install
npm run start
```

Application disponible sur `http://localhost:3000`.

## Version desktop (Electron)

L'application peut être lancée en mode desktop. Electron démarre le backend Express en local puis charge l'interface dans une fenêtre native.

### Lancer en desktop

```bash
npm run electron
```

### Générer un installateur Windows

```bash
npm run dist:win
```

Le fichier d'installation est généré dans le dossier `release/`.

Pour un build release explicite (publication activée côté electron-builder), utiliser:

```bash
npm run dist:win:release
```

### Build automatique (GitHub Actions)

Un workflow CI est configuré dans `.github/workflows/electron-windows.yml`.

- Déclenchement automatique: push sur la branche `electron`
- Déclenchement release automatique: push d'un tag `v*` (ex: `v1.0.0`)
- Déclenchement manuel: onglet Actions > workflow `Electron Windows Build` > Run workflow
- Résultat: artefact `egk-electron-windows` contenant l'installeur `.exe`

### Publication GitHub Release automatique

Quand tu pushes un tag de version (`v1.0.0`, `v1.1.0`, etc.), le workflow:
- build l'installeur Windows
- crée une GitHub Release
- attache automatiquement les fichiers `.exe` et métadonnées de mise à jour

Exemple:

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Signature Windows (recommandé)

Pour réduire l'alerte SmartScreen, configure un certificat de signature de code dans les secrets GitHub.

Secrets requis:
1. `WIN_CSC_LINK`: contenu du certificat `.pfx` encodé en base64 (ou URL de téléchargement sécurisée)
2. `WIN_CSC_KEY_PASSWORD`: mot de passe du certificat

Exemple pour générer la valeur base64 du `.pfx`:

```bash
base64 -i certificat.pfx | pbcopy
```

Puis:
1. GitHub > Settings > Secrets and variables > Actions
2. Ajouter `WIN_CSC_LINK` et coller la valeur base64
3. Ajouter `WIN_CSC_KEY_PASSWORD`

Sans ces secrets, le workflow fonctionne quand même mais génère un installateur non signé.

Pour télécharger l'installeur:
1. Ouvrir GitHub > Actions
2. Ouvrir un run du workflow `Electron Windows Build`
3. Télécharger l'artefact `egk-electron-windows`

### Stockage SQLite en desktop

En mode Electron, la base SQLite et les sauvegardes sont stockées dans le dossier utilisateur de l'application (persistant sur le disque Windows), et non dans `data/` du projet.

## Déploiement sur Vercel

Le projet est configuré pour Vercel via `vercel.json` + entrée serverless `api/index.js`.

### Étapes

1. Push du projet sur GitHub
2. Import du repo dans Vercel
3. Framework Preset: `Other`
4. Build Command: laisser vide
5. Output Directory: laisser vide
6. Deploy

### Important (SQLite)

Sur Vercel, SQLite est stocké dans `/tmp` (éphémère). Les données peuvent être perdues entre redémarrages/cold starts.

Pour de la production durable, migrer la base vers un service persistant (PostgreSQL, MySQL, etc.).

### Mode développement

```bash
npm run dev
```

## Auto-initialisation DB

Au démarrage du serveur:
- création automatique du fichier SQLite si absent
- création automatique des tables MERISE si absentes
- insertion automatique d'un jeu de données initial si DB vide

Fichier DB: `data/egk.sqlite`

## API principale

- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `GET /api/clients`
- `POST /api/clients`
- `PUT /api/clients/:id`
- `DELETE /api/clients/:id`
- `GET /api/mouvements`
- `POST /api/mouvements`
- `PUT /api/mouvements/:num_op/:id_prod`
- `DELETE /api/mouvements/:num_op/:id_prod`
- `GET /api/commandes`
- `GET /api/commandes/:id`
- `GET /api/commandes/:id/history`
- `POST /api/commandes`
- `PUT /api/commandes/:id`
- `DELETE /api/commandes/:id`
- `PUT /api/commandes/:id/validate`
- `PUT /api/commandes/:id/status`
- `GET /api/dashboard/kpis`
- `GET /api/audit`
- `GET /api/stocksheet/:id_prod`
- `GET /api/system/backups`
- `POST /api/system/backups`
- `POST /api/system/backups/restore`

## Architecture

```text
/backend
  /routes
  /controllers
  /models
  /db
  /services
  /middlewares
/frontend
  /components
  /pages
  /services
```

## Vérification rapide du flux

1. Créer un produit (Produits)
2. Ajouter une entrée de stock (Mouvements)
3. Créer une commande validée (Commandes)
4. Vérifier la baisse du stock (Produits + Fiche de stock)

Bonne chance
