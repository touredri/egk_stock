const db = require('../db/database');

function getDashboardKpis(delayDays = 2) {
  const totalProducts = db.prepare('SELECT COUNT(*) AS c FROM Product').get().c;
  const totalMouvements = db.prepare('SELECT COUNT(*) AS c FROM Mouvement').get().c;
  const totalCommandes = db.prepare('SELECT COUNT(*) AS c FROM Commande').get().c;
  const safeDelayDays = Math.max(0, Number(delayDays) || 0);
  const delayCutoff = new Date(Date.now() - safeDelayDays * 24 * 60 * 60 * 1000).toISOString();

  const stocks = db
    .prepare(
      `SELECT
         p.id_prod,
         p.libelle,
         p.stock_min,
         p.stock_max,
         COALESCE(SUM(CASE WHEN m.type_mvt = 'ENTREE' THEN m.qte_op ELSE -m.qte_op END), 0) AS stock_actuel
       FROM Product p
       LEFT JOIN Mouvement m ON m.id_prod = p.id_prod
       GROUP BY p.id_prod
       ORDER BY p.libelle`
    )
    .all();

  const todayItems = {
    commandesBrouillon: db
      .prepare(
        `SELECT c.num_com, c.date_com, cl.nom, cl.prenom
         FROM Commande c
         JOIN Client cl ON cl.id_client = c.id_client
         WHERE c.statut_com = 'BROUILLON'
         ORDER BY c.date_com ASC
         LIMIT 8`
      )
      .all(),
    commandesALivrer: db
      .prepare(
        `SELECT c.num_com, c.date_com, c.date_validation, cl.nom, cl.prenom
         FROM Commande c
         JOIN Client cl ON cl.id_client = c.id_client
         WHERE c.statut_com = 'VALIDEE'
         ORDER BY COALESCE(c.date_validation, c.date_com) ASC
         LIMIT 8`
      )
      .all(),
    stocksCritiques: stocks
      .filter((s) => s.stock_actuel <= s.stock_min)
      .slice(0, 8)
      .map((s) => ({ id_prod: s.id_prod, libelle: s.libelle, stock_actuel: s.stock_actuel, stock_min: s.stock_min }))
  };

  const recentAudit = db
    .prepare(
      `SELECT id_audit, date_audit, action, entity_type, entity_id, detail
       FROM AuditLog
       ORDER BY date_audit DESC, id_audit DESC
       LIMIT 12`
    )
    .all();

  const delayedDeliveries = db
    .prepare(
      `SELECT c.num_com, c.date_com, c.date_validation, cl.nom, cl.prenom
       FROM Commande c
       JOIN Client cl ON cl.id_client = c.id_client
       WHERE c.statut_com = 'VALIDEE'
         AND COALESCE(c.date_validation, c.date_com) <= ?
       ORDER BY COALESCE(c.date_validation, c.date_com) ASC
       LIMIT 12`
    )
    .all(delayCutoff);

  return {
    totalProducts,
    totalMouvements,
    totalCommandes,
    lowStock: stocks.filter((s) => s.stock_actuel <= s.stock_min),
    overStock: stocks.filter((s) => s.stock_actuel >= s.stock_max),
    todayItems,
    delayedDeliveries: {
      threshold_days: safeDelayDays,
      items: delayedDeliveries
    },
    recentAudit
  };
}

function listAuditLogs({
  q = '',
  action = '',
  entity_type = '',
  date_from = '',
  date_to = '',
  page = 1,
  limit = 20
}) {
  const whereParts = ['(action LIKE ? OR entity_type LIKE ? OR detail LIKE ? OR COALESCE(entity_id, \'\') LIKE ?)'];
  const search = `%${q.trim()}%`;
  const params = [search, search, search, search];

  if (action) {
    whereParts.push('action = ?');
    params.push(action);
  }

  if (entity_type) {
    whereParts.push('entity_type = ?');
    params.push(entity_type);
  }

  if (date_from) {
    whereParts.push('DATE(date_audit) >= DATE(?)');
    params.push(date_from);
  }

  if (date_to) {
    whereParts.push('DATE(date_audit) <= DATE(?)');
    params.push(date_to);
  }

  const whereSql = whereParts.join(' AND ');
  const offset = (page - 1) * limit;

  const data = db
    .prepare(
      `SELECT id_audit, date_audit, action, entity_type, entity_id, detail
       FROM AuditLog
       WHERE ${whereSql}
       ORDER BY date_audit DESC, id_audit DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  const total = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM AuditLog
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

function getStockSheet(idProd) {
  const product = db
    .prepare('SELECT id_prod, libelle, pu, stock_min, stock_max FROM Product WHERE id_prod = ?')
    .get(idProd);

  if (!product) return null;

  const mouvements = db
    .prepare(
      `SELECT o.num_op, o.date_op, o.lib_op, m.type_mvt, m.qte_op
       FROM Mouvement m
       JOIN Operation o ON o.num_op = m.num_op
       WHERE m.id_prod = ?
       ORDER BY o.date_op ASC, o.num_op ASC`
    )
    .all(idProd);

  let balance = 0;
  const history = mouvements.map((m) => {
    balance += m.type_mvt === 'ENTREE' ? m.qte_op : -m.qte_op;
    return { ...m, balance };
  });

  const totalEntries = mouvements
    .filter((m) => m.type_mvt === 'ENTREE')
    .reduce((acc, m) => acc + m.qte_op, 0);
  const totalExits = mouvements
    .filter((m) => m.type_mvt === 'SORTIE')
    .reduce((acc, m) => acc + m.qte_op, 0);

  return {
    product,
    totalEntries,
    totalExits,
    currentBalance: balance,
    history
  };
}

module.exports = { getDashboardKpis, getStockSheet, listAuditLogs };
