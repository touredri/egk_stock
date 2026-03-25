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
