const db = require('../db/database');

function getCurrentStock(idProd) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN type_mvt = 'ENTREE' THEN qte_op ELSE -qte_op END), 0) AS stock
       FROM Mouvement
       WHERE id_prod = ?`
    )
    .get(idProd);
  return row ? row.stock : 0;
}

function listProducts({ q = '', page = 1, limit = 20, stock_status = '' }) {
  const offset = (page - 1) * limit;
  const search = `%${q.trim()}%`;

  let statusWhere = '';
  if (stock_status === 'LOW') {
    statusWhere = 'WHERE s.stock_actuel <= s.stock_min';
  } else if (stock_status === 'HIGH') {
    statusWhere = 'WHERE s.stock_actuel >= s.stock_max';
  } else if (stock_status === 'OK') {
    statusWhere = 'WHERE s.stock_actuel > s.stock_min AND s.stock_actuel < s.stock_max';
  }

  const baseFrom = `
    FROM (
      SELECT
        p.id_prod,
        p.libelle,
        p.pu,
        p.stock_min,
        p.stock_max,
        COALESCE(SUM(CASE WHEN m.type_mvt = 'ENTREE' THEN m.qte_op ELSE -m.qte_op END), 0) AS stock_actuel
      FROM Product p
      LEFT JOIN Mouvement m ON m.id_prod = p.id_prod
      WHERE p.libelle LIKE ? OR CAST(p.id_prod AS TEXT) LIKE ?
      GROUP BY p.id_prod
    ) s
  `;

  const rows = db
    .prepare(
      `SELECT
         s.id_prod,
         s.libelle,
         s.pu,
         s.stock_min,
         s.stock_max,
         s.stock_actuel
       ${baseFrom}
       ${statusWhere}
       ORDER BY s.id_prod DESC
       LIMIT ? OFFSET ?`
    )
    .all(search, search, limit, offset)
    .map((product) => ({
      ...product,
      stock_status:
        product.stock_actuel <= product.stock_min
          ? 'LOW'
          : product.stock_actuel >= product.stock_max
          ? 'HIGH'
          : 'OK'
    }));

  const total = db
    .prepare(
      `SELECT COUNT(*) AS c
       ${baseFrom}
       ${statusWhere}`
    )
    .get(search, search).c;

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

function getProductById(idProd) {
  const product = db
    .prepare('SELECT id_prod, libelle, pu, stock_min, stock_max FROM Product WHERE id_prod = ?')
    .get(idProd);

  if (!product) return null;

  const stock_actuel = getCurrentStock(idProd);
  return {
    ...product,
    stock_actuel,
    stock_status:
      stock_actuel <= product.stock_min ? 'LOW' : stock_actuel >= product.stock_max ? 'HIGH' : 'OK'
  };
}

function createProduct({ libelle, pu, stock_min, stock_max }) {
  const result = db
    .prepare('INSERT INTO Product (libelle, pu, stock_min, stock_max) VALUES (?, ?, ?, ?)')
    .run(libelle.trim(), pu, stock_min, stock_max);
  return getProductById(result.lastInsertRowid);
}

function updateProduct(idProd, { libelle, pu, stock_min, stock_max }) {
  db.prepare(
    'UPDATE Product SET libelle = ?, pu = ?, stock_min = ?, stock_max = ? WHERE id_prod = ?'
  ).run(libelle.trim(), pu, stock_min, stock_max, idProd);
  return getProductById(idProd);
}

function deleteProduct(idProd) {
  return db.prepare('DELETE FROM Product WHERE id_prod = ?').run(idProd);
}

function hasRelatedData(idProd) {
  const m = db.prepare('SELECT COUNT(*) AS c FROM Mouvement WHERE id_prod = ?').get(idProd).c;
  const c = db.prepare('SELECT COUNT(*) AS c FROM Concerne WHERE id_prod = ?').get(idProd).c;
  return m > 0 || c > 0;
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCurrentStock,
  hasRelatedData
};
