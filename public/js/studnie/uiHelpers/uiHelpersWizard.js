// @ts-check
/* ===== KREATOR — nawigacja, walidacja, wskaźniki ===== */

function goToWizardStep(step) {
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        if (step <= 2) {
            currentWizardStep = step;
            document.querySelectorAll('.wizard-step').forEach(function (s) {
                s.classList.remove('active');
            });
            updateWizardIndicator();
            updateStudnieBottomNav();
            var target = document.getElementById('wizard-step-' + step);
            if (target) target.classList.add('active');
            var layout = document.querySelector('.well-app-layout');
            if (layout) layout.classList.toggle('intro-mode', step === 1 || step === 2);
            showSection('builder');
            if (step === 2) validateWizardStep2();
            return;
        }
        if (step === 3) {
            showToast('Krok 3 (Oferta) jest niedost\u0119pny w trybie zam\u00f3wienia', 'info');
            return;
        }
    }
    if (typeof startStudnieViewTransition === 'function') {
        startStudnieViewTransition();
    }
    currentWizardStep = step;
    document.querySelectorAll('.wizard-step').forEach(function (s) {
        s.classList.remove('active');
    });
    updateWizardIndicator();
    updateStudnieBottomNav();
    var layout = document.querySelector('.well-app-layout');
    if (layout) {
        if (step === 1 || step === 2 || step === 4) {
            layout.classList.add('intro-mode');
        } else {
            layout.classList.remove('intro-mode');
        }
    }
    if (step === 4) {
        var builderSection = document.getElementById('section-builder');
        if (builderSection && !builderSection.classList.contains('active')) {
            showSection('builder');
        }
        var target = document.getElementById('wizard-step-4');
        if (target) target.classList.add('active');
        if (
            typeof orderEditMode !== 'undefined' &&
            orderEditMode &&
            typeof initKartaBudowyStep4 === 'function'
        ) {
            initKartaBudowyStep4();
        }
        return;
    }
    if (step === 5) {
        enterWizardOrderMode();
        return;
    }
    var builderSection = document.getElementById('section-builder');
    if (builderSection && !builderSection.classList.contains('active')) {
        showSection('builder');
    }
    var target = document.getElementById('wizard-step-' + step);
    if (target) target.classList.add('active');
    if (step === 3) updateWizardSummaryBar();
    if (step === 2) validateWizardStep2();
}

function enterWizardOrderMode() {
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        var builderSection = document.getElementById('section-builder');
        if (builderSection && !builderSection.classList.contains('active')) {
            showSection('builder');
        }
        var target = document.getElementById('wizard-step-3');
        if (target) target.classList.add('active');
        return;
    }
    if (editingOfferIdStudnie) {
        showToast(
            'Przejd\u017a do zam\u00f3wienia przez przycisk "Utw\u00f3rz zam\u00f3wienie" w podsumowaniu',
            'info'
        );
        currentWizardStep = 3;
        updateWizardIndicator();
        return;
    }
    if (!editingOfferIdStudnie) {
        showToast(
            'Najpierw zapisz ofert\u0119, aby m\u00f3c przej\u015b\u0107 do zam\u00f3wienia',
            'error'
        );
        currentWizardStep = 3;
        updateWizardIndicator();
        return;
    }
    var oId =
        typeof normalizeId === 'function'
            ? normalizeId(editingOfferIdStudnie)
            : editingOfferIdStudnie;
    var order =
        typeof ordersStudnie !== 'undefined' && ordersStudnie
            ? ordersStudnie.find(function (o) {
                  return normalizeId(o.offerId) === oId;
              })
            : null;
    if (order) {
        if (typeof enterOrderEditMode === 'function') {
            enterOrderEditMode(order.id);
        }
    } else {
        showToast(
            'Brak zam\u00f3wienia dla tej oferty. Utw\u00f3rz zam\u00f3wienie z poziomu podsumowania oferty.',
            'info'
        );
        currentWizardStep = 3;
        updateWizardIndicator();
    }
}

