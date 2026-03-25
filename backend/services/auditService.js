const db = require('../db/database');

function logAudit({ action, entity_type, entity_id = null, detail = '' }) {
  try {
    db.prepare(
      `INSERT INTO AuditLog (date_audit, action, entity_type, entity_id, detail)
       VALUES (?, ?, ?, ?, ?)`
    ).run(new Date().toISOString(), action, entity_type, entity_id ? String(entity_id) : null, detail || '');
  } catch (_error) {
  }
}

module.exports = { logAudit };
