const db = require('../db/database');

function listMouvements({ q = '', page = 1, limit = 20, type_mvt = '', date_from = '', date_to = '', id_prod = '' }) {
  const offset = (page - 1) * limit;
  const search = `%${q.trim()}%`;
  const whereParts = [
    '(p.libelle LIKE ? OR o.lib_op LIKE ? OR m.type_mvt LIKE ? OR CAST(o.num_op AS TEXT) LIKE ? OR CAST(m.id_prod AS TEXT) LIKE ?)'
  ];
  const params = [search, search, search, search, search];

  if (type_mvt === 'ENTREE' || type_mvt === 'SORTIE') {
    whereParts.push('m.type_mvt = ?');
    params.push(type_mvt);
  }

  if (date_from) {
    whereParts.push('DATE(o.date_op) >= DATE(?)');
    params.push(date_from);
  }

  if (date_to) {
    whereParts.push('DATE(o.date_op) <= DATE(?)');
    params.push(date_to);
  }

  if (Number.isInteger(Number(id_prod)) && Number(id_prod) > 0) {
    whereParts.push('m.id_prod = ?');
    params.push(Number(id_prod));
  }

  const whereSql = whereParts.join(' AND ');

  const data = db
    .prepare(
      `SELECT
         o.num_op,
         o.date_op,
         o.lib_op,
         m.id_prod,
         p.libelle,
         m.type_mvt,
         m.qte_op
       FROM Mouvement m
       JOIN Operation o ON o.num_op = m.num_op
       JOIN Product p ON p.id_prod = m.id_prod
       WHERE ${whereSql}
       ORDER BY o.date_op DESC, o.num_op DESC
       LIMIT ? OFFSET ?`
    )
     .all(...params, limit, offset);

  const total = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM Mouvement m
       JOIN Operation o ON o.num_op = m.num_op
       JOIN Product p ON p.id_prod = m.id_prod
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

function getMouvementByKey(numOp, idProd) {
  return db
    .prepare(
      `SELECT
         o.num_op,
         o.date_op,
         o.lib_op,
         m.id_prod,
         p.libelle,
         p.stock_min,
         p.stock_max,
         m.type_mvt,
         m.qte_op
       FROM Mouvement m
       JOIN Operation o ON o.num_op = m.num_op
       JOIN Product p ON p.id_prod = m.id_prod
       WHERE m.num_op = ? AND m.id_prod = ?`
    )
    .get(numOp, idProd);
}

function getOperationMouvementCount(numOp) {
  return db.prepare('SELECT COUNT(*) AS c FROM Mouvement WHERE num_op = ?').get(numOp).c;
}

function updateMouvementByKey({ oldNumOp, oldIdProd, idProd, typeMvt, qteOp, libOp, dateOp }) {
  db.prepare('UPDATE Operation SET date_op = ?, lib_op = ? WHERE num_op = ?').run(dateOp, libOp, oldNumOp);

  if (Number(oldIdProd) !== Number(idProd)) {
    db.prepare('DELETE FROM Mouvement WHERE num_op = ? AND id_prod = ?').run(oldNumOp, oldIdProd);
    db.prepare('INSERT INTO Mouvement (num_op, id_prod, type_mvt, qte_op) VALUES (?, ?, ?, ?)').run(
      oldNumOp,
      idProd,
      typeMvt,
      qteOp
    );
    return;
  }

  db.prepare('UPDATE Mouvement SET type_mvt = ?, qte_op = ? WHERE num_op = ? AND id_prod = ?').run(
    typeMvt,
    qteOp,
    oldNumOp,
    oldIdProd
  );
}

function deleteMouvementByKey(numOp, idProd) {
  db.prepare('DELETE FROM Mouvement WHERE num_op = ? AND id_prod = ?').run(numOp, idProd);
  const remaining = getOperationMouvementCount(numOp);
  if (remaining === 0) {
    db.prepare('DELETE FROM Operation WHERE num_op = ?').run(numOp);
  }
}

module.exports = {
  listMouvements,
  getMouvementByKey,
  getOperationMouvementCount,
  updateMouvementByKey,
  deleteMouvementByKey
};
