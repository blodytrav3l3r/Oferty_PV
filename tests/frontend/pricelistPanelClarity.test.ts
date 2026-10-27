import fs from 'fs';
import path from 'path';

/**
 * Panel cenników — czytelność zarządzania (Faza A):
 * statusy, kolumna Użycie, legenda + pomoc, publikacja roboczej,
 * diff z cenami, review-eksport, backdate inline, PRECO w topbarze.
 */

const panel = fs.readFileSync(
    path.join(process.cwd(), 'public/js/shared/pricelistVersions.js'),
    'utf-8'
);
const topbar = fs.readFileSync(path.join(process.cwd(), 'public/js/versionDisplay.js'), 'utf-8');

describe('frontend: statusy mówią co znaczą', () => {
    it('BACKDATE_REQUESTED to Szkic (korekta) — nie mylić z obowiązującą korektą', () => {
        expect(panel).toContain("BACKDATE_REQUESTED: 'Szkic (korekta)'");
        expect(panel).toContain('badge-warn');
    });
    it('legenda statusów nad tabelą', () => {
        expect(panel).toContain('pv-legend');
        expect(panel).toContain('Legenda statusów');
    });
    it('box pomocy z cyklem życia + link do instrukcji', () => {
        expect(panel).toContain('pv-help');
        expect(panel).toContain('docs/CENNIKI-INSTRUKCJA-ADMINA.md');
    });
});

describe('frontend: Użycie wersji widoczne', () => {
    it('kolumna Użycie w nagłówku i komórka usedByCell', () => {
        expect(panel).toContain('<dt>Użycie</dt>');
        expect(panel).toContain('function usedByCell(v)');
    });
    it('użycie wersji w karcie; publikacja niesie datę obowiązywania', () => {
        expect(panel).toContain('<dt>Użycie</dt>');
        expect(panel).toContain('data-pv-eff="');
        expect(panel).toContain('ofert/zamówień');
    });
});

describe('frontend: DRAFT ma drogę na oś czasu', () => {
    it('przycisk Opublikuj robocza + akcja publish przez kanoniczny approve', () => {
        expect(panel).toContain('data-pv-act="publish"');
        expect(panel).toContain('Opublikuj roboczą');
        expect(panel).toContain("'/approve'");
        // Aliasy publish/backdate są deprecated — FE ich nie używa.
        expect(panel).not.toContain("'/publish'");
        expect(panel).not.toContain("'/backdate'");
    });
    it('wiersz ma wejście w edycję: Edytuj (DRAFT) i Utwórz kopię jako szkic (reszta)', () => {
        expect(panel).toContain('data-pv-act="edit"');
        expect(panel).toContain('Utwórz kopię jako szkic');
        expect(panel).toContain('function openEditorFor(');
        expect(panel).toContain("'#/studnie?tab=pricelist&pvtype=preco'");
    });
});

describe('frontend: diff z cenami przed decyzją', () => {
    it('modal diff renderuje top zmian cen (sekcja/pozycja/przed/po/Δ)', () => {
        expect(panel).toContain('function diffChangesHtml(diff)');
        expect(panel).toContain('Top zmian cen');
        expect(panel).toContain('fmtPrice');
    });
    it('publikacja: kanoniczny approve + kontrola checks przed publikacją', () => {
        expect(panel).toContain("'/approve'");
        expect(panel).toContain('function approveVersion(');
        expect(panel).toContain('checksCheckedAt');
        expect(panel).toContain('checksStale');
    });
    it('nowa wersja: popup z datą i godziną publikacji', () => {
        expect(panel).toContain('function openNewVersionDialog(');
        expect(panel).toContain('pv-new-version-modal');
        expect(panel).toContain('type="datetime-local" id="pv-eff"');
        expect(panel).toContain('function submitNewVersion(');
        expect(panel).toContain('Opublikuj wersję');
    });
});

describe('frontend: eksport review + live vs wersja', () => {
    it('drafty eksportują z sufiksem _REVIEW', () => {
        expect(panel).toContain('_REVIEW.xlsx');
    });
    it('transfer mówi wprost: na żywo (LIVE), nie wersja', () => {
        expect(panel).toContain('na żywo (LIVE)');
        expect(panel).toContain('Do review wersji użyj Eksport (review)');
    });
});

describe('frontend: backdate z potwierdzeniem i licznikiem', () => {
    it('checkbox przepisywania historii + licznik 0/10', () => {
        expect(panel).toContain('pv-backdate-ack');
        expect(panel).toContain('przepisuję historię cennika');
        expect(panel).toContain('pv-note-counter');
        expect(panel).toContain('/10 znaków');
    });
    it('karta: data lokalna, ISO/UTC tylko w tooltipie', () => {
        expect(panel).toContain('function fmtEff');
        expect(panel).not.toContain('<br><span class="text-muted">UTC: ');
        // Numer kolejności nie jest pokazywany na kafelku (zostaje w danych/tooltipie).
        expect(panel).not.toContain('<dt>Nr</dt>');
    });
});

describe('frontend: jedna wiadomość na kolizję daty', () => {
    it('PERIOD_OVERLAP i EFFECTIVE_COLLISION mapowane razem', () => {
        expect(panel).toContain('PERIOD_OVERLAP');
        expect(panel).toContain('EFFECTIVE_COLLISION');
        expect(panel).toContain('Kolizja daty obowiązywania');
    });
});

describe('frontend: porównanie z wersji', () => {
    it('wiersz ma Porównaj; podgląd idzie przez wybór kafelka', () => {
        expect(panel).not.toContain('data-pv-act="preview"');
        expect(panel).toContain('data-pv-act="diff"');
        expect(panel).toContain('openDiff(id, null, type)');
    });
    it('diff ma dwa selecty i domyślnie poprzednią wersję', () => {
        expect(panel).toContain('data-pv-diff-select="current"');
        expect(panel).toContain('data-pv-diff-select="against"');
        expect(panel).toContain('Poprzednia (auto)');
        expect(panel).toContain("url += '?against='");
    });
    it('nowy moduł podglądu jest ładowany po module wersji', () => {
        const rury = fs.readFileSync(path.join(process.cwd(), 'public/rury.html'), 'utf-8');
        const studnie = fs.readFileSync(path.join(process.cwd(), 'public/studnie.html'), 'utf-8');
        for (const html of [rury, studnie]) {
            expect(html.indexOf('pricelistVersions.js')).toBeLessThan(
                html.indexOf('pricelistVersionPreview.js')
            );
        }
    });
});

describe('frontend: topbar zna PRECO', () => {
    it('TYPES zawiera preco', () => {
        expect(topbar).toContain("'rury', 'studnie', 'preco'");
        expect(topbar).toContain("preco: 'Preco'");
    });
});
