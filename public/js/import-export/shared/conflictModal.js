window.ConflictModal = {
    show(offerNumber) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'ie-modal-overlay';
            overlay.style.cssText =
                'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';

            const box = document.createElement('div');
            box.style.cssText =
                'background:#fff;border-radius:12px;padding:2rem;max-width:480px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);';

            box.innerHTML =
                '<h3 style="margin:0 0 0.75rem 0;font-size:1.1rem;">Konflikt numeru oferty</h3>' +
                '<p style="margin:0 0 1.5rem 0;color:#666;font-size:0.9rem;">Oferta o numerze <strong>' +
                window.escapeHtml(offerNumber) +
                '</strong> już istnieje w systemie. Co robimy?</p>' +
                '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">' +
                '<button class="ie-btn ie-btn-skip" style="flex:1;padding:0.6rem 1rem;border:1px solid #ddd;border-radius:8px;background:#f5f5f5;cursor:pointer;">Pomiń</button>' +
                '<button class="ie-btn ie-btn-overwrite" style="flex:1;padding:0.6rem 1rem;border:1px solid #e0a800;border-radius:8px;background:#fff8e1;cursor:pointer;font-weight:600;">Nadpisz</button>' +
                '<button class="ie-btn ie-btn-clone" style="flex:1;padding:0.6rem 1rem;border:1px solid #1976d2;border-radius:8px;background:#e3f2fd;cursor:pointer;font-weight:600;">Utwórz kopię (sufiks -2)</button>' +
                '</div>';

            overlay.appendChild(box);
            document.body.appendChild(overlay);

            const close = (result) => {
                document.body.removeChild(overlay);
                resolve(result);
            };

            box.querySelector('.ie-btn-skip').onclick = () => close('skip');
            box.querySelector('.ie-btn-overwrite').onclick = () => close('overwrite');
            box.querySelector('.ie-btn-clone').onclick = () => close('clone');
        });
    }
};
