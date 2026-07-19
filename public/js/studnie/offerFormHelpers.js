// @ts-check
/* ===== POMOCNICZE FUNKCJE FORMULARZA OFERTY ===== */

function restoreWizardState(wizardState, preventStepOverride) {
    var wizardGlobalParams = wizardState && wizardState.globalParams;
    if (wizardGlobalParams) {
        document.querySelectorAll('#wizard-step-2 .param-group').forEach(function (group) {
            var paramName = group.getAttribute('data-param');
            if (!paramName || !wizardGlobalParams.hasOwnProperty(paramName)) return;
            var val = wizardGlobalParams[paramName];
            if (!val) return;
            group.querySelectorAll('.param-tile').forEach(function (b) {
                b.classList.remove('active');
            });
            var targetTile = group.querySelector('.param-tile[data-val="' + val + '"]');
            if (targetTile) targetTile.classList.add('active');
            if (typeof wizardConfirmedParams !== 'undefined') {
                wizardConfirmedParams.add(paramName);
            }
        });
        var wkladkaV = wizardGlobalParams.wkladka;
        var subOpts = document.getElementById('wkladka-sub-options');
        if (wkladkaV && wkladkaV !== 'brak') {
            if (subOpts) subOpts.style.display = 'block';
            var cbDennica = document.getElementById('pehd-dennica');
            var cbNadbudowa = document.getElementById('pehd-nadbudowa');
            var cbZwienczenie = document.getElementById('pehd-zwienczenie');
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
        var legacyBanner = document.getElementById('wizard-legacy-banner');
        if (legacyBanner) {
            legacyBanner.style.display = 'flex';
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: legacyBanner });
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
    var titleEl = document.getElementById('offer-form-title-studnie');
    if (titleEl)
        titleEl.innerHTML =
            '<i data-lucide="pencil"></i> Edycja Oferty: <span style="font-weight:700">' +
            escapeHtml(number || offerId) +
            '</span>';
    var btnEl2 = document.getElementById('btn-save-studnie-offer');
    if (btnEl2) btnEl2.innerHTML = '<i data-lucide="save"></i> Zapisz ofertę';

    var btnChangeUser = document.getElementById('btn-change-offer-user');
    if (btnChangeUser) {
        btnChangeUser.style.display =
            currentUser && (currentUser.role === 'admin' || currentUser.role === 'pro')
                ? 'inline-block'
                : 'none';
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
