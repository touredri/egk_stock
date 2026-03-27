const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const db = require('../db/database');
const { httpError } = require('./httpError');

const isVercel = Boolean(process.env.VERCEL);
const customDataDir = process.env.EGK_DATA_DIR;
const dataDir = isVercel
  ? path.join('/tmp', 'egk-data')
  : customDataDir || path.join(__dirname, '..', '..', 'data');
const backupsDir = path.join(dataDir, 'backups');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

function backupName() {
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  return `egk-backup-${iso}.sqlite`;
}

function resolveBackupPath(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    throw httpError(400, 'VALIDATION_ERROR', 'Nom de backup invalide.');
  }

  const normalized = path.basename(fileName);
  if (normalized !== fileName) {
    throw httpError(400, 'VALIDATION_ERROR', 'Nom de backup invalide.');
  }

  const fullPath = path.join(backupsDir, normalized);
  if (!fullPath.startsWith(backupsDir)) {
    throw httpError(400, 'VALIDATION_ERROR', 'Chemin de backup invalide.');
  }

  return fullPath;
}

function listBackups() {
  const files = fs
    .readdirSync(backupsDir)
    .filter((name) => name.endsWith('.sqlite'))
    .map((name) => {
      const fullPath = path.join(backupsDir, name);
      const stat = fs.statSync(fullPath);
      return {
        file_name: name,
        size_bytes: stat.size,
        created_at: stat.birthtime.toISOString()
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return files;
}

async function createBackup() {
  const fileName = backupName();
  const fullPath = resolveBackupPath(fileName);

  db.pragma('wal_checkpoint(TRUNCATE)');
  await db.backup(fullPath);

  const stat = fs.statSync(fullPath);
  return {
    file_name: fileName,
    size_bytes: stat.size,
    created_at: stat.birthtime.toISOString()
  };
}

function restoreBackup(fileName) {
  const fullPath = resolveBackupPath(fileName);
  if (!fs.existsSync(fullPath)) {
    throw httpError(404, 'BACKUP_NOT_FOUND', 'Backup introuvable.');
  }

  const probe = new Database(fullPath, { readonly: true });
  const requiredTables = ['Product', 'Client', 'Commande', 'Operation', 'Mouvement', 'Concerne'];
  const tableRows = probe
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name IN (${requiredTables.map(() => '?').join(',')})`
    )
    .all(...requiredTables);
  probe.close();

  if (tableRows.length !== requiredTables.length) {
    throw httpError(400, 'INVALID_BACKUP', 'Backup incompatible avec le schéma applicatif.');
  }

  db.pragma('wal_checkpoint(TRUNCATE)');
  db.exec('PRAGMA foreign_keys = OFF');

  const escapedPath = fullPath.replaceAll("'", "''");
  let attached = false;

  try {
    db.exec(`ATTACH DATABASE '${escapedPath}' AS restoredb`);
    attached = true;

    const tx = db.transaction(() => {
      db.exec(`
        DELETE FROM Mouvement;
        DELETE FROM Concerne;
        DELETE FROM Operation;
        DELETE FROM Commande;
        DELETE FROM Client;
        DELETE FROM Product;

        INSERT INTO Product (id_prod, libelle, pu, stock_min, stock_max)
        SELECT id_prod, libelle, pu, stock_min, stock_max FROM restoredb.Product;

        INSERT INTO Client (id_client, nom, prenom, ville, telephone)
        SELECT id_client, nom, prenom, ville, telephone FROM restoredb.Client;

        INSERT INTO Commande (
          num_com,
          date_com,
          etat_com,
          statut_com,
          date_validation,
          date_livraison,
          date_annulation,
          id_client
        )
        SELECT
          num_com,
          date_com,
          etat_com,
          CASE WHEN etat_com = 1 AND (statut_com IS NULL OR statut_com = 'BROUILLON') THEN 'VALIDEE' ELSE statut_com END,
          date_validation,
          date_livraison,
          date_annulation,
          id_client
        FROM restoredb.Commande;

        INSERT INTO Operation (num_op, date_op, lib_op)
        SELECT num_op, date_op, lib_op FROM restoredb.Operation;

        INSERT INTO Mouvement (num_op, id_prod, type_mvt, qte_op)
        SELECT num_op, id_prod, type_mvt, qte_op FROM restoredb.Mouvement;

        INSERT INTO Concerne (num_com, id_prod, qte_com)
        SELECT num_com, id_prod, qte_com FROM restoredb.Concerne;
      `);

      try {
        db.exec(`
          DELETE FROM sqlite_sequence
          WHERE name IN ('Product', 'Client', 'Commande', 'Operation');

          INSERT INTO sqlite_sequence(name, seq)
          SELECT name, seq
          FROM restoredb.sqlite_sequence
          WHERE name IN ('Product', 'Client', 'Commande', 'Operation');
        `);
      } catch (_error) {
      }
    });

    tx();
  } finally {
    if (attached) {
      db.exec('DETACH DATABASE restoredb');
    }
    db.exec('PRAGMA foreign_keys = ON');
  }

  return { restored_from: fileName, restored_at: new Date().toISOString() };
}

module.exports = {
  listBackups,
  createBackup,
  restoreBackup
};
