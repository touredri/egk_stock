# Annexe technique - SQL complet, init.js et schemas

## 1) SQL complet (creation des tables)

```sql
CREATE TABLE IF NOT EXISTS Product (
  id_prod INTEGER PRIMARY KEY AUTOINCREMENT,
  libelle TEXT NOT NULL UNIQUE,
  pu REAL NOT NULL CHECK (pu > 0),
  stock_min INTEGER NOT NULL CHECK (stock_min >= 0),
  stock_max INTEGER NOT NULL CHECK (stock_max >= stock_min)
);

CREATE TABLE IF NOT EXISTS Client (
  id_client INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  ville TEXT NOT NULL,
  telephone TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Commande (
  num_com INTEGER PRIMARY KEY AUTOINCREMENT,
  date_com TEXT NOT NULL,
  etat_com INTEGER NOT NULL DEFAULT 0 CHECK (etat_com IN (0, 1)),
  statut_com TEXT NOT NULL DEFAULT 'BROUILLON' CHECK (statut_com IN ('BROUILLON', 'VALIDEE', 'LIVREE', 'ANNULEE')),
  date_validation TEXT,
  date_livraison TEXT,
  date_annulation TEXT,
  id_client INTEGER NOT NULL,
  FOREIGN KEY (id_client) REFERENCES Client(id_client) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Operation (
  num_op INTEGER PRIMARY KEY AUTOINCREMENT,
  date_op TEXT NOT NULL,
  lib_op TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Mouvement (
  num_op INTEGER NOT NULL,
  id_prod INTEGER NOT NULL,
  type_mvt TEXT NOT NULL CHECK (type_mvt IN ('ENTREE', 'SORTIE')),
  qte_op INTEGER NOT NULL CHECK (qte_op > 0),
  PRIMARY KEY (num_op, id_prod),
  FOREIGN KEY (num_op) REFERENCES Operation(num_op) ON DELETE CASCADE,
  FOREIGN KEY (id_prod) REFERENCES Product(id_prod) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Concerne (
  num_com INTEGER NOT NULL,
  id_prod INTEGER NOT NULL,
  qte_com INTEGER NOT NULL CHECK (qte_com > 0),
  PRIMARY KEY (num_com, id_prod),
  FOREIGN KEY (num_com) REFERENCES Commande(num_com) ON DELETE CASCADE,
  FOREIGN KEY (id_prod) REFERENCES Product(id_prod) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id_audit INTEGER PRIMARY KEY AUTOINCREMENT,
  date_audit TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT
);
```

## 2) SQL de migration applique dans init.js

Ce SQL permet de rendre compatible une ancienne table Commande avec la nouvelle gestion de statut.

```sql
ALTER TABLE Commande ADD COLUMN statut_com TEXT NOT NULL DEFAULT 'BROUILLON' CHECK (statut_com IN ('BROUILLON', 'VALIDEE', 'LIVREE', 'ANNULEE'));
ALTER TABLE Commande ADD COLUMN date_validation TEXT;
ALTER TABLE Commande ADD COLUMN date_livraison TEXT;
ALTER TABLE Commande ADD COLUMN date_annulation TEXT;

UPDATE Commande
SET statut_com = CASE WHEN etat_com = 1 THEN 'VALIDEE' ELSE 'BROUILLON' END
WHERE statut_com IS NULL OR statut_com NOT IN ('BROUILLON', 'VALIDEE', 'LIVREE', 'ANNULEE');

UPDATE Commande
SET statut_com = 'VALIDEE', date_validation = COALESCE(date_validation, date_com)
WHERE etat_com = 1 AND statut_com = 'BROUILLON';

UPDATE Commande
SET etat_com = 1
WHERE statut_com IN ('VALIDEE', 'LIVREE') AND etat_com = 0;
```

## 3) Fichier init.js complet

