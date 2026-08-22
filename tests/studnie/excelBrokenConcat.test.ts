/**
 * Guard-test regresyjny (bug z 17f932a): połamane konkatenacje stringów HTML.
 *
 * Wzorzec buga: linia `html += '<td ... style="';` kończy się średnikiem,
 * a następna linia zaczyna nowe wyrażenie-string bez operatora `+` —
 * wynik drugiego wyrażenia jest wyrzucany, a do HTML trafia niedomknięty
 * atrybut style=" (parser połyka resztę wiersza). Objaw: brak pustego
 * wiersza dodawania studni w tabeli Excel (#excel-empty-row).
 *
 * Test parsuje źródła modułów studnie i failuje, gdy pojawi się opener
 * `html += '...style="';` bez kontynuacji `+` w następnej linii.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const STUDNIE_DIR = join(process.cwd(), 'public', 'js', 'studnie');

function findBrokenConcatOpeners(): Array<{ file: string; line: number; text: string }> {
    const broken: Array<{ file: string; line: number; text: string }> = [];
    const files = readdirSync(STUDNIE_DIR).filter((f) => f.endsWith('.js'));
    for (const f of files) {
        const lines = readFileSync(join(STUDNIE_DIR, f), 'utf8').split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            /* Opener: html += '<...style="';  — literal kończy się style=" + apostrof + średnik */
            if (!/html \+= '<[^>]*style="';\s*$/.test(lines[i])) continue;
            /* Kontynuacja poprawna tylko gdy następna linia zaczyna się od '+' */
            const next = (lines[i + 1] || '').trimStart();
            if (!next.startsWith('+')) {
                broken.push({ file: f, line: i + 1, text: lines[i].trim() });
            }
        }
    }
    return broken;
}

describe('Guard: połamane konkatenacje html += w modułach studnie (bug 17f932a)', () => {
    it('żaden plik nie zawiera openera html += "...style=\\";" bez kontynuacji +', () => {
        const broken = findBrokenConcatOpeners();
        const msg = broken.map((b) => `${b.file}:${b.line} → ${b.text}`).join('\n');
        expect(broken).toEqual([]);
        if (broken.length > 0) console.error('Połamane konkatenacje:\n' + msg);
    });
});
