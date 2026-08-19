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
    const html =
        '<div class="modal" style="max-width:min(96vw,560px);max-height:80vh;overflow:auto;">' +
        '<div class="modal-header"><h3>Skróty klawiszowe Excel</h3>' +
        '<button onclick="this.closest(\'.modal-overlay\').remove()" class="btn-close-4xl-line1">✕</button></div>' +
        '<table style="width:100%;border-collapse:collapse;font-size: var(--fs-base);">' +
        '<th scope="col"ead><tr><th scope="col" class="th-l-pad25-bb">Skrót</th>' +
        '<th scope="col" class="th-l-pad25-bb">Opis</th></tr></thead>' +
        '<tbody>' +
        rows.join('') +
        '</tbody></table>' +
        '<p style="margin:0;padding:0.5rem;font-size: var(--fs-xs);color:var(--slate-500);">Skróty działają, gdy fokus znajduje się w tabeli konfiguracyjnej. Escape najpierw anuluje edycję komórki lub zaznaczenie, a dopiero ponownie zamyka tabelę.</p>' +
        '</div>';

    window.showModal({
        id: 'excel-shortcuts-modal',
        html: html
    });
}

window.openExcelShortcutsPopup = openExcelShortcutsPopup;