```js
const db = require('./database');

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Product (
      id_prod INTEGER PRIMARY KEY AUTOINCREMENT,
      libelle TEXT NOT NULL UNIQUE,
      pu REAL NOT NULL CHECK (pu > 0),
      stock_min INTEGER NOT NULL CHECK (stock_min >= 0),
      stock_max INTEGER NOT NULL CHECK (stock_max >= stock_min)
    );

    CREATE TABLE IF NOT EXISTS Client (
      id_client INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      ville TEXT NOT NULL,
      telephone TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS Commande (
      num_com INTEGER PRIMARY KEY AUTOINCREMENT,
      date_com TEXT NOT NULL,
      etat_com INTEGER NOT NULL DEFAULT 0 CHECK (etat_com IN (0, 1)),
      statut_com TEXT NOT NULL DEFAULT 'BROUILLON' CHECK (statut_com IN ('BROUILLON', 'VALIDEE', 'LIVREE', 'ANNULEE')),
      date_validation TEXT,
      date_livraison TEXT,
      date_annulation TEXT,
      id_client INTEGER NOT NULL,
      FOREIGN KEY (id_client) REFERENCES Client(id_client) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS Operation (
      num_op INTEGER PRIMARY KEY AUTOINCREMENT,
      date_op TEXT NOT NULL,
      lib_op TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Mouvement (
      num_op INTEGER NOT NULL,
      id_prod INTEGER NOT NULL,
      type_mvt TEXT NOT NULL CHECK (type_mvt IN ('ENTREE', 'SORTIE')),
      qte_op INTEGER NOT NULL CHECK (qte_op > 0),
      PRIMARY KEY (num_op, id_prod),
      FOREIGN KEY (num_op) REFERENCES Operation(num_op) ON DELETE CASCADE,
      FOREIGN KEY (id_prod) REFERENCES Product(id_prod) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS Concerne (
      num_com INTEGER NOT NULL,
      id_prod INTEGER NOT NULL,
      qte_com INTEGER NOT NULL CHECK (qte_com > 0),
      PRIMARY KEY (num_com, id_prod),
      FOREIGN KEY (num_com) REFERENCES Commande(num_com) ON DELETE CASCADE,
      FOREIGN KEY (id_prod) REFERENCES Product(id_prod) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS AuditLog (
      id_audit INTEGER PRIMARY KEY AUTOINCREMENT,
      date_audit TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      detail TEXT
    );
  `);
}

function ensureCommandeStatusColumns() {
  const columns = db.prepare('PRAGMA table_info(Commande)').all();
  const names = new Set(columns.map((c) => c.name));

  if (!names.has('statut_com')) {
    db.exec(
      "ALTER TABLE Commande ADD COLUMN statut_com TEXT NOT NULL DEFAULT 'BROUILLON' CHECK (statut_com IN ('BROUILLON', 'VALIDEE', 'LIVREE', 'ANNULEE'))"
    );
  }

  if (!names.has('date_validation')) {
    db.exec('ALTER TABLE Commande ADD COLUMN date_validation TEXT');
  }

  if (!names.has('date_livraison')) {
    db.exec('ALTER TABLE Commande ADD COLUMN date_livraison TEXT');
  }

  if (!names.has('date_annulation')) {
    db.exec('ALTER TABLE Commande ADD COLUMN date_annulation TEXT');
  }

  db.exec(`
    UPDATE Commande
    SET statut_com = CASE WHEN etat_com = 1 THEN 'VALIDEE' ELSE 'BROUILLON' END
    WHERE statut_com IS NULL OR statut_com NOT IN ('BROUILLON', 'VALIDEE', 'LIVREE', 'ANNULEE');
  `);

  db.exec(`
    UPDATE Commande
    SET statut_com = 'VALIDEE', date_validation = COALESCE(date_validation, date_com)
    WHERE etat_com = 1 AND statut_com = 'BROUILLON';
  `);

  db.exec(`
    UPDATE Commande
    SET etat_com = 1
    WHERE statut_com IN ('VALIDEE', 'LIVREE') AND etat_com = 0;
  `);
}

