// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/**
 * P2: label w bulk-progress jest escapowany przed innerHTML (wzorzec #3).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadBulkJob(escapeHtml) {
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/excelBulkJob.js'),
        'utf8'
    );
    let html = '';
    const el = {
        style: {},
        set innerHTML(v) {
            html = v;
        },
        get innerHTML() {
            return html;
        }
    };
    const sandbox = {
        console,
        window: { escapeHtml },
        document: {
            getElementById: () => null,
            createElement: () => el,
            body: { appendChild: () => {} }
        },
        requestAnimationFrame: (fn) => fn()
    };
    sandbox.window.window = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return { sandbox, getHtml: () => html };
}

describe('excelBulkJob progress XSS', () => {
    test('złośliwy label nie trafia żywcem do innerHTML', () => {
        const esc = (s) =>
            String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const { sandbox, getHtml } = loadBulkJob(esc);
        sandbox._excelBulkShowProgress('<img src=x onerror=alert(1)>', 5, 10, null);
        const html = getHtml();
        expect(html).not.toContain('<img src=x onerror=alert(1)>');
        expect(html).toContain('&lt;img');
        expect(html).toContain('50%');
    });

    test('fallback bez window.escapeHtml nie wywala', () => {
        const { sandbox, getHtml } = loadBulkJob(undefined);
        sandbox._excelBulkShowProgress('Zwykły label', 1, 2, null);
        expect(getHtml()).toContain('Zwykły label');
    });
});
