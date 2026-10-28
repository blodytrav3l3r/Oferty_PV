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
const css = fs.readFileSync(path.join(process.cwd(), 'public/css/pricelist-panel.css'), 'utf-8');

describe('frontend: statusy mówią co znaczą', () => {
    it('BACKDATE_REQUESTED to Szkic (korekta) — nie mylić z obowiązującą korektą', () => {
        expect(panel).toContain("BACKDATE_REQUESTED: 'Szkic (korekta)'");
        expect(panel).toContain('badge-warn');
    });
    it('legenda statusów w popupie', () => {
        expect(panel).toContain('pv-legend');
        expect(panel).toContain('Legenda statusów');
    });
    it('box pomocy z cyklem życia + link do instrukcji', () => {
        expect(panel).toContain('pv-help-modal');
        expect(panel).toContain('docs/CENNIKI-INSTRUKCJA-ADMINA.md');
    });
    it('legenda i wyjaśnienie statusów tylko w popupie „Jak to działa”', () => {
        const marker = '<h4 class="pv-section">Jak to działa</h4>';
        const helpAt = panel.indexOf(marker);
        const helpEnd = panel.indexOf('</details>', helpAt);
        const dockHelp = panel.slice(helpAt, helpEnd);
        expect(helpAt).toBeGreaterThan(-1);
        expect(dockHelp).not.toContain('pv-legend');
        expect(dockHelp).not.toContain('Statusy wersji');
        expect(dockHelp).toContain('data-pv-act="show-help"');
        const modalAt = panel.indexOf("id: 'pv-help-modal'");
        const legendAt = panel.indexOf('pv-legend');
        expect(modalAt).toBeGreaterThan(-1);
        expect(legendAt).toBeGreaterThan(modalAt);
        expect(panel).toContain('Statusy wersji na osi czasu');
        expect(panel).toContain('Jak utworzyć nowy cennik');
        expect(panel).toContain('Anuluj wdrożenie');
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
        // Klik „Opublikuj roboczą” zawsze otwiera popup z datą/godziną.
        expect(panel).toContain('openPublishDialog(type, id)');
        expect(panel).toContain('id="pv-publish-date" type="datetime-local"');
        expect(panel).not.toContain('var doApprove =');
    });
    it('zaplanowane wdrożenie można anulować (powrót do szkicu)', () => {
        expect(panel).toContain('data-pv-act="cancel-schedule"');
        expect(panel).toContain("'/cancel-schedule'");
        expect(panel).toContain('Anuluj wdrożenie');
    });
    it('kafelki akcji w kolejności logicznej: edycja → publikacja → analiza → usuń', () => {
        // „Edytuj" powstaje we wspólnym builderze (kopia kafelka paska trybu),
        // reszta kafelków to inline markup — kolejność liczona po kotwicach.
        const anchors = {
            edit: 'editTileHtml({',
            clone: 'data-pv-act="clone"',
            publish: 'data-pv-act="publish"',
            'cancel-schedule': 'data-pv-act="cancel-schedule"',
            activate: 'data-pv-act="activate"',
            diff: 'data-pv-act="diff"',
            label: 'data-pv-act="label"',
            'edit-note': 'data-pv-act="edit-note"',
            delete: 'data-pv-act="delete"'
        };
        const order = Object.values(anchors).map((a) => panel.indexOf(a));
        expect(order.every((i) => i > -1)).toBe(true);
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(css).toContain(".pv-version-actions__grid [data-pv-act='delete']");
    });
    it('wiersz ma wejście w edycję: Edytuj (DRAFT) i Utwórz kopię jako szkic (reszta)', () => {
        expect(panel).toContain('function editTileHtml(');
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
    it('bez przycisku „Nowa wersja…” — tworzenie przez kopię szkicu i publikację', () => {
        expect(panel).not.toContain('data-pv-act="new-version"');
        expect(panel).not.toContain('pv-new-version-modal');
        expect(panel).not.toContain('function openNewVersionDialog(');
        expect(panel).toContain("'Utwórz kopię jako szkic'");
    });
});

describe('frontend: brak eksportu wersji z raila', () => {
    it('nie ma akcji Eksport (review)', () => {
        expect(panel).not.toContain('data-pv-act="export"');
        expect(panel).not.toContain('_REVIEW.xlsx');
    });
    it('transfer mówi wprost: na żywo (LIVE), nie wersja', () => {
        expect(panel).toContain('na żywo (LIVE)');
        expect(panel).not.toContain('Eksport (review)');
    });
});

describe('frontend: backdate z potwierdzeniem i licznikiem', () => {
    it('publikacja: data wsteczna wymaga uzasadnienia min. 10 znaków', () => {
        expect(panel).toContain('pv-publish-note');
        expect(panel).toContain('Data w przeszłości — korekta wsteczna');
        expect(panel).toContain('PAST_NOTE_MIN');
        expect(panel).toContain('uzasadnienie min. ');
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
