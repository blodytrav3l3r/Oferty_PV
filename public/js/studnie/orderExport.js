/** Odśwież globalne metryki pulpitu nawigacyjnego, jeśli działa w SPA / oknie nadrzędnym */
function refreshGlobalMetrics() {
    try {
        if (window.parent && typeof window.parent.loadRecycledNumbers === 'function') {
            window.parent.loadRecycledNumbers();
        }
        if (
            window.parent &&
            window.parent.SpaRouter &&
            typeof window.parent.SpaRouter.refreshModule === 'function'
        ) {
            window.parent.SpaRouter.refreshModule('zlecenia');
        }
    } catch (_e) {
        /* ignore cross-origin or missing parent */
    }
}

window.exportKartaToPDF_action = async function (orderId) {
    const modal = document.getElementById('karta-export-modal');
    if (modal) modal.remove();
    showToast('Generowanie Karty Budowy (PDF)...', 'info');
    fetch(`/api/orders-studnie/${orderId}/export-karta-pdf`, {
        headers:
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' }
    })
        .then((res) => {
            if (!res.ok) throw new Error('Nie udało się wyeksportować karty budowy');
            const fileName = window.ExportFilenames.serverFilename(
                res,
                `karta_budowy_${orderId.substring(0, 8)}.pdf`
            );
            return res.blob().then(function (blob) {
                return { blob: blob, fileName: fileName };
            });
        })
        .then((result) => {
            const blob = result.blob;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('Pobrano Kartę Budowy w PDF', 'success');
        })
        .catch((err) => {
            logger.error('orderManager', '[Export Error]', err);
            showToast('Błąd eksportu: ' + err.message, 'error');
        });
};

window.exportKartaToWord_action = async function (orderId) {
    const modal = document.getElementById('karta-export-modal');
    if (modal) modal.remove();
    showToast('Generowanie Karty Budowy (DOCX)...', 'info');
    fetch(`/api/orders-studnie/${orderId}/export-karta-docx`, {
        headers:
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' }
    })
        .then((res) => {
            if (!res.ok) throw new Error('Nie udało się wyeksportować karty budowy');
            const fileName = window.ExportFilenames.serverFilename(
                res,
                `karta_budowy_${orderId.substring(0, 8)}.docx`
            );
            return res.blob().then(function (blob) {
                return { blob: blob, fileName: fileName };
            });
        })
        .then((result) => {
            const blob = result.blob;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('Pobrano Kartę Budowy w DOCX', 'success');
        })
        .catch((err) => {
            logger.error('orderManager', '[Export Error]', err);
            showToast('Błąd eksportu: ' + err.message, 'error');
        });
};

/* ===== Rejestracja globali ===== */
window.refreshGlobalMetrics = refreshGlobalMetrics;
