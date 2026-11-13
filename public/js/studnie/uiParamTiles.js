// @ts-check
/* ===== UI: PARAMETRY OGÓLNE (KAFELKI) KROKU 2 KREATORA ===== */
/* Wyodrebnione z wellUI.js - fazy refaktoryzacji */

function setupParamTiles() {
    const wizardRoot = document.getElementById('wizard-step-2');
    if (!wizardRoot) return;
    const getParamValue = (paramName) =>
        wizardRoot.querySelector(`.param-group[data-param="${paramName}"] .param-tile.active`)
            ?.dataset.val;
    const activateParamValue = (paramName, value) => {
        const tile = wizardRoot.querySelector(
            `.param-group[data-param="${paramName}"] .param-tile[data-val="${value}"]`
        );
        if (tile && !tile.classList.contains('active')) tile.click();
    };
    const setParamValue = (paramName, value) => {
        wizardRoot
            .querySelectorAll(`.param-group[data-param="${paramName}"] .param-tile`)
            .forEach((tile) => tile.classList.toggle('active', tile.dataset.val === value));
    };

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

                    if (val === 'brak') {
                        activateParamValue('spocznikH', 'brak');
                    } else if (getParamValue('spocznikH') === 'brak') {
                        activateParamValue('spocznikH', '1/2');
                    }

                    // PRECO / PrecoTop / UnoLith → wymuszenie spocznikH = '1/1'
                    if (val === 'preco' || val === 'precotop' || val === 'unolith') {
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

                if (paramName === 'spocznik') {
                    if (val === 'brak') {
                        activateParamValue('kineta', 'brak');
                        activateParamValue('spocznikH', 'brak');
                    } else if (getParamValue('kineta') === 'brak') {
                        activateParamValue('spocznik', 'brak');
                        activateParamValue('spocznikH', 'brak');
                    }
                }

                if (paramName === 'spocznikH') {
                    if (val === 'brak') {
                        activateParamValue('kineta', 'brak');
                        activateParamValue('spocznik', 'brak');
                    } else if (['preco', 'precotop', 'unolith'].includes(getParamValue('kineta'))) {
                        activateParamValue('spocznikH', '1/1');
                    } else if (
                        getParamValue('kineta') === 'brak' ||
                        getParamValue('spocznik') === 'brak'
                    ) {
                        activateParamValue('spocznikH', 'brak');
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

    if (
        getParamValue('kineta') === 'brak' ||
        getParamValue('spocznik') === 'brak' ||
        getParamValue('spocznikH') === 'brak'
    ) {
        setParamValue('kineta', 'brak');
        setParamValue('spocznik', 'brak');
        setParamValue('spocznikH', 'brak');
    } else if (['preco', 'precotop', 'unolith'].includes(getParamValue('kineta'))) {
        setParamValue('spocznikH', '1/1');
    }
}

function updateParamTilesUI() {
    // Kafelki w kroku 2 zachowuja wlasny stan. Nie synchronizujemy ich z aktualnie
    // edytowana studnia, zeby zmiana jednej studni nie zmieniala parametrow ogolnych.

    // Pokaż/ukryj pola nazw powłok w zależności od bieżącego stanu kafelków (działa ze studnią lub bez niej)
    const malowanieWVal = getActiveTileValue('malowanieW');
    const malowanieZVal = getActiveTileValue('malowanieZ');
    const kinetaVal = getActiveTileValue('kineta');

    // 'flex' (nie 'block') — patrz komentarz w uiHelpers.js (validateWizardStep2).
    const powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'flex' : 'none';
    const powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'flex' : 'none';

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

window.setupParamTiles = setupParamTiles;
