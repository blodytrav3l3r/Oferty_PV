window.ConflictModal = {
    show(offerNumber) {
        return new Promise((resolve) => {
            let settled = false;
            const done = (result) => {
                if (settled) return;
                settled = true;
                resolve(result);
            };
            const html =
                '<div class="modal modal--ie" role="document">' +
                '<div class="modal-header"><h3 id="ie-conflict-title"><span class="modal-title-icon modal-title-icon--warn"><i data-lucide="alert-triangle" class="icon-sm"></i></span>Konflikt numeru oferty</h3><button type="button" class="btn-icon" aria-label="Zamknij" data-cm-close><i data-lucide="x" class="icon-14"></i></button></div>' +
                '<div class="modal-body">' +
                '<p class="ie-modal-lead">Oferta o numerze <strong class="ie-modal-strong">' +
                window.escapeHtml(offerNumber) +
                '</strong> już istnieje w systemie. Wybierz akcję:</p>' +
                '</div>' +
                '<div class="modal-footer ie-conflict-actions">' +
                '<button type="button" class="btn btn-sm btn-secondary btn-flex-1" data-cm-skip><i data-lucide="skip-forward" class="icon-14"></i>Pomiń</button>' +
                '<button type="button" class="btn btn-sm btn-secondary btn-flex-1 btn-warn-outline" data-cm-overwrite><i data-lucide="refresh-cw" class="icon-14"></i>Nadpisz</button>' +
                '<button type="button" class="btn btn-sm btn-primary btn-flex-1" data-cm-clone><i data-lucide="copy" class="icon-14"></i>Sklonuj</button>' +
                '</div>' +
                '</div>';
            window.showModal({
                id: 'ie-conflict-modal',
                titleId: 'ie-conflict-title',
                html: html,
                onClose: () => done('skip')
            });
            const overlay = document.getElementById('ie-conflict-modal');
            if (!overlay) return;
            if (window.lucide) lucide.createIcons({ root: overlay });
            const close = (result) => {
                done(result);
                window.closeModal('ie-conflict-modal');
            };
            overlay.querySelector('[data-cm-skip]').addEventListener('click', () => close('skip'));
            overlay
                .querySelector('[data-cm-overwrite]')
                .addEventListener('click', () => close('overwrite'));
            overlay
                .querySelector('[data-cm-clone]')
                .addEventListener('click', () => close('clone'));
            const xBtn = overlay.querySelector('[data-cm-close]');
            if (xBtn) xBtn.addEventListener('click', () => close('skip'));
        });
    }
};
