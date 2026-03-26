const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const isVercel = Boolean(process.env.VERCEL);
const customDataDir = process.env.EGK_DATA_DIR;
const dataDir = isVercel
  ? path.join('/tmp', 'egk-data')
  : customDataDir || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'egk.sqlite');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

module.exports = db;
