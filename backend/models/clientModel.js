const db = require('../db/database');

function listClients({ q = '', page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const search = `%${q.trim()}%`;

  const data = db
    .prepare(
      `SELECT id_client, nom, prenom, ville, telephone
       FROM Client
       WHERE nom LIKE ? OR prenom LIKE ? OR ville LIKE ? OR telephone LIKE ? OR CAST(id_client AS TEXT) LIKE ?
       ORDER BY id_client DESC
       LIMIT ? OFFSET ?`
    )
    .all(search, search, search, search, search, limit, offset);

  const total = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM Client
       WHERE nom LIKE ? OR prenom LIKE ? OR ville LIKE ? OR telephone LIKE ? OR CAST(id_client AS TEXT) LIKE ?`
    )
     .get(search, search, search, search, search).c;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

function getClientById(idClient) {
  return db
    .prepare('SELECT id_client, nom, prenom, ville, telephone FROM Client WHERE id_client = ?')
    .get(idClient);
}

function createClient({ nom, prenom, ville, telephone }) {
  const result = db
    .prepare('INSERT INTO Client (nom, prenom, ville, telephone) VALUES (?, ?, ?, ?)')
    .run(nom.trim(), prenom.trim(), ville.trim(), telephone.trim());
  return getClientById(result.lastInsertRowid);
}

function updateClient(idClient, { nom, prenom, ville, telephone }) {
  db.prepare('UPDATE Client SET nom = ?, prenom = ?, ville = ?, telephone = ? WHERE id_client = ?').run(
    nom.trim(),
    prenom.trim(),
    ville.trim(),
    telephone.trim(),
    idClient
  );
  return getClientById(idClient);
}

function deleteClient(idClient) {
  return db.prepare('DELETE FROM Client WHERE id_client = ?').run(idClient);
}

function hasCommandes(idClient) {
  return db.prepare('SELECT COUNT(*) AS c FROM Commande WHERE id_client = ?').get(idClient).c > 0;
}

module.exports = {
  listClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  hasCommandes
};
