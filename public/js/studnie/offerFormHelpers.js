// @ts-check
/* ===== POMOCNICZE FUNKCJE FORMULARZA OFERTY ===== */

function restoreWizardState(wizardState, preventStepOverride) {
    const wizardGlobalParams = wizardState && wizardState.globalParams;
    if (wizardGlobalParams) {
        document.querySelectorAll('#wizard-step-2 .param-group').forEach(function (group) {
            const paramName = group.getAttribute('data-param');
            if (!paramName || !Object.prototype.hasOwnProperty.call(wizardGlobalParams, paramName))
                return;
            const val = wizardGlobalParams[paramName];
            if (!val) return;
            group.querySelectorAll('.param-tile').forEach(function (b) {
                b.classList.remove('active');
            });
            const targetTile = group.querySelector('.param-tile[data-val="' + val + '"]');
            if (targetTile) targetTile.classList.add('active');
            if (typeof wizardConfirmedParams !== 'undefined') {
                wizardConfirmedParams.add(paramName);
            }
        });
        const wkladkaV = wizardGlobalParams.wkladka;
        const subOpts = document.getElementById('wkladka-sub-options');
        if (wkladkaV && wkladkaV !== 'brak') {
            if (subOpts) subOpts.style.display = 'block';
            const cbDennica = document.getElementById('pehd-dennica');
            const cbNadbudowa = document.getElementById('pehd-nadbudowa');
            const cbZwienczenie = document.getElementById('pehd-zwienczenie');
            if (cbDennica) cbDennica.checked = wizardGlobalParams.wkladkaDennica === wkladkaV;
            if (cbNadbudowa) cbNadbudowa.checked = wizardGlobalParams.wkladkaNadbudowa === wkladkaV;
            if (cbZwienczenie)
                cbZwienczenie.checked = wizardGlobalParams.wkladkaZwienczenie === wkladkaV;
        } else {
            if (subOpts) subOpts.style.display = 'none';
        }
        if (document.getElementById('powloka-name-w'))
            document.getElementById('powloka-name-w').value = wizardGlobalParams.powlokaNameW || '';
        if (document.getElementById('malowanie-wew-cena'))
            document.getElementById('malowanie-wew-cena').value =
                wizardGlobalParams.malowanieWewCena || '';
        if (document.getElementById('powloka-name-z'))
            document.getElementById('powloka-name-z').value = wizardGlobalParams.powlokaNameZ || '';
        if (document.getElementById('malowanie-zew-cena'))
            document.getElementById('malowanie-zew-cena').value =
                wizardGlobalParams.malowanieZewCena || '';
    } else {
        const legacyBanner = document.getElementById('wizard-legacy-banner');
        if (legacyBanner) {
            legacyBanner.style.display = 'flex';
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: legacyBanner });
        }
    }

    if (wizardGlobalParams) {
        const hasKinetaBrak = ['kineta', 'spocznik', 'spocznikH'].some(
            (paramName) => wizardGlobalParams[paramName] === 'brak'
        );
        const setParamTile = (paramName, value) => {
            const group = document.querySelector(
                '#wizard-step-2 .param-group[data-param="' + paramName + '"]'
            );
            if (!group) return;
            group.querySelectorAll('.param-tile').forEach((tile) => {
                tile.classList.toggle('active', tile.getAttribute('data-val') === value);
            });
        };

        if (hasKinetaBrak) {
            setParamTile('kineta', 'brak');
            setParamTile('spocznik', 'brak');
            setParamTile('spocznikH', 'brak');
        } else if (['preco', 'precotop', 'unolith'].includes(wizardGlobalParams.kineta)) {
            setParamTile('spocznikH', '1/1');
        }
    }

    if (typeof validateWizardStep2 === 'function') {
        validateWizardStep2();
    }

    if (!preventStepOverride) {
        if (typeof skipWizardToStep3 === 'function') skipWizardToStep3();
    } else {
        if (typeof wizardConfirmedParams !== 'undefined') {
            wizardConfirmedParams = new Set(WIZARD_REQUIRED_PARAMS);
        }
    }
}

function updateOfferFormHeader(number, offerId) {
    const titleEl = document.getElementById('offer-form-title-studnie');
    if (titleEl)
        titleEl.innerHTML =
            '<i data-lucide="pencil"></i> Edycja Oferty: <span class="fw-bold">' +
            escapeHtml(number || offerId) +
            '</span>';
    const btnEl2 = document.getElementById('btn-save-studnie-offer');
    if (btnEl2) btnEl2.innerHTML = '<i data-lucide="save"></i> Zapisz ofertę';

    const btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display = currentUser ? 'inline-block' : 'none';
        if (editingOfferAssignedUserName) {
            btnChangeUser.innerHTML =
                '<i data-lucide="user"></i> Opiekun: ' + escapeHtml(editingOfferAssignedUserName);
        } else {
            btnChangeUser.innerHTML = '<i data-lucide="user"></i> Zmień opiekuna';
        }
    }

    if (typeof renderOfferLockBanner === 'function') renderOfferLockBanner();
    if (typeof window.updateTransportCostSummary === 'function')
        window.updateTransportCostSummary();
}

/* ===== Rejestracja globali ===== */
window.restoreWizardState = restoreWizardState;
window.updateOfferFormHeader = updateOfferFormHeader;
