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
    it('ukrywa import/eksport LIVE i wskazuje import przez studnie', () => {
        const transfer = panel.slice(
            panel.indexOf('function transferHtml'),
            panel.indexOf('function defaultsHtml')
        );
        expect(transfer).toContain("if (type === 'preco')");
        expect(transfer).toContain('Import PRECO odbywa się przez import cennika studni');
        expect(transfer).not.toContain("type === 'preco' ? 'export");
    });
});

describe('frontend: deduplikacja DRAFT PRECO', () => {
    it('hash kanoniczny zgodny z BE (sort kluczy)', () => {
        expect(panel).toContain('function canonicalStringify(value)');
        expect(panel).toContain('.sort()');
        expect(panel).toContain('precoRowsSha256');
    });
    it('identyczne rows + data → PUT istniejącej wersji roboczej', () => {
        expect(panel).toContain('findIdenticalPrecoDraft(rows, effectiveFrom)');
        expect(panel).toContain("PRECO_DEDUP_STATUSES = ['DRAFT']");
        expect(panel).toContain('PRECO_DEDUP_STATUSES.indexOf(v.status) === -1');
        expect(panel).toContain("authed(draftId ? 'PUT' : 'POST', payload)");
    });
});
