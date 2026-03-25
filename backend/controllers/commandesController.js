const { listCommandes, getCommandeById, listCommandeHistory } = require('../models/commandeModel');
const {
  createCommande,
  validateCommande,
  changeCommandeStatus,
  updateCommandeDraft,
  deleteCommandeDraft
} = require('../services/orderService');
const { httpError } = require('../services/httpError');
const { logAudit } = require('../services/auditService');

function parsePage(req) {
  return {
    q: req.query.q || '',
    page: Math.max(1, Number(req.query.page) || 1),
    limit: Math.min(100, Math.max(1, Number(req.query.limit) || 20)),
    etat_com: req.query.etat_com || '',
    statut_com: req.query.statut_com || '',
    date_from: req.query.date_from || '',
    date_to: req.query.date_to || '',
    id_client: req.query.id_client || ''
  };
}

function getCommandes(req, res, next) {
  try {
    const result = listCommandes(parsePage(req));
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

function getCommande(req, res, next) {
  try {
    const commande = getCommandeById(Number(req.params.id));
    if (!commande) throw httpError(404, 'ORDER_NOT_FOUND', 'Commande introuvable.');
    res.json({ success: true, data: commande });
  } catch (error) {
    next(error);
  }
}

function postCommande(req, res, next) {
  try {
    const data = createCommande(req.body);
    logAudit({
      action: 'CREATE_COMMANDE',
      entity_type: 'Commande',
      entity_id: data.num_com,
      detail: `Commande créée (${data.statut_com || 'BROUILLON'})`
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function postValidateCommande(req, res, next) {
  try {
    const data = validateCommande(Number(req.params.id));
    logAudit({
      action: 'VALIDATE_COMMANDE',
      entity_type: 'Commande',
      entity_id: data.num_com,
      detail: `Commande passée à ${data.statut_com}`
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function postChangeCommandeStatus(req, res, next) {
  try {
    const data = changeCommandeStatus(Number(req.params.id), req.body.statut_com);
    logAudit({
      action: 'CHANGE_COMMANDE_STATUS',
      entity_type: 'Commande',
      entity_id: data.num_com,
      detail: `Nouveau statut: ${data.statut_com}`
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function getCommandeHistory(req, res, next) {
  try {
    const numCom = Number(req.params.id);
    const commande = getCommandeById(numCom);
    if (!commande) throw httpError(404, 'ORDER_NOT_FOUND', 'Commande introuvable.');

    const data = listCommandeHistory(numCom, req.query.limit || 30);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function putCommande(req, res, next) {
  try {
    const data = updateCommandeDraft(Number(req.params.id), req.body);
    logAudit({
      action: 'UPDATE_COMMANDE',
      entity_type: 'Commande',
      entity_id: data.num_com,
      detail: `Commande brouillon mise à jour (${data.lignes.length} ligne(s))`
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function deleteCommande(req, res, next) {
  try {
    const data = deleteCommandeDraft(Number(req.params.id));
    logAudit({
      action: 'DELETE_COMMANDE',
      entity_type: 'Commande',
      entity_id: data.num_com,
      detail: 'Commande brouillon supprimée'
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCommandes,
  getCommande,
  postCommande,
  postValidateCommande,
  postChangeCommandeStatus,
  getCommandeHistory,
  putCommande,
  deleteCommande
};
