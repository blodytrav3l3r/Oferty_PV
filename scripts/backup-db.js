/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const DB_PATH = path.resolve('data/app_database.sqlite');
const BACKUP_DIR = path.resolve('data/backup');

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUP_DIR, `backup_${timestamp}.sqlite`);
fs.copyFileSync(DB_PATH, backupPath);
console.log(`Backup utworzony: ${backupPath}`);
