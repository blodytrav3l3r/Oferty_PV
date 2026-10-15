// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
/**
 * PR 1b: _excelErrorTitle musi escapowac atrybut title (escapeHtmlAttr).
 * Payload '" onmouseover="alert(1)' w configErrors nie moze dac zywego atrybutu.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadTableBody(opts) {
    const withAttr = !opts || opts.withAttr !== false;
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/excelTableBody.js'),
        'utf8'
    );
    // escapeHtml jak w prod (div.textContent -> innerHTML): escapuje &<> ale NIE cudzyslowow.
    const escapeHtml = (s) =>
        String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    // escapeHtmlAttr jak w prod (shared/escapeHtml.js): escapuje tez " -> &quot;.
    const escapeHtmlAttr = (s) =>
        String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    const sandbox = { console, escapeHtml };
    if (withAttr) sandbox.escapeHtmlAttr = escapeHtmlAttr;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

describe('_excelErrorTitle XSS (title attr)', () => {
    test('payload z cudzyslowem nie daje zywego onmouseover, jest &quot;', () => {
        const sb = loadTableBody({ withAttr: true });
        const payload = '\'" onmouseover="alert(1)';
        const title = sb._excelErrorTitle({ configErrors: [payload] });
        expect(title).not.toContain('" onmouseover=');
        expect(title).toContain('&quot;');
    });

    test('fail-closed: brak escapeHtmlAttr = throw, nie fallback', () => {
        const sb = loadTableBody({ withAttr: false });
        const payload = '\'" onmouseover="alert(1)';
        expect(() => sb._excelErrorTitle({ configErrors: [payload] })).toThrow();
    });
});
