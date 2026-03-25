const { getDashboardKpis, getStockSheet, listAuditLogs } = require('../models/reportModel');
const { httpError } = require('../services/httpError');

function dashboardKpis(req, res, next) {
  try {
    const rawDelay = req.query.delay_days;
    const parsedDelay = rawDelay === undefined ? 2 : Number(rawDelay);
    const delayDays = Math.max(0, Number.isFinite(parsedDelay) ? parsedDelay : 2);
    const data = getDashboardKpis(delayDays);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function auditLogs(req, res, next) {
  try {
    const data = listAuditLogs({
      q: req.query.q || '',
      action: req.query.action || '',
      entity_type: req.query.entity_type || '',
      date_from: req.query.date_from || '',
      date_to: req.query.date_to || '',
      page: Math.max(1, Number(req.query.page) || 1),
      limit: Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    });

    res.json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

function stockSheet(req, res, next) {
  try {
    const data = getStockSheet(Number(req.params.id_prod));
    if (!data) throw httpError(404, 'PRODUCT_NOT_FOUND', 'Produit introuvable.');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { dashboardKpis, stockSheet, auditLogs };