async function exitWizardOrderMode(targetStep) {
    if (targetStep === undefined) targetStep = 3;
    orderEditMode = null;
    if (typeof renderOrderModeBanner === 'function') renderOrderModeBanner();
    if (typeof editingOfferIdStudnie !== 'undefined' && editingOfferIdStudnie) {
        if (typeof loadSavedOfferStudnie === 'function') {
            await loadSavedOfferStudnie(editingOfferIdStudnie, null, 'builder', true);
        }
    }
    if (typeof refreshAll === 'function') refreshAll();
    if (targetStep) {
        goToWizardStep(targetStep);
    }
    showToast('<i data-lucide="bar-chart-2"></i> Powr\u00f3t do edycji oferty', 'info');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function wizardNext() {
    wizardNavStep(currentWizardStep + 1);
}

function wizardPrev() {
    wizardNavStep(currentWizardStep - 1);
}

function wizardNavStep(targetStep) {
    if (targetStep === currentWizardStep || targetStep < 1 || targetStep > 5) return;
    if (targetStep < currentWizardStep) {
        goToWizardStep(targetStep);
        return;
    }
    if (targetStep === 2) {
        goToWizardStep(2);
    } else if (targetStep === 3) {
        if (!validateWizardStep2()) {
            showToast(
                'Wybierz opcj\u0119 w ka\u017cdej grupie parametr\u00f3w przed przej\u015bciem do oferty',
                'error'
            );
            if (currentWizardStep === 1) goToWizardStep(2);
            return;
        }
        goToWizardStep(3);
    } else if (targetStep === 4) {
        goToWizardStep(4);
    } else if (targetStep === 5) {
        goToWizardStep(5);
    }
}

function getActiveTileValue(paramName) {
    var group = document.querySelector('.param-group[data-param="' + paramName + '"]');
    if (!group) return 'brak';
    var active = group.querySelector('.param-tile.active');
    return active ? active.getAttribute('data-val') : 'brak';
}

function validateWizardStep2() {
    var allConfirmed = WIZARD_REQUIRED_PARAMS.every(function (p) {
        return wizardConfirmedParams.has(p);
    });
    var malowanieWVal = getActiveTileValue('malowanieW');
    var malowanieZVal = getActiveTileValue('malowanieZ');
    var powlokaWValid = true;
    var malCenaWValid = true;
    if (malowanieWVal !== 'brak') {
        var pwW = document.getElementById('powloka-name-w');
        powlokaWValid = !!(pwW && pwW.value.trim() !== '');
        var mcW = document.getElementById('malowanie-wew-cena');
        malCenaWValid = !!(mcW && mcW.value.trim() !== '' && !isNaN(parseFloat(mcW.value)));
    }
    var powlokaZValid = true;
    var malCenaZValid = true;
    if (malowanieZVal !== 'brak') {
        var pwZ = document.getElementById('powloka-name-z');
        powlokaZValid = !!(pwZ && pwZ.value.trim() !== '');
        var mcZ = document.getElementById('malowanie-zew-cena');
        malCenaZValid = !!(mcZ && mcZ.value.trim() !== '' && !isNaN(parseFloat(mcZ.value)));
    }
    var powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    var malCenaWGroup = document.getElementById('malowanie-wew-cena-group');
    if (malCenaWGroup) malCenaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    var powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';
    var malCenaZGroup = document.getElementById('malowanie-zew-cena-group');
    if (malCenaZGroup) malCenaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';
    if (malowanieWVal === 'brak') {
        var pwWInput = document.getElementById('powloka-name-w');
        if (pwWInput) pwWInput.value = '';
        var mcWInput = document.getElementById('malowanie-wew-cena');
        if (mcWInput) mcWInput.value = '';
    }
    if (malowanieZVal === 'brak') {
        var pwZInput = document.getElementById('powloka-name-z');
        if (pwZInput) pwZInput.value = '';
        var mcZInput = document.getElementById('malowanie-zew-cena');
        if (mcZInput) mcZInput.value = '';
    }
    var isFullyValid =
        allConfirmed && powlokaWValid && powlokaZValid && malCenaWValid && malCenaZValid;
    var bottomNextBtn = document.getElementById('studnie-nav-next');
    var inlineNextBtn = document.getElementById('wizard-next-step2');
    if (bottomNextBtn) bottomNextBtn.disabled = !isFullyValid;
    if (inlineNextBtn) inlineNextBtn.disabled = !isFullyValid;
    var iconsChanged = false;
    document.querySelectorAll('.wizard-param-group').forEach(function (wrapper) {
        var param = wrapper.dataset.wizardParam;
        if (!param) return;
        var confirmed = wizardConfirmedParams.has(param);
        var wasConfirmed = wrapper.classList.contains('confirmed');
        if (confirmed !== wasConfirmed) {
            wrapper.classList.toggle('confirmed', confirmed);
            wrapper.classList.toggle('needs-selection', !confirmed);
            var icon = wrapper.querySelector('.status-icon');
            if (icon) {
                icon.innerHTML = confirmed
                    ? '<i data-lucide="check-circle-2"></i>'
                    : '<i data-lucide="alert-triangle"></i>';
                iconsChanged = true;
            }
        }
    });
    if (iconsChanged && window.lucide) {
        window.lucide.createIcons();
    }
    var msg = document.getElementById('wizard-validation-msg');
    if (msg) msg.classList.toggle('hidden', isFullyValid);
    return isFullyValid;
}

function updateStudnieBottomNav() {
    var nav = document.getElementById('studnie-wizard-bottom-nav');
    var prevBtn = document.getElementById('studnie-nav-prev');
    var stepInfo = document.getElementById('studnie-nav-step-info');
    var nextBtn = document.getElementById('studnie-nav-next');
    if (!nav) return;
    var step = currentWizardStep;
    nav.style.display = 'flex';
    nav.classList.toggle('no-buttons', step === 5);
    if (step === 5) return;
    if (prevBtn) {
        prevBtn.style.display = step === 1 ? 'none' : 'flex';
        prevBtn.onclick = wizardPrev;
    }
    if (stepInfo) stepInfo.textContent = 'Krok ' + step + ' z 5';
    if (nextBtn) {
        nextBtn.disabled = false;
        if (step === 4) {
            nextBtn.innerHTML = '<i data-lucide="arrow-right"></i> Przejd\u017a do zam\u00f3wienia';
            nextBtn.onclick = function () {
                step4NextAction();
            };
        } else if (step === 3) {
            nextBtn.innerHTML = '<i data-lucide="check"></i> Zako\u0144cz';
            nextBtn.onclick = async function () {
                if (!validateWizardStep2()) {
                    showToast('Najpierw uzupe\u0142nij wszystkie parametry w kroku 2', 'error');
                    return;
                }
                var saved = await saveOfferStudnie();
                if (saved) {
                    showSection('offer');
                    showToast('Oferta zapisana pomy\u015blnie', 'success');
                }
            };
        } else {
            nextBtn.innerHTML = '<i data-lucide="chevron-right"></i> Dalej';
            nextBtn.onclick = wizardNext;
        }
    }
}

function updateWizardIndicator() {
    var dots = document.querySelectorAll('.wizard-step-dot');
    dots.forEach(function (dot) {
        var step = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed', 'disabled');
        if (step === currentWizardStep) dot.classList.add('active');
        else if (step < currentWizardStep) dot.classList.add('completed');
        if (step === 5 && editingOfferIdStudnie && !orderEditMode) {
            dot.classList.add('disabled');
        }
        if (step === 3 && orderEditMode) {
            dot.classList.add('disabled');
        }
    });
    var line1 = document.getElementById('wizard-line-1');
    var line2 = document.getElementById('wizard-line-2');
    var line3 = document.getElementById('wizard-line-3');
    var line4 = document.getElementById('wizard-line-4');
    if (line1) line1.classList.toggle('completed', currentWizardStep > 1);
    if (line2) line2.classList.toggle('completed', currentWizardStep > 2);
    if (line3) line3.classList.toggle('completed', currentWizardStep > 3);
    if (line4) line4.classList.toggle('completed', currentWizardStep > 4);
}

function updateWizardSummaryBar() {
    var client =
        (document.getElementById('client-name') && document.getElementById('client-name').value) ||
        '';
    var offer =
        (document.getElementById('offer-number') &&
            document.getElementById('offer-number').value) ||
        '';
    var investName =
        (document.getElementById('invest-name') && document.getElementById('invest-name').value) ||
        '';
    var investAddress =
        (document.getElementById('invest-address') &&
            document.getElementById('invest-address').value) ||
        '';
    var wsbClient = document.getElementById('wsb-client');
    var wsbOffer = document.getElementById('wsb-offer');
    var wsbInvest = document.getElementById('wsb-invest');
    var wsbAddress = document.getElementById('wsb-address');
    var wsbParams = document.getElementById('wsb-params');
    if (wsbClient) wsbClient.textContent = client || '\u2014';
    if (wsbOffer) wsbOffer.textContent = offer || '\u2014';
    if (wsbInvest) wsbInvest.textContent = investName || '\u2014';
    if (wsbAddress) wsbAddress.textContent = investAddress || '\u2014';
    if (wsbParams) {
        var well = getCurrentWell();
        if (well) {
            var nadbudowa = well.nadbudowa === 'zelbetowa' ? '\u017belbet' : 'Beton';
            var denMat = well.dennicaMaterial === 'zelbetowa' ? '\u017belbet' : 'Beton';
            var wklArr = [];
            if (well.wkladkaDennica && well.wkladkaDennica !== 'brak')
                wklArr.push('D:' + well.wkladkaDennica);
            if (well.wkladkaNadbudowa && well.wkladkaNadbudowa !== 'brak')
                wklArr.push('N:' + well.wkladkaNadbudowa);
            if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak')
                wklArr.push('Z:' + well.wkladkaZwienczenie);
            var wkl = wklArr.length > 0 ? ' | PEHD [' + wklArr.join(', ') + ']' : '';
            wsbParams.textContent = 'Nadb: ' + nadbudowa + ' | Den: ' + denMat + wkl;
        } else {
            wsbParams.textContent = '\u2014';
        }
    }
}

function skipWizardToStep3() {
    wizardConfirmedParams = new Set(WIZARD_REQUIRED_PARAMS);
    goToWizardStep(3);
}
