import fs from 'fs';
import path from 'path';

/**
 * Parytet PRECO w panelu wersji: tab, zapis z LIVE, użycie przez wersje studni,
 * blokada DELETE i deduplikacja identycznego DRAFT (PUT zamiast POST).
 */

const panel = fs.readFileSync(
    path.join(process.cwd(), 'public/js/shared/pricelistVersions.js'),
    'utf-8'
);
const manager = fs.readFileSync(
    path.join(process.cwd(), 'public/js/studnie/pricelistManager.js'),
    'utf-8'
);

describe('frontend: PRECO jako trzeci tab', () => {
    it('tab pojawia się tylko z załadowanym modułem PRECO', () => {
        expect(panel).toContain("out.push('preco')");
        expect(panel).toContain('precoNestedToFlat');
        expect(panel).toContain("preco: 'PRECO'");
    });
    it('domyślny odczyt PRECO to LIVE nested → flat', () => {
        expect(panel).toContain("if (type === 'preco') return defaultPrecoRows();");
        expect(panel).toContain('collectPrecoFromUI');
        expect(panel).toContain('precoNestedToFlat');
    });
    it('panel studni rejestruje getRows dla preco', () => {
        expect(panel).toContain('getRowsByType.preco = getRows.preco');
        expect(manager).toContain('function openStudnieVersionsPanel(initialType)');
        expect(manager).toContain('preco: function');
    });
});

describe('frontend: PRECO użycie i usuwanie', () => {
    it('usedByCell rozróżnia wersje studni od ofert', () => {
        expect(panel).toContain("v.usedByKind === 'studnieVersions' ? 'wersji studni'");
    });
    it('deleteReason blokuje PRECO z referencjami przed sprawdzeniem stanu', () => {
        const reason = panel.slice(
            panel.indexOf('function deleteReason'),
            panel.indexOf('function renderRows')
        );
        expect(reason.indexOf("v.usedByKind === 'studnieVersions'")).toBeLessThan(
            reason.indexOf("if (state === 'DRAFT') return null;")
        );
        expect(reason).toContain("'Używana przez ' + v.usedBy + ' wersji studni'");
    });
});

describe('frontend: transfer PRECO', () => {
    it('ma osobny plik importu i eksportu LIVE', () => {
        const transfer = panel.slice(
            panel.indexOf('function transferHtml'),
            panel.indexOf('function defaultsHtml')
        );
        expect(transfer).toContain("if (type === 'preco')");
        expect(transfer).toContain('data-csp="exportPrecoToExcel"');
        expect(transfer).toContain('data-csp="importPrecoFromExcel"');
        expect(transfer).toContain('id="pv-import-preco"');
        expect(transfer).not.toContain('Import PRECO odbywa się przez import cennika studni');
    });
});

describe('frontend: publikacja PRECO z popupu', () => {
    it('zapis bieżącej siatki → approve z wybraną datą/godziną', () => {
        expect(panel).toContain('function submitNewVersion(');
        expect(panel).toContain('saveDraftRows(t, rows, note)');
        expect(panel).toContain('approveVersion(draft.id, { effectiveFrom: iso, note: note })');
    });
});
