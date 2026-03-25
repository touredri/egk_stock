const db = require('../db/database');
const { getClientById } = require('../models/clientModel');
const { getProductById, getCurrentStock } = require('../models/productModel');
const {
  getCommandeById,
  replaceCommandeLines,
  updateCommandeDraftRecord,
  deleteCommandeDraftRecord
} = require('../models/commandeModel');
const { httpError } = require('./httpError');

function validateOrderPayload({ id_client, produits }) {
  if (!id_client || !Number.isInteger(Number(id_client))) {
    throw httpError(400, 'VALIDATION_ERROR', 'id_client invalide.');
  }

  if (!Array.isArray(produits) || produits.length === 0) {
    throw httpError(400, 'ORDER_EMPTY', 'Une commande doit contenir au moins un produit.');
  }

  const ids = new Set();
  for (const line of produits) {
    if (!line.id_prod || !Number.isInteger(Number(line.id_prod))) {
      throw httpError(400, 'VALIDATION_ERROR', 'Chaque ligne doit contenir id_prod valide.');
    }

    if (ids.has(line.id_prod)) {
      throw httpError(400, 'DUPLICATE_PRODUCT_LINE', 'Un produit ne peut apparaître qu’une seule fois dans la commande.');
    }

    ids.add(line.id_prod);

    if (!Number.isInteger(Number(line.qte_com)) || Number(line.qte_com) <= 0) {
      throw httpError(400, 'VALIDATION_ERROR', 'qte_com doit être un entier positif.');
    }
  }
}

function assertStockForOrderLines(lines) {
  for (const line of lines) {
    const product = getProductById(line.id_prod);
    if (!product) {
      throw httpError(404, 'PRODUCT_NOT_FOUND', `Produit ${line.id_prod} introuvable.`);
    }

    const currentStock = getCurrentStock(line.id_prod);
    if (line.qte_com > currentStock) {
      throw httpError(
        400,
        'STOCK_INSUFFISANT',
        `Stock insuffisant pour ${product.libelle}: disponible ${currentStock}, demandé ${line.qte_com}.`
      );
    }

    if (currentStock - line.qte_com < product.stock_min) {
      throw httpError(
        400,
        'STOCK_MIN_VIOLATION',
        `Validation refusée: ${product.libelle} passerait sous le stock minimum (${product.stock_min}).`
      );
    }
  }
}

