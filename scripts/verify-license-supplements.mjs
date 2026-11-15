import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LICENSES_DIR = path.join(ROOT, 'public', 'licenses', 'npm');

function readRequired(readFile, file) {
    try {
        return readFile(file);
    } catch {
        throw new Error(`Brak wymaganego pliku licencji: ${file}`);
    }
}

export function verifyLicenseSupplements({ manifest, readFile, lock }) {
    if (manifest?.version !== 1 || !Array.isArray(manifest.entries) || !manifest.entries.length) {
        throw new Error('Nieprawidłowy manifest uzupełnień licencyjnych');
    }
    const readme = readRequired(readFile, 'README.md').toString('utf8');
    const rows = readme.split(/\r?\n/).filter((line) => line.startsWith('|'));
    const locked = new Set(
        Object.entries(lock.packages || {})
            .filter(([key, pkg]) => key && pkg?.version)
            .map(([key, pkg]) => `${key.split('node_modules/').pop()}@${pkg.version}`)
    );
    const files = new Set();
    const references = new Set();
    for (const entry of manifest.entries) {
        if (
            !/^[\w.-]+\.txt$/.test(entry.file || '') ||
            files.has(entry.file) ||
            !/^[a-f0-9]{64}$/.test(entry.sha256 || '') ||
            !/^https:\/\//.test(entry.source || '') ||
            !Array.isArray(entry.packages) ||
            !entry.packages.length
        ) {
            throw new Error('Nieprawidłowy wpis w manifeście uzupełnień licencyjnych');
        }
        files.add(entry.file);
        const text = readRequired(readFile, entry.file);
        const hash = crypto.createHash('sha256').update(text).digest('hex');
        if (hash !== entry.sha256) throw new Error(`Niezgodna suma SHA-256: ${entry.file}`);
        for (const pkg of entry.packages) {
            if (!locked.has(`${pkg.name}@${pkg.version}`)) {
                throw new Error(`Brak pakietu w lockfile: ${pkg.name}@${pkg.version}`);
            }
            const documented = rows.some((row) => {
                const cells = row.split('|').map((cell) => cell.trim());
                return (
                    cells[1]?.includes(`\`${pkg.name}\``) &&
                    cells[2] === pkg.version &&
                    cells[3] === `\`${entry.file}\`` &&
                    cells[4]?.includes(entry.source)
                );
            });
            if (!documented)
                throw new Error(`Brak powiązania w README: ${pkg.name}@${pkg.version}`);
            references.add(`${pkg.name}@${pkg.version}:${entry.file}`);
        }
    }
    for (const row of rows) {
        const cells = row.split('|').map((cell) => cell.trim());
        const match = /^`([\w.-]+\.txt)`$/.exec(cells[3] || '');
        if (!match) continue;
        for (const name of (cells[1] || '').matchAll(/`([^`]+)`/g)) {
            if (!references.has(`${name[1]}@${cells[2]}:${match[1]}`)) {
                throw new Error(`Brak wpisu manifestu dla pozycji README: ${name[1]}@${cells[2]}`);
            }
        }
    }
}

export function verifySupplementFiles(lock) {
    const readFile = (file) => fs.readFileSync(path.join(LICENSES_DIR, file));
    const manifest = JSON.parse(readRequired(readFile, 'manifest.json').toString('utf8'));
    verifyLicenseSupplements({ manifest, readFile, lock });
}
