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
    } catch (e) {
        /* ignore cross-origin or missing parent */
    }
}

window.showKartaBudowyExportChoice = function () {
    if (!orderEditMode || !orderEditMode.orderId) {
        showToast('Brak aktywnego zamówienia', 'error');
        return;
    }
    const orderId = orderEditMode.orderId;
    const modalHtml = `
    <div id="karta-export-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: ${LAYERS.EXPORT_MODAL}; backdrop-filter: blur(4px);">
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; width: 350px; padding: 1.5rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #fff; font-weight: 700;">Wydruk Karty Budowy</h3>
            <p style="font-size: 0.8rem; color: var(--border); margin-bottom: 1.5rem;">Wybierz format eksportu karty budowy zamówienia</p>
            <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem;">
                <button onclick="exportKartaToPDF_action('${orderId}')" style="flex: 1; background: rgba(var(--danger-rgb),0.2); color: #fca5a5; border: 2px solid rgba(var(--danger-rgb),0.6); padding: 1rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;" onmouseenter="this.style.background='rgba(var(--danger-rgb),0.4)'" onmouseleave="this.style.background='rgba(var(--danger-rgb),0.2)'">
                    <span style="font-size: 2rem;"><i data-lucide="file-text"></i></span> PDF
                </button>
                <button onclick="exportKartaToWord_action('${orderId}')" style="flex: 1; background: rgba(var(--blue-rgb),0.2); color: #93c5fd; border: 2px solid rgba(var(--blue-rgb),0.6); padding: 1rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;" onmouseenter="this.style.background='rgba(var(--blue-rgb),0.4)'" onmouseleave="this.style.background='rgba(var(--blue-rgb),0.2)'">
                    <span style="font-size: 2rem;"><i data-lucide="edit"></i></span> Word
                </button>
            </div>
            <button style="padding: 0.5rem 1rem; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); cursor: pointer;" onclick="document.getElementById('karta-export-modal').remove()">Anuluj</button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

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
            return res.blob();
        })
        .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `karta_budowy_${orderId.substring(0, 8)}.pdf`;
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
            return res.blob();
        })
        .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `karta_budowy_${orderId.substring(0, 8)}.docx`;
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
