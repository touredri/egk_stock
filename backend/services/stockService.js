const db = require('../db/database');
const { getProductById, getCurrentStock } = require('../models/productModel');
const { getMouvementByKey, updateMouvementByKey, deleteMouvementByKey } = require('../models/movementModel');
const { httpError } = require('./httpError');

function assertMovementAllowed(product, currentStock, typeMvt, qteOp) {
  if (typeMvt === 'SORTIE' && qteOp > currentStock) {
    throw httpError(400, 'STOCK_INSUFFISANT', `Stock insuffisant pour ${product.libelle}.`);
  }

  if (typeMvt === 'SORTIE' && currentStock - qteOp < product.stock_min) {
    throw httpError(
      400,
      'STOCK_MIN_VIOLATION',
      `Sortie refusée: le stock passerait sous le minimum (${product.stock_min}) pour ${product.libelle}.`
    );
  }

  if (typeMvt === 'ENTREE' && currentStock + qteOp > product.stock_max) {
    throw httpError(
      400,
      'STOCK_MAX_EXCEEDED',
      `Entrée refusée: dépassement du stock maximum (${product.stock_max}) pour ${product.libelle}.`
    );
  }
}

function createMovement({ id_prod, type_mvt, qte_op, lib_op, date_op }) {
  const product = getProductById(id_prod);
  if (!product) {
    throw httpError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
  }

  if (!['ENTREE', 'SORTIE'].includes(type_mvt)) {
    throw httpError(400, 'VALIDATION_ERROR', 'type_mvt doit être ENTREE ou SORTIE.');
  }

  const quantity = Number(qte_op);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw httpError(400, 'VALIDATION_ERROR', 'qte_op doit être un entier positif.');
  }

  const movementDate = date_op || new Date().toISOString();
  const operationLabel = lib_op?.trim() || `Mouvement ${type_mvt}`;

  const transaction = db.transaction(() => {
    // Contrôle dans la transaction pour éviter les incohérences si plusieurs actions arrivent en même temps.
    const currentStock = getCurrentStock(id_prod);
    assertMovementAllowed(product, currentStock, type_mvt, quantity);

    const opResult = db
      .prepare('INSERT INTO Operation (date_op, lib_op) VALUES (?, ?)')
      .run(movementDate, operationLabel);

    db.prepare('INSERT INTO Mouvement (num_op, id_prod, type_mvt, qte_op) VALUES (?, ?, ?, ?)').run(
      opResult.lastInsertRowid,
      id_prod,
      type_mvt,
      quantity
    );

    // Le stock est recalculé en temps réel à partir des mouvements enregistrés.
    const updatedStock = getCurrentStock(id_prod);
    return {
      num_op: opResult.lastInsertRowid,
      id_prod,
      type_mvt,
      qte_op: quantity,
      date_op: movementDate,
      lib_op: operationLabel,
      stock_after: updatedStock
    };
  });

  return transaction();
}

function effect(typeMvt, qte) {
  return typeMvt === 'ENTREE' ? Number(qte) : -Number(qte);
}

function assertSimulatedStock(product, simulatedStock) {
  if (simulatedStock < 0) {
    throw httpError(400, 'STOCK_INSUFFISANT', `Stock insuffisant pour ${product.libelle}.`);
  }

  if (simulatedStock < Number(product.stock_min)) {
    throw httpError(
      400,
      'STOCK_MIN_VIOLATION',
      `Opération refusée: ${product.libelle} passerait sous le stock minimum (${product.stock_min}).`
    );
  }

  if (simulatedStock > Number(product.stock_max)) {
    throw httpError(
      400,
      'STOCK_MAX_EXCEEDED',
      `Opération refusée: ${product.libelle} dépasserait le stock maximum (${product.stock_max}).`
    );
  }
}

function validateEditableMovement(row) {
  if (!row) {
    throw httpError(404, 'MOUVEMENT_NOT_FOUND', 'Mouvement introuvable.');
  }

  if ((row.lib_op || '').startsWith('Validation commande #')) {
    throw httpError(
      400,
      'MOUVEMENT_LOCKED',
      'Ce mouvement est lié à une validation de commande et ne peut pas être modifié/supprimé.'
    );
  }
}

function updateMovement(oldNumOp, oldIdProd, { id_prod, type_mvt, qte_op, lib_op, date_op }) {
  const row = getMouvementByKey(oldNumOp, oldIdProd);
  validateEditableMovement(row);

  const nextProduct = getProductById(Number(id_prod));
  if (!nextProduct) {
    throw httpError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
  }

  if (!['ENTREE', 'SORTIE'].includes(type_mvt)) {
    throw httpError(400, 'VALIDATION_ERROR', 'type_mvt doit être ENTREE ou SORTIE.');
  }

  const quantity = Number(qte_op);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw httpError(400, 'VALIDATION_ERROR', 'qte_op doit être un entier positif.');
  }

  const operationLabel = lib_op?.trim() || row.lib_op || `Mouvement ${type_mvt}`;
  const movementDate = date_op || row.date_op || new Date().toISOString();

  const transaction = db.transaction(() => {
    const oldProduct = getProductById(Number(oldIdProd));
    if (!oldProduct) {
      throw httpError(404, 'PRODUCT_NOT_FOUND', 'Produit original introuvable.');
    }

    const oldStockCurrent = getCurrentStock(Number(oldIdProd));
    const oldEffect = effect(row.type_mvt, row.qte_op);
    const newEffect = effect(type_mvt, quantity);

    if (Number(oldIdProd) === Number(id_prod)) {
      const simulated = oldStockCurrent - oldEffect + newEffect;
      assertSimulatedStock(nextProduct, simulated);
    } else {
      const nextStockCurrent = getCurrentStock(Number(id_prod));
      const simulatedOld = oldStockCurrent - oldEffect;
      const simulatedNew = nextStockCurrent + newEffect;
      assertSimulatedStock(oldProduct, simulatedOld);
      assertSimulatedStock(nextProduct, simulatedNew);
    }

    updateMouvementByKey({
      oldNumOp,
      oldIdProd,
      idProd: Number(id_prod),
      typeMvt: type_mvt,
      qteOp: quantity,
      libOp: operationLabel,
      dateOp: movementDate
    });

    return getMouvementByKey(oldNumOp, Number(id_prod));
  });

  return transaction();
}

function deleteMovement(numOp, idProd) {
  const row = getMouvementByKey(numOp, idProd);
  validateEditableMovement(row);

  const transaction = db.transaction(() => {
    const product = getProductById(Number(idProd));
    if (!product) {
      throw httpError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
    }

    const currentStock = getCurrentStock(Number(idProd));
    const simulated = currentStock - effect(row.type_mvt, row.qte_op);
    assertSimulatedStock(product, simulated);

    deleteMouvementByKey(numOp, idProd);

    return {
      num_op: numOp,
      id_prod: idProd,
      stock_after: getCurrentStock(Number(idProd))
    };
  });

  return transaction();
}

module.exports = { createMovement, updateMovement, deleteMovement };
