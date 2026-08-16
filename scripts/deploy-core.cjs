'use strict';

const fs = require('fs');
const path = require('path');

const TAG_RE = /^v\d+\.\d+\.\d+$/;
const TARGETS = ['windows', 'linux', 'docker'];
const BACKUP_DIR = path.resolve(__dirname, '..', 'data', 'backups');
const BACKUP_FILE_RE = /^backup_\d{4}-\d{2}-\d{2}_\d+\.sqlite$/;

function validateTag(tag) {
    if (typeof tag !== 'string' || !TAG_RE.test(tag)) {
        throw new Error(
            `Niepoprawny tag: "${String(tag)}". Oczekiwano formatu vX.Y.Z (np. v1.16.0).`
        );
    }
    return tag;
}

function resolveTarget(target) {
    if (!TARGETS.includes(target)) {
        throw new Error(`Nieznany target: "${target}". Dozwolone: ${TARGETS.join(', ')}.`);
    }
    return target;
}

function startCmd(target) {
    switch (target) {
        case 'windows':
            // start.bat uruchamia serwer w nowym oknie konsoli i zwraca sterowanie -
            // dzieki temu nastepny krok (health check) moze zostac wykonany.
            return 'start "" start.bat --prod';
        case 'linux':
            return 'pm2 restart sok-oferty';
        case 'docker':
            return 'docker compose up -d --build';
        default:
            throw new Error(`Brak komendy start dla targetu: ${target}`);
    }
}

function resolveSteps(target, tag) {
    validateTag(tag);
    resolveTarget(target);
    const steps = [
        { name: 'Backup bazy danych', cmd: 'npm run backup' },
        { name: `Pobranie wydania ${tag}`, cmd: `git fetch origin tag ${tag} --no-tags` },
        { name: `Przejscie na ${tag}`, cmd: `git checkout ${tag}` },
        { name: 'Instalacja zaleznosci', cmd: 'npm ci' },
        { name: 'Generacja klienta Prisma', cmd: 'npx prisma generate' },
        { name: 'Migracja schematu (addytywna)', cmd: 'npx prisma migrate deploy' },
        { name: 'Budowa projektu', cmd: 'npm run build' }
    ];
    if (target === 'linux') {
        steps.push({
            name: 'Kopiowanie klienta Prisma do dist',
            cmd: 'mkdir -p dist/generated && cp -r generated/prisma dist/generated/'
        });
    }
    steps.push(
        { name: 'Kontrola spojnosci wersji', cmd: 'npm run version:check' },
        { name: 'Uruchomienie aplikacji', cmd: startCmd(target) },
        { name: 'Weryfikacja po starcie (health)', cmd: 'npm run deploy:check' }
    );
    return steps;
}

function findBackups(dir = BACKUP_DIR) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs
        .readdirSync(dir)
        .filter((f) => BACKUP_FILE_RE.test(f))
        .sort();
}

function planRollback(dir = BACKUP_DIR) {
    const list = findBackups(dir);
    if (list.length === 0) {
        throw new Error(`Brak backupów w katalogu: ${dir}`);
    }
    return path.join(dir, list[list.length - 1]);
}

function rollbackSteps(target, previousTag, backupPath) {
    validateTag(previousTag);
    resolveTarget(target);
    return [
        {
            name: `Przywrocenie bazy z backupu: ${backupPath}`,
            cmd: `npm run restore "${backupPath}" -- --yes`
        },
        { name: `Powrot na tag ${previousTag}`, cmd: `git checkout ${previousTag}` },
        { name: 'Budowa projektu', cmd: 'npm run build' },
        { name: 'Uruchomienie aplikacji', cmd: startCmd(target) },
        { name: 'Weryfikacja po starcie (health)', cmd: 'npm run deploy:check' }
    ];
}

async function runSequential(steps, runFn) {
    for (const step of steps) {
        const ok = await runFn(step);
        if (ok === false) {
            throw new Error(`Krok nieudany: ${step.name}`);
        }
    }
}

async function checkHealth(url, opts) {
    const {
        fetchFn = globalThis.fetch,
        retries = 12,
        intervalMs = 5000,
        timeoutMs = 1500
    } = opts || {};
    for (let i = 0; i < retries; i++) {
        let timer;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
            });
            const res = await Promise.race([fetchFn(url), timeoutPromise]);
            clearTimeout(timer);
            if (res && res.status === 200) {
                return true;
            }
        } catch {
            clearTimeout(timer);
            // ponowienie do wyczerpania prob
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
}

module.exports = {
    TAG_RE,
    TARGETS,
    BACKUP_DIR,
    validateTag,
    resolveTarget,
    startCmd,
    resolveSteps,
    findBackups,
    planRollback,
    rollbackSteps,
    runSequential,
    checkHealth
};
