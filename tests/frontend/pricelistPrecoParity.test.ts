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
const preco = fs.readFileSync(
    path.join(process.cwd(), 'public/js/studnie/pricelistPreco.js'),
    'utf-8'
);

describe('frontend: PRECO jako trzeci tab', () => {
    it('tab pojawia się tylko z załadowanym modułem PRECO', () => {
        expect(panel).toContain("out.push('preco')");
        expect(panel).toContain('precoNestedToFlat');
        expect(panel).toContain("preco: 'PRECO'");
    });
    it('domyślny odczyt PRECO obsługuje moduł studni', () => {
        expect(panel).toContain('precoNestedToFlat');
        expect(manager).toContain("initialType === 'preco' ? 'preco' : 'studnie'");
    });
    it('panel studni otwiera PRECO bez mapy getRows', () => {
        expect(panel).not.toContain('getRowsByType');
        expect(manager).toContain('function openStudnieVersionsPanel(initialType)');
        expect(manager).toContain('openVersionsPanel(type)');
    });
    it('zapis PRECO obsługuje przycisk raila i toolbaru', () => {
        expect(preco).toContain("'btn-save-preco-rail'");
        expect(preco).toContain("'btn-save-preco'");
        expect(preco).toContain(
            "btn.id === 'btn-save-preco-rail' ? meta.label : meta.label + ' PRECO'"
        );
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
    it('publikacja roboczej → approve z wybraną datą/godziną', () => {
        expect(panel).toContain('function openPublishDialog(');
        expect(panel).toContain('approveVersion(draft.id, { effectiveFrom: iso, note: note })');
    });
});
