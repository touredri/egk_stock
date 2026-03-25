const express = require('express');
const controller = require('../controllers/systemController');

const router = express.Router();

router.get('/backups', controller.getBackups);
router.post('/backups', controller.postBackup);
router.post('/backups/restore', controller.postRestoreBackup);

module.exports = router;
