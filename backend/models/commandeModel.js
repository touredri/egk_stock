const db = require('../db/database');

function listCommandes({
  q = '',
  page = 1,
  limit = 20,
  etat_com = '',
  statut_com = '',
  date_from = '',
  date_to = '',
  id_client = ''
}) {
  const offset = (page - 1) * limit;
  const search = `%${q.trim()}%`;
  const whereParts = ['(cl.nom LIKE ? OR cl.prenom LIKE ? OR CAST(c.num_com AS TEXT) LIKE ?)'];
  const params = [search, search, search];

  if (etat_com === '0' || etat_com === '1') {
    whereParts.push('c.etat_com = ?');
    params.push(Number(etat_com));
  }

  if (['BROUILLON', 'VALIDEE', 'LIVREE', 'ANNULEE'].includes(statut_com)) {
    whereParts.push('c.statut_com = ?');
    params.push(statut_com);
  }

  if (date_from) {
    whereParts.push('DATE(c.date_com) >= DATE(?)');
    params.push(date_from);
  }

  if (date_to) {
    whereParts.push('DATE(c.date_com) <= DATE(?)');
    params.push(date_to);
  }

  if (Number.isInteger(Number(id_client)) && Number(id_client) > 0) {
    whereParts.push('c.id_client = ?');
    params.push(Number(id_client));
  }

  const whereSql = whereParts.join(' AND ');

  const data = db
    .prepare(
      `SELECT
         c.num_com,
         c.date_com,
         c.etat_com,
        CASE WHEN c.etat_com = 1 AND c.statut_com = 'BROUILLON' THEN 'VALIDEE' ELSE c.statut_com END AS statut_com,
         c.date_validation,
         c.date_livraison,
         c.date_annulation,
         c.id_client,
         cl.nom,
         cl.prenom,
         COALESCE(SUM(co.qte_com * p.pu), 0) AS montant_total,
         COUNT(co.id_prod) AS nb_lignes
       FROM Commande c
       JOIN Client cl ON cl.id_client = c.id_client
       LEFT JOIN Concerne co ON co.num_com = c.num_com
       LEFT JOIN Product p ON p.id_prod = co.id_prod
       WHERE ${whereSql}
       GROUP BY c.num_com
       ORDER BY c.date_com DESC, c.num_com DESC
       LIMIT ? OFFSET ?`
    )
     .all(...params, limit, offset);

  const total = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM Commande c
       JOIN Client cl ON cl.id_client = c.id_client
       WHERE ${whereSql}`
    )
     .get(...params).c;

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

function getCommandeById(numCom) {
  const commande = db
    .prepare(
            `SELECT c.num_com, c.date_com, c.etat_com,
              CASE WHEN c.etat_com = 1 AND c.statut_com = 'BROUILLON' THEN 'VALIDEE' ELSE c.statut_com END AS statut_com,
              c.date_validation, c.date_livraison, c.date_annulation, c.id_client, cl.nom, cl.prenom
       FROM Commande c
       JOIN Client cl ON cl.id_client = c.id_client
       WHERE c.num_com = ?`
    )
    .get(numCom);

  if (!commande) return null;

  const lignes = db
    .prepare(
      `SELECT co.id_prod, p.libelle, co.qte_com, p.pu, (co.qte_com * p.pu) AS sous_total
       FROM Concerne co
       JOIN Product p ON p.id_prod = co.id_prod
       WHERE co.num_com = ?`
    )
    .all(numCom);

  const montant_total = lignes.reduce((acc, line) => acc + line.sous_total, 0);

  return { ...commande, lignes, montant_total };
}

function listCommandeHistory(numCom, limit = 30) {
  return db
    .prepare(
      `SELECT id_audit, date_audit, action, detail
       FROM AuditLog
       WHERE entity_id = ?
         AND UPPER(entity_type) = 'COMMANDE'
       ORDER BY date_audit ASC, id_audit ASC
       LIMIT ?`
    )
    .all(String(numCom), Math.max(1, Math.min(200, Number(limit) || 30)));
}

function replaceCommandeLines(numCom, lignes) {
  db.prepare('DELETE FROM Concerne WHERE num_com = ?').run(numCom);
  const insert = db.prepare('INSERT INTO Concerne (num_com, id_prod, qte_com) VALUES (?, ?, ?)');
  for (const line of lignes) {
    insert.run(numCom, line.id_prod, line.qte_com);
  }
}

function updateCommandeDraftRecord(numCom, { id_client }) {
  db.prepare('UPDATE Commande SET id_client = ? WHERE num_com = ?').run(id_client, numCom);
}

function deleteCommandeDraftRecord(numCom) {
  db.prepare('DELETE FROM Concerne WHERE num_com = ?').run(numCom);
  db.prepare('DELETE FROM Commande WHERE num_com = ?').run(numCom);
}

module.exports = {
  listCommandes,
  getCommandeById,
  listCommandeHistory,
  replaceCommandeLines,
  updateCommandeDraftRecord,
  deleteCommandeDraftRecord
};
