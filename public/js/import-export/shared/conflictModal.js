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
                '<div class="modal" role="document">' +
                '<div class="modal-header"><h3 id="ie-conflict-title" style="display:flex;align-items:center;gap:0.5rem;font:var(--fw-bold) var(--fs-2xl) \'Inter\',sans-serif;color:var(--text-primary);"><i data-lucide="alert-triangle" class="icon-sm" style="color:var(--warn);"></i>Konflikt numeru oferty</h3><button type="button" class="btn-icon" aria-label="Zamknij" data-cm-close><i data-lucide="x" class="icon-14"></i></button></div>' +
                '<p style="margin:0 0 1.2rem 0;color:var(--text-secondary);font:var(--fw-normal) var(--fs-lg) \'Inter\',sans-serif;line-height:1.55;">Oferta o numerze <strong style="color:var(--text-primary);font-weight:var(--fw-semibold);">' +
                window.escapeHtml(offerNumber) +
                '</strong> już istnieje w systemie. Wybierz akcję:</p>' +
                '<div class="modal-footer" style="justify-content:stretch;flex-wrap:wrap;gap:0.5rem;">' +
                '<button type="button" class="btn btn-sm btn-secondary" data-cm-skip style="flex:1;justify-content:center;"><i data-lucide="skip-forward" class="icon-14"></i>Pomiń</button>' +
                '<button type="button" class="btn btn-sm btn-secondary" data-cm-overwrite style="flex:1;justify-content:center;border-color:var(--warn);"><i data-lucide="refresh-cw" class="icon-14"></i>Nadpisz</button>' +
                '<button type="button" class="btn btn-sm btn-primary" data-cm-clone style="flex:1;justify-content:center;"><i data-lucide="copy" class="icon-14"></i>Utwórz kopię (-2)</button>' +
                '</div></div>';
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
