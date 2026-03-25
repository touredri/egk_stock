const clientModel = require('../models/clientModel');
const { httpError } = require('../services/httpError');
const { logAudit } = require('../services/auditService');

function parsePage(req) {
  return {
    q: req.query.q || '',
    page: Math.max(1, Number(req.query.page) || 1),
    limit: Math.min(100, Math.max(1, Number(req.query.limit) || 20))
  };
}

function validateClientPayload(payload) {
  const required = ['nom', 'prenom', 'ville', 'telephone'];
  for (const field of required) {
    if (!payload[field] || String(payload[field]).trim() === '') {
      throw httpError(400, 'VALIDATION_ERROR', `${field} est obligatoire.`);
    }
  }

  return {
    nom: String(payload.nom),
    prenom: String(payload.prenom),
    ville: String(payload.ville),
    telephone: String(payload.telephone)
  };
}

function getClients(req, res, next) {
  try {
    const result = clientModel.listClients(parsePage(req));
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

function createClient(req, res, next) {
  try {
    const payload = validateClientPayload(req.body);
    const client = clientModel.createClient(payload);
    logAudit({
      action: 'CREATE_CLIENT',
      entity_type: 'Client',
      entity_id: client.id_client,
      detail: `${client.nom} ${client.prenom} créé`
    });
    res.status(201).json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
}

function updateClient(req, res, next) {
  try {
    const id = Number(req.params.id);
    const exists = clientModel.getClientById(id);
    if (!exists) throw httpError(404, 'CLIENT_NOT_FOUND', 'Client introuvable.');

    const payload = validateClientPayload(req.body);
    const client = clientModel.updateClient(id, payload);
    logAudit({
      action: 'UPDATE_CLIENT',
      entity_type: 'Client',
      entity_id: id,
      detail: `${client.nom} ${client.prenom} mis à jour`
    });
    res.json({ success: true, data: client });
  } catch (error) {
    next(error);
  }
}

function deleteClient(req, res, next) {
  try {
    const id = Number(req.params.id);
    const exists = clientModel.getClientById(id);
    if (!exists) throw httpError(404, 'CLIENT_NOT_FOUND', 'Client introuvable.');

    if (clientModel.hasCommandes(id)) {
      throw httpError(409, 'CLIENT_HAS_ORDERS', 'Suppression impossible: client lié à des commandes.');
    }

    clientModel.deleteClient(id);
    logAudit({
      action: 'DELETE_CLIENT',
      entity_type: 'Client',
      entity_id: id,
      detail: `${exists.nom} ${exists.prenom} supprimé`
    });
    res.json({ success: true, message: 'Client supprimé.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getClients,
  createClient,
  updateClient,
  deleteClient
};