function seedData() {
  const productCount = db.prepare('SELECT COUNT(*) as c FROM Product').get().c;
  if (productCount === 0) {
    const insertProduct = db.prepare(
      'INSERT INTO Product (libelle, pu, stock_min, stock_max) VALUES (?, ?, ?, ?)'
    );
    insertProduct.run('Ciment 50kg', 95, 20, 500);
    insertProduct.run('Sable fin (m3)', 240, 10, 300);
    insertProduct.run('Gravier (m3)', 260, 10, 300);
    insertProduct.run('Brouette pro', 820, 2, 50);
    insertProduct.run('Pelle acier', 180, 5, 100);
  }

  const clientCount = db.prepare('SELECT COUNT(*) as c FROM Client').get().c;
  if (clientCount === 0) {
    const insertClient = db.prepare(
      'INSERT INTO Client (nom, prenom, ville, telephone) VALUES (?, ?, ?, ?)'
    );
    insertClient.run('Diallo', 'Moussa', 'Dakar', '770000001');
    insertClient.run('Traore', 'Awa', 'Thiès', '770000002');
    insertClient.run('Ndiaye', 'Ibrahima', 'Mbour', '770000003');
  }

  const opCount = db.prepare('SELECT COUNT(*) as c FROM Operation').get().c;
  if (opCount === 0) {
    const transaction = db.transaction(() => {
      const operationStmt = db.prepare('INSERT INTO Operation (date_op, lib_op) VALUES (?, ?)');
      const mouvementStmt = db.prepare(
        'INSERT INTO Mouvement (num_op, id_prod, type_mvt, qte_op) VALUES (?, ?, ?, ?)'
      );
      const now = new Date().toISOString();

      const op1 = operationStmt.run(now, 'Stock initial ENTREE').lastInsertRowid;
      mouvementStmt.run(op1, 1, 'ENTREE', 120);
      mouvementStmt.run(op1, 2, 'ENTREE', 80);
      mouvementStmt.run(op1, 3, 'ENTREE', 75);
      mouvementStmt.run(op1, 4, 'ENTREE', 10);
      mouvementStmt.run(op1, 5, 'ENTREE', 25);

      const op2 = operationStmt.run(now, 'Sortie test initiale').lastInsertRowid;
      mouvementStmt.run(op2, 1, 'SORTIE', 15);
      mouvementStmt.run(op2, 5, 'SORTIE', 3);
    });

    transaction();
  }
}

function initDatabase() {
  createTables();
  ensureCommandeStatusColumns();
  seedData();
}

module.exports = { initDatabase };
```

## 4) Schemas (lecture simple)

### 4.1 Schema conceptuel simplifie (vue metier)

- Un Client passe 0..N Commande
- Une Commande appartient a 1 Client
- Une Commande concerne 1..N Product via Concerne (avec quantite qte_com)
- Un Product peut apparaitre dans 0..N Commande via Concerne
- Une Operation contient 1..N Mouvement
- Un Mouvement concerne 1 Product
- Un Product peut apparaitre dans 0..N Mouvement

### 4.2 Schema relationnel (MLD/MPD)

- Product(id_prod PK, libelle UQ, pu, stock_min, stock_max)
- Client(id_client PK, nom, prenom, ville, telephone UQ)
- Commande(num_com PK, date_com, etat_com, statut_com, date_validation, date_livraison, date_annulation, id_client FK->Client)
- Operation(num_op PK, date_op, lib_op)
- Mouvement(num_op PK/FK->Operation, id_prod PK/FK->Product, type_mvt, qte_op)
- Concerne(num_com PK/FK->Commande, id_prod PK/FK->Product, qte_com)
- AuditLog(id_audit PK, date_audit, action, entity_type, entity_id, detail)

### 4.3 Cardinalites cle

- Client (1,1) ---- (0,N) Commande
- Commande (1,1) ---- (1,N) Concerne ---- (0,N) Product
- Operation (1,1) ---- (1,N) Mouvement ---- (0,N) Product

## 5) Note de justification (Merise + modernisation)

Le projet respecte une demarche Merise modernisee:

- MCD: entites metier et associations identifiees
- MLD/MPD: tables, cles et contraintes implementees en SQL
- Regles de gestion: enforcees par contraintes SQL + services metier
- Outil: SQLite