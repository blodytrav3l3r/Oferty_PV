/* global process: readonly, setInterval: readonly */
// P0-F kill writer: otwiera DB (WAL), BEGIN IMMEDIATE, INSERT N wierszy,
// opcjonalnie COMMIT. Uruchamiany jako child; parent zabija go SIGKILL
// w trakcie snu — symulacja KILL -9 w środku transakcji.
const { DatabaseSync } = require('node:sqlite');

const [dbPath, totalArg, commitArg] = process.argv.slice(2);
const total = parseInt(totalArg || '100', 10);
const doCommit = commitArg === '1';

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 30000');
db.exec(`CREATE TABLE IF NOT EXISTS kill_probe (
    id TEXT PRIMARY KEY,
    seq INTEGER NOT NULL,
    payload TEXT NOT NULL
)`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_kill_probe_seq ON kill_probe(seq)`);
db.exec('BEGIN IMMEDIATE');
const payload = 'x'.repeat(1024);
const ins = db.prepare('INSERT INTO kill_probe (id, seq, payload) VALUES (?, ?, ?)');
for (let i = 1; i <= total; i++) {
    ins.run(`row-${i}`, i, payload);
    if (i % 25 === 0) {
        // Sygnał dla parenta: postęp (stdout flush per linia).
        process.stdout.write(`progress:${i}\n`);
    }
}
if (doCommit) {
    db.exec('COMMIT');
    process.stdout.write('committed\n');
} else {
    // Śpij w otwartej transakcji — parent zabija przed COMMIT.
    setInterval(() => {}, 1000);
}
