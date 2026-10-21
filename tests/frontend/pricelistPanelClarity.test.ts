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
        expect(panel).toContain('<th scope="col">Użycie</th>');
        expect(panel).toContain('function usedByCell(v)');
    });
    it('aktywacja ostrzega o użyciu (blast radius w confirmie)', () => {
        expect(panel).toContain('data-pv-used="');
        expect(panel).toContain('ofert/zamówień');
    });
});

describe('frontend: DRAFT ma drogę na oś czasu', () => {
    it('przycisk Opublikuj robocza + akcja publish POST /:id/publish', () => {
        expect(panel).toContain('data-pv-act="publish"');
        expect(panel).toContain('Opublikuj roboczą');
        expect(panel).toContain("/publish'");
    });
    it('klon mówi wprost: Klonuj do roboczej + następny krok', () => {
        expect(panel).toContain('Klonuj do roboczej');
        expect(panel).toContain('następny krok: Opublikuj roboczą');
    });
});

describe('frontend: diff z cenami przed decyzją', () => {
    it('modal diff renderuje top zmian cen (sekcja/pozycja/przed/po/Δ)', () => {
        expect(panel).toContain('function diffChangesHtml(diff)');
        expect(panel).toContain('Top zmian cen');
        expect(panel).toContain('fmtPrice');
    });
    it('aktywacja najpierw pokazuje podsumowanie diff', () => {
        expect(panel).toContain("'/diff'");
        expect(panel).toContain('Aktywować wersję');
    });
    it('po zapisie draft auto-otwiera Porównaj', () => {
        expect(panel).toContain('openDiff(v.id, null, type)');
        expect(panel).toContain('sprawdź Porównaj przed aktywacją');
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
    it('data UTC jawnie w tabeli (lokalnie + UTC bez hovera)', () => {
        expect(panel).toContain('UTC: ');
    });
});

describe('frontend: jedna wiadomość na kolizję daty', () => {
    it('PERIOD_OVERLAP i EFFECTIVE_COLLISION mapowane razem', () => {
        expect(panel).toContain('PERIOD_OVERLAP');
        expect(panel).toContain('EFFECTIVE_COLLISION');
        expect(panel).toContain('Kolizja daty obowiązywania');
    });
});

describe('frontend: podgląd i porównanie z wersji', () => {
    it('wiersz ma Podgląd (eye) i Porównaj z wybraną wersją', () => {
        expect(panel).toContain('data-pv-act="preview"');
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
