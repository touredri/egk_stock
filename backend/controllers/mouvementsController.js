const { listMouvements } = require('../models/movementModel');
const { createMovement, updateMovement, deleteMovement } = require('../services/stockService');
const { logAudit } = require('../services/auditService');

function parsePage(req) {
  return {
    q: req.query.q || '',
    page: Math.max(1, Number(req.query.page) || 1),
    limit: Math.min(100, Math.max(1, Number(req.query.limit) || 20)),
    type_mvt: req.query.type_mvt || '',
    date_from: req.query.date_from || '',
    date_to: req.query.date_to || '',
    id_prod: req.query.id_prod || ''
  };
}

function getMouvements(req, res, next) {
  try {
    const result = listMouvements(parsePage(req));
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

function addMouvement(req, res, next) {
  try {
    const result = createMovement(req.body);
    logAudit({
      action: 'CREATE_MOUVEMENT',
      entity_type: 'Mouvement',
      entity_id: result.num_op,
      detail: `${result.type_mvt} produit #${result.id_prod} qte ${result.qte_op}`
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

function putMouvement(req, res, next) {
  try {
    const numOp = Number(req.params.num_op);
    const idProd = Number(req.params.id_prod);
    const result = updateMovement(numOp, idProd, req.body);
    logAudit({
      action: 'UPDATE_MOUVEMENT',
      entity_type: 'Mouvement',
      entity_id: result.num_op,
      detail: `${result.type_mvt} produit #${result.id_prod} qte ${result.qte_op}`
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

function removeMouvement(req, res, next) {
  try {
    const numOp = Number(req.params.num_op);
    const idProd = Number(req.params.id_prod);
    const result = deleteMovement(numOp, idProd);
    logAudit({
      action: 'DELETE_MOUVEMENT',
      entity_type: 'Mouvement',
      entity_id: result.num_op,
      detail: `Suppression mouvement produit #${idProd}`
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = { getMouvements, addMouvement, putMouvement, removeMouvement };
