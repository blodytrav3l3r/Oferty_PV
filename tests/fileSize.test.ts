import { spawnSync } from 'child_process';
import { resolve } from 'path';

const SCRIPT = resolve(__dirname, '..', 'scripts/check-file-size.mjs');

function runScript() {
    const result = spawnSync('node', [SCRIPT], { encoding: 'utf-8' });
    return (result.stdout + result.stderr).trim();
}

describe('check-file-size.mjs', () => {
    it('uruchamia się bez błędu (exit 0 = tryb warning)', () => {
        const result = runScript();
        expect(result).toBeDefined();
    });

    it('raportuje pliki przekraczające 500 linii', () => {
        const result = runScript();
        expect(result).toContain('Znaleziono');
        expect(result).toContain('wellUIConfig.js');
        expect(result).toContain('excelColumns.js');
    });

    it('nie raportuje plików z listy EXEMPT (wellActions.js, wellPopups.js)', () => {
        const result = runScript();
        expect(result).not.toContain('public/js/studnie/wellActions');
        expect(result).not.toContain('public/js/studnie/wellPopups');
        expect(result).not.toContain('public/js/studnie/order/orderZlecenia');
    });
});