function applyValidationTransaction(numCom, dateOp = new Date().toISOString()) {
  const existing = db
    .prepare('SELECT num_com, etat_com, statut_com FROM Commande WHERE num_com = ?')
    .get(numCom);
  if (!existing) {
    throw httpError(404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
  }

  if (existing.etat_com === 1 || existing.statut_com === 'VALIDEE' || existing.statut_com === 'LIVREE') {
    throw httpError(400, 'ORDER_ALREADY_VALIDATED', 'Cette commande est déjà validée.');
  }

  if (existing.statut_com === 'ANNULEE') {
    throw httpError(400, 'ORDER_CANCELLED', 'Une commande annulée ne peut pas être validée.');
  }

  const lines = db.prepare('SELECT id_prod, qte_com FROM Concerne WHERE num_com = ?').all(numCom);
  if (lines.length === 0) {
    throw httpError(400, 'ORDER_EMPTY', 'Une commande doit contenir au moins un produit.');
  }

  // Vérification métier complète avant toute écriture: pas de stock négatif ni sous stock_min.
  assertStockForOrderLines(lines);

  const opResult = db
    .prepare('INSERT INTO Operation (date_op, lib_op) VALUES (?, ?)')
    .run(dateOp, `Validation commande #${numCom}`);

  const insertMvt = db.prepare(
    'INSERT INTO Mouvement (num_op, id_prod, type_mvt, qte_op) VALUES (?, ?, ?, ?)'
  );

  for (const line of lines) {
    // Chaque ligne validée génère un mouvement SORTIE traçable dans l'historique de stock.
    insertMvt.run(opResult.lastInsertRowid, line.id_prod, 'SORTIE', line.qte_com);
  }

  db.prepare(
    'UPDATE Commande SET etat_com = 1, statut_com = ?, date_validation = ?, date_annulation = NULL WHERE num_com = ?'
  ).run('VALIDEE', dateOp, numCom);
}

function createCommande({ id_client, produits, etat_com = false, date_com }) {
  validateOrderPayload({ id_client, produits });

  const client = getClientById(Number(id_client));
  if (!client) {
    throw httpError(404, 'CLIENT_NOT_FOUND', 'Client introuvable.');
  }

  const normalizedLines = produits.map((line) => ({
    id_prod: Number(line.id_prod),
    qte_com: Number(line.qte_com)
  }));

  for (const line of normalizedLines) {
    if (!getProductById(line.id_prod)) {
      throw httpError(404, 'PRODUCT_NOT_FOUND', `Produit ${line.id_prod} introuvable.`);
    }
  }

  const transaction = db.transaction(() => {
    const orderDate = date_com || new Date().toISOString();

    const orderResult = db
      .prepare('INSERT INTO Commande (date_com, etat_com, statut_com, id_client) VALUES (?, ?, ?, ?)')
      .run(orderDate, 0, 'BROUILLON', Number(id_client));

    const numCom = orderResult.lastInsertRowid;
    const insertLine = db.prepare('INSERT INTO Concerne (num_com, id_prod, qte_com) VALUES (?, ?, ?)');

    for (const line of normalizedLines) {
      insertLine.run(numCom, line.id_prod, line.qte_com);
    }

    if (etat_com) {
      applyValidationTransaction(numCom, orderDate);
    }

    return numCom;
  });

  const numCom = transaction();
  return getCommandeById(numCom);
}

function validateCommande(numCom) {
  const transaction = db.transaction(() => {
    applyValidationTransaction(numCom);
  });

  transaction();
  return getCommandeById(numCom);
}

function changeCommandeStatus(numCom, statutCom) {
  const allowedStatuses = ['BROUILLON', 'VALIDEE', 'LIVREE', 'ANNULEE'];
  if (!allowedStatuses.includes(statutCom)) {
    throw httpError(400, 'VALIDATION_ERROR', 'Statut commande invalide.');
  }

  const order = db
    .prepare('SELECT num_com, etat_com, statut_com FROM Commande WHERE num_com = ?')
    .get(numCom);

  if (!order) {
    throw httpError(404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
  }

  const currentStatus =
    order.etat_com === 1 && order.statut_com === 'BROUILLON' ? 'VALIDEE' : order.statut_com;

  if (currentStatus === statutCom) {
    return getCommandeById(numCom);
  }

  const now = new Date().toISOString();

  if (statutCom === 'VALIDEE') {
    return validateCommande(numCom);
  }

  if (statutCom === 'LIVREE') {
    if (currentStatus !== 'VALIDEE') {
      throw httpError(400, 'INVALID_STATUS_TRANSITION', 'Seule une commande validée peut passer en livrée.');
    }

    db.prepare('UPDATE Commande SET statut_com = ?, date_livraison = ? WHERE num_com = ?').run(
      'LIVREE',
      now,
      numCom
    );
    return getCommandeById(numCom);
  }

  if (statutCom === 'ANNULEE') {
    if (currentStatus !== 'BROUILLON') {
      throw httpError(
        400,
        'INVALID_STATUS_TRANSITION',
        'Seule une commande brouillon peut être annulée (pas de rollback stock).'
      );
    }

    db.prepare('UPDATE Commande SET statut_com = ?, date_annulation = ? WHERE num_com = ?').run(
      'ANNULEE',
      now,
      numCom
    );
    return getCommandeById(numCom);
  }

  throw httpError(400, 'INVALID_STATUS_TRANSITION', 'Transition de statut non autorisée.');
}

function assertDraftOrder(numCom) {
  const order = db
    .prepare('SELECT num_com, etat_com, statut_com FROM Commande WHERE num_com = ?')
    .get(numCom);

  if (!order) {
    throw httpError(404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
  }

  const currentStatus =
    order.etat_com === 1 && order.statut_com === 'BROUILLON' ? 'VALIDEE' : order.statut_com;

  if (currentStatus !== 'BROUILLON' || order.etat_com === 1) {
    throw httpError(400, 'ORDER_NOT_EDITABLE', 'Seules les commandes brouillon peuvent être modifiées/supprimées.');
  }
}

function updateCommandeDraft(numCom, { id_client, produits }) {
  assertDraftOrder(numCom);
  validateOrderPayload({ id_client, produits });

  const client = getClientById(Number(id_client));
  if (!client) {
    throw httpError(404, 'CLIENT_NOT_FOUND', 'Client introuvable.');
  }

  const normalizedLines = produits.map((line) => ({
    id_prod: Number(line.id_prod),
    qte_com: Number(line.qte_com)
  }));

  for (const line of normalizedLines) {
    if (!getProductById(line.id_prod)) {
      throw httpError(404, 'PRODUCT_NOT_FOUND', `Produit ${line.id_prod} introuvable.`);
    }
  }

  const transaction = db.transaction(() => {
    updateCommandeDraftRecord(numCom, { id_client: Number(id_client) });
    replaceCommandeLines(numCom, normalizedLines);
  });

  transaction();
  return getCommandeById(numCom);
}

function deleteCommandeDraft(numCom) {
  assertDraftOrder(numCom);

  const transaction = db.transaction(() => {
    deleteCommandeDraftRecord(numCom);
  });

  transaction();
  return { num_com: numCom };
}

module.exports = {
  createCommande,
  validateCommande,
  changeCommandeStatus,
  updateCommandeDraft,
  deleteCommandeDraft
};
