// @ts-check
/* ===== ORDER MANAGER — CSP ACTIONS + EXPORT ===== */
// Ładowany jako ostatni — rejestruje CSP handlers i eksport funkcyjny

window.showKartaBudowyExportChoice = function () {
    if (!orderEditMode || !orderEditMode.orderId) {
        showToast('Brak aktywnego zamówienia', 'error');
        return;
    }
    const orderId = orderEditMode.orderId;
    const modalHtml = `
    <div id="karta-export-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10000; backdrop-filter: blur(4px);">
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; width: 350px; padding: 1.5rem; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; color: #fff; font-weight: 700;">Wydruk Karty Budowy</h3>
            <p style="font-size: 0.8rem; color: var(--border); margin-bottom: 1.5rem;">Wybierz format eksportu karty budowy zamówienia</p>
            <div style="display: flex; gap: 1rem; justify-content: center; margin-bottom: 1.5rem;">
                <button data-action="exportKartaToPDF" data-order-id="${orderId}" style="flex: 1; background: rgba(var(--danger-rgb),0.2); color: #fca5a5; border: 2px solid rgba(var(--danger-rgb),0.6); padding: 1rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;">
                    <span style="font-size: 2rem;"><i data-lucide="file-text"></i></span> PDF
                </button>
                <button data-action="exportKartaToWord" data-order-id="${orderId}" style="flex: 1; background: rgba(var(--blue-rgb),0.2); color: #93c5fd; border: 2px solid rgba(var(--blue-rgb),0.6); padding: 1rem; border-radius: 10px; cursor: pointer; font-weight: 800; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; transition: all 0.2s;">
                    <span style="font-size: 2rem;"><i data-lucide="edit"></i></span> Word
                </button>
            </div>
            <button data-action="closeKartaExportModal" style="padding: 0.5rem 1rem; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); cursor: pointer;">Anuluj</button>
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
    fetch('/api/orders-studnie/' + orderId + '/export-karta-pdf', {
        headers:
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' }
    })
        .then(function (res) {
            if (!res.ok) throw new Error('Nie udało się wyeksportować karty budowy');
            return res.blob();
        })
        .then(function (blob) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'karta_budowy_' + orderId.substring(0, 8) + '.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('Pobrano Kartę Budowy w PDF', 'success');
        })
        .catch(function (err) {
            if (typeof logger !== 'undefined') logger.error('orderManager', '[Export Error]', err);
            showToast('Błąd eksportu: ' + err.message, 'error');
        });
};

window.exportKartaToWord_action = async function (orderId) {
    const modal = document.getElementById('karta-export-modal');
    if (modal) modal.remove();
    showToast('Generowanie Karty Budowy (DOCX)...', 'info');
    fetch('/api/orders-studnie/' + orderId + '/export-karta-docx', {
        headers:
            typeof authHeaders === 'function'
                ? authHeaders()
                : { 'Content-Type': 'application/json' }
    })
        .then(function (res) {
            if (!res.ok) throw new Error('Nie udało się wyeksportować karty budowy');
            return res.blob();
        })
        .then(function (blob) {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'karta_budowy_' + orderId.substring(0, 8) + '.docx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('Pobrano Kartę Budowy w DOCX', 'success');
        })
        .catch(function (err) {
            if (typeof logger !== 'undefined') logger.error('orderManager', '[Export Error]', err);
            showToast('Błąd eksportu: ' + err.message, 'error');
        });
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupParamTiles();
        updateParamTilesUI();
        loadProductionOrders();
    }, 500);
});

/* CSP Actions registrations */
if (typeof registerCspAction === 'function') {
    registerCspAction('deleteOrderStudnie', {
        handler: function ({ orderId }) {
            deleteOrderStudnie(orderId);
        },
        params: ['orderId']
    });

    registerCspAction('onZleceniaKatChange', onZleceniaKatChange);

    registerCspAction('exitPreviewMode', window.exitPreviewMode);

    registerCspAction('toggleDaneElementu', window.toggleDaneElementu);

    registerCspAction('selectZleceniaElement', {
        handler: _onSelectZleceniaElement,
        params: ['zlIdx']
    });

    registerCspAction('deleteProductionOrderFromList', {
        handler: _onDeleteProductionOrderFromList,
        params: ['poId']
    });

    registerCspAction('moveZleceniaComponent', {
        handler: _onMoveZleceniaComponent,
        params: ['zlIdx', 'direction']
    });

    registerCspAction('toggleDaneZlecenia', _onToggleDaneZlecenia);

    registerCspAction('toggleCard', function (params, target) {
        if (typeof window.toggleCard === 'function') {
            window.toggleCard(params.targetId, params.iconId);
        }
    });

    registerCspAction('selectZleceniaTile', {
        handler: function (params, target) {
            selectZleceniaTile(target, params.targetId, params.value);
        },
        params: ['targetId', 'value']
    });

    registerCspAction('selectAndKatChange', _onSelectAndKatChange);

    registerCspAction('setKatStopni', {
        handler: _onSetKatStopni,
        params: ['value']
    });

    registerCspAction('closeBulkOrderPopup', closeBulkOrderPopup);

    registerCspAction('executeBulkFromPopup', executeBulkFromPopup);

    registerCspAction('toggleBulkSeqItem', function (target) {
        toggleBulkSeqItem(target);
    });

    registerCspAction('bulkSeqInput', _onBulkSeqInput);

    registerCspAction('exportKartaToPDF', {
        handler: function ({ orderId }) {
            window.exportKartaToPDF_action(orderId);
        },
        params: ['orderId']
    });

    registerCspAction('exportKartaToWord', {
        handler: function ({ orderId }) {
            window.exportKartaToWord_action(orderId);
        },
        params: ['orderId']
    });

    registerCspAction('closeKartaExportModal', function () {
        var modal = document.getElementById('karta-export-modal');
        if (modal) modal.remove();
    });

    /* Przejscia szczelne handlers */
    registerCspAction('pszRodzajCatChange', _onPszRodzajCatChange);
    registerCspAction('pszRodzajCustomChange', _onPszRodzajCustomChange);
    registerCspAction('pszDnSelectChange', _onPszDnSelectChange);
    registerCspAction('pszDnInputChange', _onPszDnInputChange);
    registerCspAction('pszUwagiChange', _onPszUwagiChange);
    registerCspAction('pszCzyChange', _onPszCzyChange);
    registerCspAction('pszDeleteRow', _onPszDeleteRow);
    registerCspAction('zlCfgDrag', {
        handler: function (p, t, e) {
            if (e.type === 'dragstart') {
                handleZlCfgDragStart(e);
                return;
            }
            if (e.type === 'dragover') {
                e.preventDefault();
                handleZlCfgDragOver(e);
                return;
            }
            if (e.type === 'drop') {
                e.preventDefault();
                handleZlCfgDrop(e);
                return;
            }
            if (e.type === 'dragend') {
                handleZlCfgDragEnd(e);
                return;
            }
        },
        params: []
    });
}
