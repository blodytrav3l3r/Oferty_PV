// @ts-check
/* ===== SKRÓTY KLAWISZOWE EXCEL — dane + popup pomocy ===== */

/* Jedno źródło prawdy o skrótach modala Excel.
   Zmiana skrótu w excelCellNavigation.js / excelCopyPaste.js?
   Zaktualizuj też tę listę. */
const EXCEL_SHORTCUTS = [
    {
        section: 'Wyszukiwanie i nawigacja',
        items: [
            { keys: 'Ctrl+F', description: 'Skocz do wyszukiwarki studni' },
            { keys: 'Strzałki', description: 'Nawigacja między komórkami (pomija ukryte wiersze)' }
        ]
    },
    {
        section: 'Cofanie i ponawianie',
        items: [
            { keys: 'Ctrl+Z', description: 'Cofnij ostatnią zmianę' },
            { keys: 'Ctrl+Y / Ctrl+Shift+Z', description: 'Ponów cofniętą zmianę' }
        ]
    },
    {
        section: 'Zaznaczanie',
        items: [
            { keys: 'Ctrl+A', description: 'Zaznacz wszystkie widoczne komórki' },
            { keys: 'Ctrl+Click', description: 'Rozszerz zaznaczenie o klikniętą komórkę' },
            { keys: 'Shift+Click', description: 'Zaznacz zakres od aktywnej komórki' }
        ]
    },
    {
        section: 'Schowek',
        items: [
            { keys: 'Ctrl+X', description: 'Wytnij zaznaczone komórki' },
            { keys: 'Ctrl+C', description: 'Kopiuj zaznaczone komórki' },
            { keys: 'Ctrl+V', description: 'Wklej skopiowane dane' }
        ]
    },
    {
        section: 'Edycja komórek',
        items: [
            { keys: 'Delete / Backspace', description: 'Wyczyść zaznaczone komórki' },
            { keys: 'Ctrl+D', description: 'Wypełnij w dół; bez zaznaczenia — duplikuj studnię' },
            { keys: 'Ctrl+R', description: 'Wypełnij w prawo' },
            {
                keys: 'Ctrl+Enter',
                description: 'Wypełnij zaznaczenie wartością aktywnej komórki'
            },
            { keys: 'Ctrl+M', description: 'Przełącz AUTO/MANUAL dla aktywnego wiersza' },
            { keys: 'Ctrl+Shift+A', description: 'Auto-dobór elementów dla aktywnego wiersza' }
        ]
    },
    {
        section: 'Inne',
        items: [
            { keys: 'Ctrl+S', description: 'Zapisz zmiany i zamknij tabelę' },
            {
                keys: 'Escape',
                description:
                    'Anuluj edycję komórki / wyczyść wyszukiwarkę; ponownie — zamknij tabelę'
            }
        ]
    }
];

