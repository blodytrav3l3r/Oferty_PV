window.ConflictModal = {
    show(offerNumber) {
        return new Promise((resolve) => {
            showModal({
                id: 'ie-conflict-modal',
                title: 'Konflikt numeru oferty',
                titleId: 'ie-conflict-title',
                html:
                    '<div style="background:var(--white);border-radius: var(--radius);padding:2rem;max-width:480px;width:90%;box-shadow:0 8px 32px rgba(var(--black-rgb), 0.3);">' +
                    '<h3 id="ie-conflict-title" style="margin:0 0 0.75rem 0;font-size: var(--fs-3xl);">Konflikt numeru oferty</h3>' +
                    '<p style="margin:0 0 1.5rem 0;color:var(--slate-500);font-size: var(--fs-xl);">Oferta o numerze <strong>' +
                    window.escapeHtml(offerNumber) +
                    '</strong> już istnieje w systemie. Co robimy?</p>' +
                    '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
                    '<button class="ie-btn ie-btn-skip" style="flex:1;padding:0.6rem 1rem;border:1px solid var(--slate-300);border-radius: var(--radius-sm);background:var(--slate-100);cursor:pointer;">Pomiń</button>' +
                    '<button class="ie-btn ie-btn-overwrite" style="flex:1;padding:0.6rem 1rem;border:1px solid var(--warn);border-radius: var(--radius-sm);background:var(--warn-bg-soft);cursor:pointer;font-weight: var(--fw-semibold);">Nadpisz</button>' +
                    '<button class="ie-btn ie-btn-clone" style="flex:1;padding:0.6rem 1rem;border:1px solid var(--blue);border-radius: var(--radius-sm);background:var(--slate-100);cursor:pointer;font-weight: var(--fw-semibold);">Utwórz kopię (sufiks -2)</button>' +
                    '</div>',
                onClose: () => resolve('skip')
            });
            const overlay = document.getElementById('ie-conflict-modal');
            const close = (result) => {
                resolve(result);
                overlay.remove();
            };
            overlay.querySelector('.ie-btn-skip').addEventListener('click', () => close('skip'));
            overlay
                .querySelector('.ie-btn-overwrite')
                .addEventListener('click', () => close('overwrite'));
            overlay.querySelector('.ie-btn-clone').addEventListener('click', () => close('clone'));
        });
    }
};
