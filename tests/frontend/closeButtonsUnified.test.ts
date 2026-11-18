// @ts-nocheck -- skan źródeł public/, brak typów dla HTML/JS modułów
import fs from 'fs';
import path from 'path';

/**
 * Regresja: przyciski X w oknach miały różne rozmiary i tła (btn-icon 24px,
 * fu-modal-close 30px, admin-action-btn 15px, unit-popup-close 22px, inline 14px).
 * Jedna geometria: `btn-icon` + ikona 16px. Wyjątki to motywy o własnej skali
 * (wydruk, toolbar Excela, popup w Excelu).
 */
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const THEMED_EXCEPTIONS = new Set([
    'public/js/shared/printModal.js',
    'public/js/studnie/excelModal.js',
    'public/js/studnie/wellTransitionsPopup.js'
]);

const LEGACY_CLASSES = /class="[^"]*\b(om-close|unit-popup-close|fu-modal-close)\b/;

function collectFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'dist' || entry.name === 'node_modules') continue;
            collectFiles(full, out);
            continue;
        }
        if (/\.(js|html)$/.test(entry.name)) out.push(full);
    }
    return out;
}

const files = collectFiles(PUBLIC_DIR);
const rel = (full: string) => path.relative(process.cwd(), full).replace(/\\/g, '/');

function closeButtonTags(file: string) {
    const text = fs.readFileSync(file, 'utf8');
    const found: Array<{ tag: string; icon: string }> = [];
    const re = /<button\b[^>]*>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
        const tag = match[0];
        const window = text.slice(match.index, match.index + 400);
        if (!window.includes('data-lucide="x"')) continue;
        if (!/(aria-label|title)="[^"]*[Zz]amknij/.test(tag)) continue;
        const icon = (window.match(/<i\b[^>]*data-lucide="x"[^>]*>/) || [''])[0];
        found.push({ tag, icon });
    }
    return found;
}

describe('frontend: jednolite przyciski X w oknach', () => {
    it('nie używa porzuconych klas przycisków zamykania', () => {
        for (const file of files) {
            if (THEMED_EXCEPTIONS.has(rel(file))) continue;
            const text = fs.readFileSync(file, 'utf8');
            expect(`${rel(file)}: ${LEGACY_CLASSES.test(text) ? 'legacy' : 'ok'}`).toBe(
                `${rel(file)}: ok`
            );
        }
    });

    it('każdy X w oknie używa btn-icon i ikony domyślnej wielkości', () => {
        const offenders: string[] = [];
        for (const file of files) {
            const name = rel(file);
            if (THEMED_EXCEPTIONS.has(name)) continue;
            for (const { tag, icon } of closeButtonTags(file)) {
                if (!/\bclass="[^"]*\bbtn-icon\b/.test(tag)) {
                    offenders.push(`${name}: brak btn-icon → ${tag.trim().slice(0, 120)}`);
                }
                if (/class="[^"]*icon-(xxs|xs|sm|md|lg|14)\b/.test(icon)) {
                    offenders.push(`${name}: rozmiar ikony nadpisany → ${icon}`);
                }
                if (/style="[^"]*(width|height)\s*:/.test(icon)) {
                    offenders.push(`${name}: inline rozmiar ikony → ${icon}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });

    it('btn-icon wymusza 16px ikony w bazowym CSS', () => {
        const base = fs.readFileSync(path.join(PUBLIC_DIR, 'css/style.base.css'), 'utf8');
        expect(base).toMatch(/\.btn-icon svg\s*\{[^}]*width:\s*16px;[^}]*height:\s*16px;/s);
    });
});
