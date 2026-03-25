const { listBackups, createBackup, restoreBackup } = require('../services/backupService');
const { logAudit } = require('../services/auditService');

function getBackups(req, res, next) {
  try {
    const data = listBackups();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function postBackup(req, res, next) {
  try {
    const data = await createBackup();
    logAudit({
      action: 'CREATE_BACKUP',
      entity_type: 'System',
      entity_id: data.file_name,
      detail: `Sauvegarde créée (${data.size_bytes} octets)`
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function postRestoreBackup(req, res, next) {
  try {
    const data = restoreBackup(req.body.file_name);
    logAudit({
      action: 'RESTORE_BACKUP',
      entity_type: 'System',
      entity_id: data.restored_from,
      detail: 'Restauration base locale'
    });
    res.json({ success: true, data, message: 'Restauration terminée.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBackups,
  postBackup,
  postRestoreBackup
};
