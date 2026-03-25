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