function openExcelShortcutsPopup() {
    const rows = EXCEL_SHORTCUTS.map((group) => {
        const itemRows = group.items
            .map(
                (s) =>
                    '<tr>' +
                    '<td style="padding:0.25rem 0.5rem;white-space:nowrap;vertical-align:top;">' +
                    '<kbd style="font-family:monospace;font-size: var(--fs-sm);background:rgba(var(--white-rgb), 0.08);color:var(--slate-200);padding:1px 5px;border-radius: var(--radius-2xs);">' +
                    escapeHtml(s.keys) +
                    '</kbd></td>' +
                    '<td style="padding:0.25rem 0.5rem;vertical-align:top;color:var(--slate-300);">' +
                    escapeHtml(s.description) +
                    '</td></tr>'
            )
            .join('');
        return (
            '<tr><td colspan="2" style="padding:0.45rem 0.5rem 0.2rem;border-top:1px solid rgba(var(--white-rgb), 0.06);color:var(--accent-text);font-size: var(--fs-sm);font-weight: var(--fw-bold);letter-spacing:0.3px;">' +
            escapeHtml(group.section) +
            '</td></tr>' +
            itemRows
        );
    });
    const legend =
        '<div style="margin:0.5rem 0 0;padding:0.5rem;border-top:1px solid rgba(var(--white-rgb), 0.06);">' +
        '<h4 style="margin:0 0 0.35rem;font-size:var(--fs-sm);font-weight:var(--fw-bold);color:var(--slate-200);letter-spacing:0.3px;">Legenda kolorów — co oznacza</h4>' +
        '<div style="display:grid;grid-template-columns:16px 1fr;gap:0.35rem 0.5rem;align-items:start;font-size:var(--fs-xs);color:var(--slate-300);line-height:1.4;">' +
        '<span style="width:16px;height:12px;border-radius:2px;background:rgba(var(--danger-rgb), 0.12);border:1px solid rgba(var(--danger-rgb), 0.3);display:inline-block;margin-top:2px;"></span><span><b style="color:var(--danger-hover);">Błąd — ERROR</b> <span style="color:var(--slate-500);">tło rgba(danger 0.12), czcionka czerwona var(--danger-hover)</span><br><span style="color:var(--slate-400);">Kiedy:</span> <code style="font-size:var(--fs-3xs);background:rgba(var(--white-rgb),0.06);padding:1px 3px;border-radius:2px;">well.configStatus === \'ERROR\'</code> — twardy błąd walidacji <code style="font-size:var(--fs-3xs);">recalculateWellErrors()</code>:<br>• <code>Błąd zapasu w "…" dla przejścia nr …</code> (zapas dół/góra &lt; wymagany, <code>zapasGora/zapasDol</code> z produktu)<br>• <code>Rzędna włączenia przejścia nr … jest niższa niż rzędna dna</code><br>• <code>Rzędna dna … nie może być ≥ rzędnej włazu</code><br>• kolizja otworu / brak wymaganego elementu. <span style="color:var(--slate-500);">Tooltip na wierszu = pierwszy wpis z <code>well.configErrors</code>.</span></span>' +
        '<span style="width:16px;height:12px;border-radius:2px;background:rgba(var(--warn-rgb), 0.1);border:1px solid rgba(var(--warn-rgb), 0.3);display:inline-block;margin-top:2px;"></span><span><b style="color:var(--warn-hover);">Ostrzeżenie — WARNING</b> <span style="color:var(--slate-500);">tło rgba(warn 0.1), czcionka bursztynowa var(--warn-hover)</span><br><span style="color:var(--slate-400);">Kiedy:</span> <code>configStatus === \'WARNING\'</code> — tylko miękkie notki (brak twardych błędów):<br>• <code>zastosowano luzy minimalne (dół=… góra=…)</code><br>• <code>Zastosowana rozszerzona tolerancja - tryb Ratunkowy</code><br>• <code>brak dopłaty PEHD</code> (wkładka wybrana, <code>doplataPEHD=0</code>)</span>' +
        '<span style="width:16px;height:12px;border-radius:2px;background:rgba(var(--blue-rgb), 0.2);border:1px solid rgba(var(--blue-rgb), 0.3);display:inline-block;margin-top:2px;"></span><span><b style="color:var(--slate-200);">Duplikat nazwy</b> <span style="color:var(--slate-500);">tło rgba(… 0.2) w kolorze DN, nad błędem</span><br><span style="color:var(--slate-400);">Kiedy:</span> dwie studnie mają identyczną <code>name.trim().toLowerCase()</code> — liczone globalnie po wszystkich <code>wells</code>, niezależnie od zakładki. Kolor = kolor DN duplikatu (jeśli duplikat w innym DN — kolor tamtego DN, inaczej kolor bieżącej zakładki):' +
        '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.3rem;">' +
        '<span style="display:inline-flex;align-items:center;gap:0.3rem;"><span style="width:14px;height:10px;border-radius:2px;background:rgba(var(--blue-rgb), 0.2);border:1px solid rgba(var(--blue-rgb), 0.3);display:inline-block;"></span>DN1000 niebieski</span>' +
        '<span style="display:inline-flex;align-items:center;gap:0.3rem;"><span style="width:14px;height:10px;border-radius:2px;background:rgba(var(--success-rgb), 0.2);border:1px solid rgba(var(--success-rgb), 0.3);display:inline-block;"></span>DN1200 zielony</span>' +
        '<span style="display:inline-flex;align-items:center;gap:0.3rem;"><span style="width:14px;height:10px;border-radius:2px;background:rgba(var(--warn-rgb), 0.2);border:1px solid rgba(var(--warn-rgb), 0.3);display:inline-block;"></span>DN1500 żółty</span>' +
        '<span style="display:inline-flex;align-items:center;gap:0.3rem;"><span style="width:14px;height:10px;border-radius:2px;background:rgba(var(--purple-rgb), 0.2);border:1px solid rgba(var(--purple-rgb), 0.3);display:inline-block;"></span>DN2000 fioletowy</span>' +
        '<span style="display:inline-flex;align-items:center;gap:0.3rem;"><span style="width:14px;height:10px;border-radius:2px;background:rgba(var(--danger-rgb), 0.2);border:1px solid rgba(var(--danger-rgb), 0.3);display:inline-block;"></span>DN2500 czerwony</span>' +
        '<span style="display:inline-flex;align-items:center;gap:0.3rem;"><span style="width:14px;height:10px;border-radius:2px;background:rgba(var(--pink-rgb), 0.2);border:1px solid rgba(var(--pink-rgb), 0.3);display:inline-block;"></span>Styczne różowy</span>' +
        '</div><span style="color:var(--slate-500);">Priorytet: <b>duplikat &gt; ERROR &gt; WARNING &gt; aktywny</b> — przy konflikcie cały wiersz ma tło duplikatu, a czcionka wskazuje ERROR/WARNING.</span></span>' +
        '<span style="width:16px;height:12px;border-radius:2px;background:rgba(var(--blue-rgb), 0.18);border:1px solid rgba(var(--blue-rgb), 0.3);display:inline-block;margin-top:2px;"></span><span><b>Aktywny wiersz</b> <span style="color:var(--slate-500);">tło rgba(blue 0.18), hover 0.28</span><br><span style="color:var(--slate-400);">Kiedy:</span> <code>wIdx === currentWellIndex</code> — klik/fokus w wierszu; podświetla studnię pokazywaną w diagramie po lewej. Z duplikatem: <code>rgba(dup 0.3)</code>, hover <code>0.35</code>.</span>' +
        '<span style="width:16px;height:12px;border-radius:2px;background:var(--bg-secondary);border:1px solid rgba(var(--white-rgb), 0.08);display:inline-block;margin-top:2px;"></span><span><b>Naprzemienne tło</b> <span style="color:var(--slate-500);">var(--bg-primary) / var(--bg-secondary)</span><br><span style="color:var(--slate-400);">Kiedy:</span> brak ERROR/WARNING/duplikatu/aktywnego — co drugi wiersz jaśniejszy dla czytelności. Sticky kolumny (Lp, Nazwa, Rzędne, Wys) mają nieprzezroczyste tło <code>_excelStickyCellBg(tint, solidBase)</code>.</span>' +
        '<span style="width:16px;height:12px;border-radius:2px;background:var(--slate-950);border:1px dashed rgba(var(--slate-500),0.4);display:inline-block;margin-top:2px;"></span><span><b>Zablokowany (kłódka)</b> <span style="color:var(--slate-500);">ikona <i data-lucide="lock" style="width:10px;height:10px;vertical-align:middle;"></i> + disabled</span><br><span style="color:var(--slate-400);">Kiedy:</span> <code>isWellLocked(wIdx)</code> — studnia ma zaakceptowane PZ lub jest w zamówieniu; edycja zablokowana, toast przy próbie.</span>' +
        '</div>' +
        '<p style="margin:0.45rem 0 0;font-size:var(--fs-3xs);color:var(--slate-500);line-height:1.4;">Kolory liczone w <code>excelTableBody.js:_excelRenderTbody</code> i odświeżane bez re-renderu w <code>_excelRefreshDupColors</code>; statusy z <code>solverValidation.js:recalculateWellErrors()</code> przez polling. Priorytet tła: <b>duplikat &gt; ERROR (0.12) &gt; WARNING (0.1) &gt; aktywny (0.18) &gt; naprzemienny</b>.</p>' +
        '</div>';
    const html =
        '<div class="modal modal--excel-shortcuts">' +
        '<div class="modal-header"><h3>Skróty klawiszowe Excel</h3>' +
        '<button type="button" onclick="this.closest(\'.modal-overlay\').remove()" class="btn-icon" aria-label="Zamknij"><i data-lucide="x" aria-hidden="true"></i></button></div>' +
        '<div class="excel-shortcuts-body">' +
        '<table style="width:100%;border-collapse:collapse;font-size: var(--fs-base);">' +
        '<thead><tr><th scope="col" class="th-l-pad25-bb">Skrót</th>' +
        '<th scope="col" class="th-l-pad25-bb">Opis</th></tr></thead>' +
        '<tbody>' +
        rows.join('') +
        '</tbody></table>' +
        legend +
        '<p style="margin:0;padding:0.5rem;font-size: var(--fs-xs);color:var(--slate-500);">Skróty działają, gdy fokus znajduje się w tabeli konfiguracyjnej. Escape najpierw anuluje edycję komórki lub zaznaczenie, a dopiero ponownie zamyka tabelę.</p>' +
        '</div></div>';

    const overlay = window.showModal({
        id: 'excel-shortcuts-modal',
        html: html
    });
    /* Ikony Lucide w treści modala (showModal nie wywołuje createIcons) */
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try {
            lucide.createIcons({ root: overlay });
        } catch (_e) {}
    }
}

window.openExcelShortcutsPopup = openExcelShortcutsPopup;
