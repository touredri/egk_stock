const express = require('express');
const controller = require('../controllers/reportController');

const router = express.Router();

router.get('/dashboard/kpis', controller.dashboardKpis);
router.get('/audit', controller.auditLogs);
router.get('/stocksheet/:id_prod', controller.stockSheet);

module.exports = router;
