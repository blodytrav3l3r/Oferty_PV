// @ts-check
/* ===== PRZEJŚCIA — CSP-safe action registrations ===== */

if (typeof registerCspAction === 'function') {
    registerCspAction('cancelPrzejscieEdit', window.cancelPrzejscieEdit);
    registerCspAction('openPrzejsciaVisibilityPopup', {
        handler: function ({ containerId }) {
            openPrzejsciaVisibilityPopup(containerId);
        },
        params: ['containerId']
    });
    registerCspAction('inlineUpdateAngles', function (t) {
        window.inlineUpdateAngles(t.dataset.containerId);
    });
    registerCspAction('syncEditState', function () {
        window.syncEditState();
    });
    registerCspAction('editUpdateAngles', function (t) {
        editUpdateAngles(parseInt(t.dataset.index, 10));
        window.syncEditState();
    });

    registerCspAction('inlineSetType', {
        handler: function ({ type, containerId }) {
            window.inlineSetType(type, containerId);
        },
        params: ['type', 'containerId']
    });
    registerCspAction('inlineSetDN', {
        handler: function ({ dnId, containerId }) {
            window.inlineSetDN(dnId, containerId);
        },
        params: ['dnId', 'containerId']
    });
    registerCspAction('inlineFinish', {
        handler: function ({ contextId, containerId }) {
            window.inlineFinish(contextId, containerId);
        },
        params: ['contextId', 'containerId']
    });
    registerCspAction('saveQuickEdit', function (t) {
        const index = parseInt(t.dataset.index, 10);
        const field = t.dataset.field;
        const value = t.value;
        if (typeof window.saveQuickEdit === 'function') {
            window.saveQuickEdit(index, field, value);
        }
    });
    registerCspAction('editInlineSetType', {
        handler: function ({ type }) {
            window.editInlineSetType(type);
        },
        params: ['type']
    });
    registerCspAction('editInlineSetDN', {
        handler: function ({ dnId }) {
            window.editInlineSetDN(dnId);
        },
        params: ['dnId']
    });
    registerCspAction('savePrzejscieEdit', {
        handler: function ({ index }) {
            savePrzejscieEdit(parseInt(index, 10));
        },
        params: ['index']
    });
    registerCspAction('togglePrzejsciaTypeVisibility', {
        handler: function ({ type }) {
            togglePrzejsciaTypeVisibility(type);
        },
        params: ['type']
    });
    registerCspAction('closePrzejsciaVisibilityPopup', {
        handler: function ({ containerId }) {
            closePrzejsciaVisibilityPopup(containerId);
        },
        params: ['containerId']
    });
    registerCspAction('setPrzejsciaVisibilityAll', {
        handler: function ({ visible }) {
            setPrzejsciaVisibilityAll(visible === 'true');
        },
        params: ['visible']
    });
    registerCspAction('closeModal', {
        handler: function ({ modalId }) {
            const m = document.getElementById(modalId);
            if (m) m.style.display = 'none';
        },
        params: ['modalId']
    });
    registerCspAction('ignoreClick', function () {});
    registerCspAction('confirmChangePrzejscieType', {
        handler: function ({ index, type }) {
            window.confirmChangePrzejscieType(parseInt(index, 10), type);
        },
        params: ['index', 'type']
    });
    registerCspAction('confirmChangePrzejscieDn', {
        handler: function ({ index, productId }) {
            window.confirmChangePrzejscieDn(parseInt(index, 10), productId);
        },
        params: ['index', 'productId']
    });
}
