const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const projectRoot = path.resolve(__dirname, '..', '..');
const logPath = path.join(projectRoot, 'docs', 'DELETION_LOG.md');
const log = fs.readFileSync(logPath, 'utf8');
const lines = log.split(/\r?\n/);

const ENTRY_HEADING = /^## \[(\d{4})-(\d{2})-(\d{2})\] \S/;
// Tylko tabele usunietych plikow zrodlowych; "Tests Removed" i artefakty sa poza kontraktem
// (czesciowe edycje testow zostaja w repo, a artefakty .db moga pojawic sie lokalnie).
const DELETION_SECTION =
    /^### (?:Pliki usuni\u0119te|Usuni\u0119te pliki|Unused Files Deleted)\s*$/;

function collectEntries() {
    const entries = [];
    let current = null;

    for (const line of lines) {
        const heading = ENTRY_HEADING.exec(line);
        if (heading) {
            current = { date: heading.slice(1, 4).join('-'), content: [] };
            entries.push(current);
            continue;
        }
        if (line.startsWith('## ')) {
            current = null;
            continue;
        }
        if (current) current.content.push(line);
    }

    return entries;
}

function isValidDate({ year, month, day }) {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return (
        date.getUTCFullYear() === Number(year) &&
        date.getUTCMonth() === Number(month) - 1 &&
        date.getUTCDate() === Number(day)
    );
}

describe('deletion log contract', () => {
    it('keeps every entry dated and non-empty', () => {
        const entries = collectEntries();

        assert.ok(entries.length > 0, 'brak wpisow w docs/DELETION_LOG.md');
        for (const entry of entries) {
            assert.match(
                entry.date,
                /^\d{4}-\d{2}-\d{2}$/,
                `nieprawidlowy naglowek wpisu: ${entry.date}`
            );
            const [year, month, day] = entry.date.split('-');
            assert.ok(isValidDate({ year, month, day }), `nieistniejaca data wpisu: ${entry.date}`);
            assert.ok(
                entry.content.some((line) => line.trim() !== ''),
                `pusty wpis z daty ${entry.date}`
            );
        }
    });

    it('lists only files that no longer exist in the working tree', () => {
        let section = null;
        let checked = 0;

        for (const line of lines) {
            if (line.startsWith('### ')) {
                section = DELETION_SECTION.test(line) ? [] : null;
                continue;
            }
            if (!section || !line.startsWith('|')) continue;

            const cell = /^\|\s*`([^`]+)`/.exec(line);
            if (!cell) continue;

            const target = cell[1]
                .trim()
                .replace(/\s*\(.*\)$/, '')
                .replace(/\/$/, '');
            if (!target) continue;

            checked += 1;
            assert.equal(
                fs.existsSync(path.join(projectRoot, target)),
                false,
                `${target} oznaczony w logu jako usuniety, ale istnieje w repo`
            );
        }

        assert.ok(checked >= 3, `parser nie znalazl tabel usuniec (sprawdzone: ${checked})`);
    });
});
