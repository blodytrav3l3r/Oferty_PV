/**
 * priceDefaults.js — Zapisz/Przywróć domyślne cenniki.
 *
 * saveAllDefaults()  — przycisk "Zapisz domyślne" w toolbarze cennika
 * refreshDefaultsTimestamp() — aktualizuje tooltip z datą ostatniej zmiany
 */

async function saveAllDefaults() {
    const confirmed = await appConfirm(
        'Czy na pewno zapisać bieżący stan WSZYSTKICH cenników (rury, studnie, PRECO) jako nowe domyślne?\n\nTe wartości będą używane po resecie cennika i przywracane na nowym komputerze.',
        {
            title: 'Zapisz jako domyślne',
            type: 'warning',
            okText: 'Zapisz domyślne',
            cancelText: 'Anuluj'
        }
    );
    if (!confirmed) return;

    const btn = document.getElementById('btn-save-defaults');
    if (btn) btn.disabled = true;

    try {
        const res = await fetchWithTimeout('/api/price-overrides/save-defaults', {
            method: 'POST',
            headers: typeof authHeaders === 'function' ? authHeaders() : {}
        });
        const data = await res.json();
        if (data.ok) {
            showToast(data.message, 'success');
            refreshDefaultsTimestamp();
        } else {
            showToast(data.error || 'Błąd zapisu domyślnych cenników', 'error');
        }
    } catch (err) {
        showToast('Błąd sieci: ' + (err.message || 'brak połączenia'), 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function refreshDefaultsTimestamp() {
    try {
        const res = await fetchWithTimeout('/api/settings/pricelist_defaults_updated_at', {
            headers: typeof authHeaders === 'function' ? authHeaders() : {}
        });
        const data = await res.json();
        const btn = document.getElementById('btn-save-defaults');
        if (!btn) return;

        if (data.value) {
            const d = new Date(data.value);
            const formatted =
                d.toLocaleDateString('pl-PL') +
                ' ' +
                d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            btn.title =
                'Zapisz bieżący stan wszystkich cenników jako domyślne\nOstatnia zmiana: ' +
                formatted;
        } else {
            btn.title =
                'Zapisz bieżący stan wszystkich cenników jako domyślne\nOstatnia zmiana: nigdy';
        }
    } catch (e) {
        // ignoruj — tooltip zostanie z domyślnym tekstem
    }
}

window.saveAllDefaults = saveAllDefaults;
window.refreshDefaultsTimestamp = refreshDefaultsTimestamp;
