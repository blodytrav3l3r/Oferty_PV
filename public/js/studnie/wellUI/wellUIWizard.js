// @ts-check
/* ===== WELL UI — Kreator i blokady ===== */

/* ===== BLOKADA OFERTY - BANER ===== */
const OFFER_LOCKED_MSG =
    '<i data-lucide="lock" aria-hidden="true"></i> Ta studnia jest zablokowana — jest częścią zamówienia. Edytuj ją przez zamówienie.';
const WELL_LOCKED_MSG =
    '<i data-lucide="lock" aria-hidden="true"></i> Studnia zablokowana — posiada zaakceptowane zlecenie produkcyjne.';

function renderOfferLockBanner() {
    // Jeśli jesteśmy w trybie zamówienia, baner blokady z oferty nie powinien się wyświetlać
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        const lockBanner = document.getElementById('offer-lock-banner');
        if (lockBanner) lockBanner.style.display = 'none';
        return;
    }

    let lockBanner = document.getElementById('offer-lock-banner');
    if (!lockBanner) {
        const centerCol = document.querySelector('.well-center-column');
        if (!centerCol) return;
        lockBanner = document.createElement('div');
        lockBanner.id = 'offer-lock-banner';
        centerCol.insertBefore(lockBanner, centerCol.firstChild);
    }

    // Oblicz stan zamówień częściowych
    const well = getCurrentWell();
    const wellLocked = well && typeof isWellOrdered === 'function' && isWellOrdered(well);
    const hasAnyOrders =
        editingOfferIdStudnie &&
        typeof getOrdersForOffer === 'function' &&
        getOrdersForOffer(editingOfferIdStudnie).length > 0;

    if (!hasAnyOrders && !wellLocked) {
        lockBanner.style.display = 'none';
        return;
    }

    // Pokaż info o zamówieniach częściowych
    const orders =
        typeof getOrdersForOffer === 'function' ? getOrdersForOffer(editingOfferIdStudnie) : [];
    const progress =
        typeof getOfferOrderProgress === 'function'
            ? getOfferOrderProgress(editingOfferIdStudnie, wells)
            : { ordered: 0, total: wells.length, percent: 0 };

    if (wellLocked) {
        // Znajdź zamówienie, do którego należy bieżąca studnia
        const wellOrder = orders.find((ord) => (ord.wells || []).some((w) => w.id === well.id));

        lockBanner.style.cssText = `
            display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
            padding:0.7rem 1rem; margin-top:calc(0.5rem + 2px); margin-bottom:0.6rem; border-radius:10px;
            background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.08));
            border: 2px solid rgba(239,68,68,0.3);
        `;

        lockBanner.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <span style="font-size:1.3rem;"><i data-lucide="lock"></i></span>
                <div>
                    <div style="font-size:0.82rem; font-weight:800; color:#f87171;">
                        STUDNIA ZABLOKOWANA
                    </div>
                    <div style="font-size:0.65rem; color:var(--text-muted);">
                        „${escapeHtml(well.name)}" jest częścią zamówienia${wellOrder ? ' ' + escapeHtml(wellOrder.orderNumber || '') : ''}.
                        Edytuj ją przez zamówienie lub wybierz inną studnię.
                        <span style="color:#34d399; font-weight:700;">${progress.ordered}/${progress.total} studni zamówionych</span>
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:0.4rem; align-items:center;">
                ${
                    wellOrder
                        ? `<button class="btn btn-sm" data-action="navigateToOrderWell" data-order-id="${wellOrder.id}" style="height:48px; background:rgba(16,185,129,0.2); border:1px solid rgba(16,185,129,0.4); color:#34d399; font-size:0.75rem; font-weight:700; padding:0 1rem; display:flex; align-items:center; gap:0.4rem;">
                        <i data-lucide="package"></i> Edytuj zamówienie
                    </button>`
                        : ''
                }
            </div>
        `;
    } else {
        // Oferta ma zamówienia, ale bieżąca studnia jest wolna
        lockBanner.style.cssText = `
            display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
            padding:0.5rem 1rem; margin-top:calc(0.5rem + 2px); margin-bottom:0.6rem; border-radius:10px;
            background: linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.05));
            border: 1px solid rgba(16,185,129,0.25);
        `;

        lockBanner.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.5rem;">
                <span style="font-size:1rem;"><i data-lucide="info"></i></span>
                <div style="font-size:0.7rem; color:var(--text-muted);">
                    Oferta ma <strong style="color:#34d399;">${orders.length}</strong> zamówień
                    (<strong style="color:#34d399;">${progress.ordered}/${progress.total}</strong> studni zamówionych).
                    Ta studnia jest <strong style="color:#6ee7b7;">dostępna do edycji</strong>.
                </div>
            </div>
        `;
    }
}

/* ===== PARAMETRY OGÓLNE (KAFELKI) ===== */
function setupParamTiles() {
    const wizardRoot = document.getElementById('wizard-step-2');
    if (!wizardRoot) return;

    wizardRoot.querySelectorAll('.param-group').forEach((group) => {
        const paramName = group.getAttribute('data-param');
        group.querySelectorAll('.param-tile').forEach((btn) => {
            if (btn.dataset.listenerBound === 'true') return;
            btn.dataset.listenerBound = 'true';
            btn.addEventListener('click', async () => {
                const val = btn.getAttribute('data-val');
                // Zawsze przełączaj wizualny stan aktywności (dla kroku 2 kreatora bez studni)
                group.querySelectorAll('.param-tile').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                // Domyślne "Nie" dla wkładki na całą wysokość przy wyborze PRECO
                if (paramName === 'kineta' && (val === 'preco' || val === 'precotop')) {
                    const precoHeightGroup = wizardRoot.querySelector(
                        '.param-group[data-param="precoFullHeight"]'
                    );
                    if (precoHeightGroup && !precoHeightGroup.querySelector('.param-tile.active')) {
                        const nieBtn = precoHeightGroup.querySelector(
                            '.param-tile[data-val="nie"]'
                        );
                        if (nieBtn) {
                            nieBtn.click();
                        }
                    }
                }

                // Automatyczne dopasowanie spocznika do kinety (jeśli ma ten sam materiał)
                if (paramName === 'kineta') {
                    const spocznikGroup = wizardRoot.querySelector(
                        '.param-group[data-param="spocznik"]'
                    );
                    if (spocznikGroup) {
                        const syncValues = [
                            'beton',
                            'beton_gfk',
                            'klinkier',
                            'preco',
                            'precotop',
                            'unolith',
                            'predl',
                            'kamionka',
                            'brak'
                        ];
                        if (syncValues.includes(val)) {
                            const targetBtn = spocznikGroup.querySelector(
                                `.param-tile[data-val="${val}"]`
                            );
                            if (targetBtn && !targetBtn.classList.contains('active')) {
                                targetBtn.click();
                            }
                        }
                    }

                    // PRECO / PrecoTop → wymuszenie spocznikH = '1/1'
                    if (val === 'preco' || val === 'precotop') {
                        const spocznikHGroup = wizardRoot.querySelector(
                            '.param-group[data-param="spocznikH"]'
                        );
                        if (spocznikHGroup) {
                            const hBtn = spocznikHGroup.querySelector(
                                '.param-tile[data-val="1/1"]'
                            );
                            if (hBtn && !hBtn.classList.contains('active')) {
                                hBtn.click();
                            }
                        }
                    }
                }

                enforceLoadClassRulesWizard(paramName, val);
                updateParamTilesUI();

                // Pokaż/ukryj sub-opcje wkładki PEHD (które elementy mają wkładkę)
                if (paramName === 'wkladka') {
                    const subOptions = document.getElementById('wkladka-sub-options');
                    if (subOptions) {
                        subOptions.style.display = val !== 'brak' ? 'block' : 'none';
                    }
                }

                // Śledzenie kreatora (zawsze)
                wizardConfirmedParams.add(paramName);
                validateWizardStep2();
            });
        });
    });
}

function updateParamTilesUI() {
    // Kafelki w kroku 2 zachowuja wlasny stan. Nie synchronizujemy ich z aktualnie
    // edytowana studnia, zeby zmiana jednej studni nie zmieniala parametrow ogolnych.

    // Pokaż/ukryj pola nazw powłok w zależności od bieżącego stanu kafelków (działa ze studnią lub bez niej)
    const malowanieWVal = getActiveTileValue('malowanieW');
    const malowanieZVal = getActiveTileValue('malowanieZ');
    const kinetaVal = getActiveTileValue('kineta');

    const powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    const powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';

    // Pokaz/ukryj grupe parametrow precoFullHeight na podstawie kinety
    const precoGroupWizard = document.getElementById('preco-full-height-wizard-group');
    if (precoGroupWizard) {
        precoGroupWizard.style.display =
            kinetaVal === 'preco' || kinetaVal === 'precotop' ? 'flex' : 'none';
    }
    document.querySelectorAll('.param-group[data-param="precoFullHeight"]').forEach((el) => {
        const wrapper = el.closest('.wizard-param-group') || el.parentElement;
        if (wrapper && !wrapper.id) {
            // Not the wizard one, it's the individual well one
            wrapper.style.display =
                kinetaVal === 'preco' || kinetaVal === 'precotop' ? 'block' : 'none';
        }
    });

    if (malowanieWVal === 'brak') {
        const pwWInput = document.getElementById('powloka-name-w');
        if (pwWInput) pwWInput.value = '';
    }
    if (malowanieZVal === 'brak') {
        const pwZInput = document.getElementById('powloka-name-z');
        if (pwZInput) pwZInput.value = '';
    }
}
