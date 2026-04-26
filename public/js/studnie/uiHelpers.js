/* ===== KREATOR ===== */
function goToWizardStep(step) {
    currentWizardStep = step;
    document.querySelectorAll('.wizard-step').forEach((s) => s.classList.remove('active'));
    const target = document.getElementById('wizard-step-' + step);
    if (target) target.classList.add('active');
    updateWizardIndicator();
    if (step === 3) updateWizardSummaryBar();
    if (step === 2) validateWizardStep2();

    const layout = document.querySelector('.well-app-layout');
    if (layout) {
        if (step === 1 || step === 2) {
            layout.classList.add('intro-mode');
        } else {
            layout.classList.remove('intro-mode');
        }
    }
}

function wizardNext() {
    wizardNavStep(currentWizardStep + 1);
}

function wizardPrev() {
    wizardNavStep(currentWizardStep - 1);
}

function wizardNavStep(targetStep) {
    if (targetStep === currentWizardStep || targetStep < 1 || targetStep > 3) return;

    // Pozwól na dowolną nawigację wstecz
    if (targetStep < currentWizardStep) {
        goToWizardStep(targetStep);
        return;
    }

    // Nawigacja w przód
    if (targetStep === 2) {
        goToWizardStep(2);
    } else if (targetStep === 3) {
        // Zawsze waliduj przed zezwoleniem na nawigację do kroku 3
        if (!validateWizardStep2()) {
            showToast(
                'Wybierz opcję w każdej grupie parametrów przed przejściem do konfiguracji',
                'error'
            );
            // Jeśli użytkownik próbował przeskoczyć z kroku 1 bezpośrednio do 3, zabierz go zamiast tego do kroku 2
            if (currentWizardStep === 1) goToWizardStep(2);
            return;
        }
        goToWizardStep(3);
    }
}

function getActiveTileValue(paramName) {
    const group = document.querySelector(`.param-group[data-param="${paramName}"]`);
    if (!group) return 'brak';
    const active = group.querySelector('.param-tile.active');
    return active ? active.getAttribute('data-val') : 'brak';
}

function validateWizardStep2() {
    const allConfirmed = WIZARD_REQUIRED_PARAMS.every((p) => wizardConfirmedParams.has(p));

    // Odczytaj wartości malowania z kafelków DOM (działa nawet bez studni)
    const malowanieWVal = getActiveTileValue('malowanieW');
    const malowanieZVal = getActiveTileValue('malowanieZ');

    let powlokaWValid = true;
    let malCenaWValid = true;
    if (malowanieWVal !== 'brak') {
        const pwW = document.getElementById('powloka-name-w');
        powlokaWValid = !!(pwW && pwW.value.trim() !== '');
        const mcW = document.getElementById('malowanie-wew-cena');
        malCenaWValid = !!(mcW && mcW.value.trim() !== '' && !isNaN(parseFloat(mcW.value)));
    }

    let powlokaZValid = true;
    let malCenaZValid = true;
    if (malowanieZVal !== 'brak') {
        const pwZ = document.getElementById('powloka-name-z');
        powlokaZValid = !!(pwZ && pwZ.value.trim() !== '');
        const mcZ = document.getElementById('malowanie-zew-cena');
        malCenaZValid = !!(mcZ && mcZ.value.trim() !== '' && !isNaN(parseFloat(mcZ.value)));
    }

    // Pokaż/ukryj pola nazwy powłoki na podstawie aktualnego wyboru kafelka
    const powlokaWGroup = document.getElementById('powloka-name-w-group');
    if (powlokaWGroup) powlokaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';
    const malCenaWGroup = document.getElementById('malowanie-wew-cena-group');
    if (malCenaWGroup) malCenaWGroup.style.display = malowanieWVal !== 'brak' ? 'block' : 'none';

    const powlokaZGroup = document.getElementById('powloka-name-z-group');
    if (powlokaZGroup) powlokaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';
    const malCenaZGroup = document.getElementById('malowanie-zew-cena-group');
    if (malCenaZGroup) malCenaZGroup.style.display = malowanieZVal !== 'brak' ? 'block' : 'none';

    // Wyczyść ukryte pola
    if (malowanieWVal === 'brak') {
        const pwWInput = document.getElementById('powloka-name-w');
        if (pwWInput) pwWInput.value = '';
        const mcWInput = document.getElementById('malowanie-wew-cena');
        if (mcWInput) mcWInput.value = '';
    }
    if (malowanieZVal === 'brak') {
        const pwZInput = document.getElementById('powloka-name-z');
        if (pwZInput) pwZInput.value = '';
        const mcZInput = document.getElementById('malowanie-zew-cena');
        if (mcZInput) mcZInput.value = '';
    }

    const isFullyValid =
        allConfirmed && powlokaWValid && powlokaZValid && malCenaWValid && malCenaZValid;

    const nextBtn = document.getElementById('wizard-next-step2');
    if (nextBtn) nextBtn.disabled = !isFullyValid;

    // Zaktualizuj stan wizualny owijki każdej grupy parametrów
    let iconsChanged = false;
    document.querySelectorAll('.wizard-param-group').forEach((wrapper) => {
        const param = wrapper.dataset.wizardParam;
        if (!param) return;
        const confirmed = wizardConfirmedParams.has(param);
        const wasConfirmed = wrapper.classList.contains('confirmed');

        // Przełącz klasy tylko gdy stan się zmienił
        if (confirmed !== wasConfirmed) {
            wrapper.classList.toggle('confirmed', confirmed);
            wrapper.classList.toggle('needs-selection', !confirmed);
            const icon = wrapper.querySelector('.status-icon');
            if (icon) {
                icon.innerHTML = confirmed
                    ? '<i data-lucide="check-circle-2"></i>'
                    : '<i data-lucide="alert-triangle"></i>';
                iconsChanged = true;
            }
        }
    });

    // Przerenderuj ikony Lucide tylko gdy faktycznie zmieniono HTML
    if (iconsChanged && window.lucide) {
        window.lucide.createIcons();
    }

    const msg = document.getElementById('wizard-validation-msg');
    if (msg) msg.classList.toggle('hidden', isFullyValid);

    return isFullyValid;
}

function updateWizardIndicator() {
    const dots = document.querySelectorAll('.wizard-step-dot');
    dots.forEach((dot) => {
        const step = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        if (step === currentWizardStep) dot.classList.add('active');
        else if (step < currentWizardStep) dot.classList.add('completed');
    });
    const line1 = document.getElementById('wizard-line-1');
    const line2 = document.getElementById('wizard-line-2');
    if (line1) line1.classList.toggle('completed', currentWizardStep > 1);
    if (line2) line2.classList.toggle('completed', currentWizardStep > 2);
}

function updateWizardSummaryBar() {
    const client = document.getElementById('client-name')?.value || '';
    const offer = document.getElementById('offer-number')?.value || '';
    const investName = document.getElementById('invest-name')?.value || '';
    const investAddress = document.getElementById('invest-address')?.value || '';

    const wsbClient = document.getElementById('wsb-client');
    const wsbOffer = document.getElementById('wsb-offer');
    const wsbInvest = document.getElementById('wsb-invest');
    const wsbAddress = document.getElementById('wsb-address');
    const wsbParams = document.getElementById('wsb-params');

    if (wsbClient) wsbClient.textContent = client || '—';
    if (wsbOffer) wsbOffer.textContent = offer || '—';
    if (wsbInvest) wsbInvest.textContent = investName || '—';
    if (wsbAddress) wsbAddress.textContent = investAddress || '—';

    if (wsbParams) {
        const well = getCurrentWell();
        if (well) {
            const nadbudowa = well.nadbudowa === 'zelbetowa' ? 'Żelbet' : 'Beton';
            const denMat = well.dennicaMaterial === 'zelbetowa' ? 'Żelbet' : 'Beton';
            const wkl = well.wkladka === 'brak' ? '' : ` | PEHD ${well.wkladka}`;
            wsbParams.textContent = `Nadb: ${nadbudowa} | Den: ${denMat}${wkl}`;
        } else {
            wsbParams.textContent = '—';
        }
    }
}

function skipWizardToStep3() {
    wizardConfirmedParams = new Set(WIZARD_REQUIRED_PARAMS);
    goToWizardStep(3);
}

/* ===== PRZECHOWYWANIE (REST API) ===== */

/**
 * Lazy-loading danych domyślnych studni z pliku JSON.
 * Zastępuje globalną stałą DEFAULT_PRODUCTS_STUDNIE z pricelist_studnie.js.
 * Cache'uje dane po pierwszym załadowaniu.
 */
let _defaultProductsStudnieCache = null;

async function getDefaultProductsStudnie() {
    // 1. Sprawdź cache
    if (_defaultProductsStudnieCache) {
        return _defaultProductsStudnieCache;
    }
    // 2. Załaduj z JSON
    try {
        const res = await fetch('/data/products_studnie.json');
        if (res.ok) {
            _defaultProductsStudnieCache = await res.json();
            console.log(`[Studnie] Załadowano ${_defaultProductsStudnieCache.length} domyślnych produktów z JSON`);
            return _defaultProductsStudnieCache;
        }
    } catch (e) {
        console.warn('[Studnie] Nie udało się załadować products_studnie.json:', e);
    }
    // 3. Fallback — stara globalna zmienna (kompatybilność wsteczna)
    if (typeof DEFAULT_PRODUCTS_STUDNIE !== 'undefined') {
        _defaultProductsStudnieCache = DEFAULT_PRODUCTS_STUDNIE;
        return _defaultProductsStudnieCache;
    }
    console.error('[Studnie] Brak danych domyślnych produktów!');
    return [];
}

async function loadStudnieProducts() {
    const defaultProducts = await getDefaultProductsStudnie();

    function migrateProducts(arr) {
        arr.forEach((p) => {
            if (p.formaStandardowa == null) p.formaStandardowa = 1;
            if (p.formaStandardowaKLB == null) p.formaStandardowaKLB = 1;

            // Napraw uszkodzone kategorie z poprzedniego błędu backendu
            if (p.category === 'studnie' || !p.category) {
                const def = defaultProducts.find((dp) => dp.id === p.id);
                if (def) p.category = def.category;
            }

            // Napraw uszczelki DN2500, które zostały błędnie zapisane z dn=2000
            if (p.componentType === 'uszczelka' && p.id && p.id.includes('2500') && p.dn === 2000) {
                p.dn = 2500;
            }

            // Napraw brakujące pola magazynu (produkty dodane ręcznie)
            if (p.magazynKLB === undefined || p.magazynKLB === null) p.magazynKLB = 1;
            if (p.magazynWL === undefined || p.magazynWL === null) p.magazynWL = 1;

            // Napraw brakujący componentType na podstawie nazwy
            if (!p.componentType || (p.componentType === 'krag' && !p.id?.startsWith('KD'))) {
                const n = (p.name || '').toUpperCase();
                if (n.includes('REDUKCYJNA')) p.componentType = 'plyta_redukcyjna';
                else if (n.includes('DENNICA')) p.componentType = 'dennica';
                else if (n.includes('KONUS') || n.includes('STOŻEK')) p.componentType = 'konus';
                else if (n.includes('PŁYTA DIN') || n.includes('NAKRYW')) p.componentType = 'plyta_din';
                else if (n.includes('NAJAZDOWA')) p.componentType = 'plyta_najazdowa';
                else if (n.includes('ZAMYKAJĄCA')) p.componentType = 'plyta_zamykajaca';
                else if (n.includes('ODCIĄŻAJĄCY')) p.componentType = 'pierscien_odciazajacy';
                else if (n.includes('USZCZELKA')) p.componentType = 'uszczelka';
                else if (n.includes('WŁAZ')) p.componentType = 'wlaz';
                else if (n.includes('AVR') || n.includes('PIERŚCIEŃ AVR')) p.componentType = 'avr';
            }

            // Napraw brakujące DN na podstawie nazwy/kategorii
            if (p.dn === null || p.dn === undefined) {
                const searchStr = ((p.category || '') + ' ' + (p.name || '')).toUpperCase();
                const dnMatch = searchStr.match(/DN(\d+)/i);
                if (dnMatch) p.dn = parseInt(dnMatch[1]);
            }
        });
        return arr;
    }
    try {
        const res = await fetch('/api/products-studnie');
        const json = await res.json();
        let saved = json.data;
        if (!saved || saved.length === 0) {
            const data = JSON.parse(JSON.stringify(defaultProducts));
            migrateProducts(data);
            await fetch('/api/products-studnie', {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({ data })
            });
            return data;
        }
        // Wykryj błąd uszczelek DN2500 przed naprawą przez migrację
        const hadDn2500Bug = saved.some(
            (p) => p.componentType === 'uszczelka' && p.id && p.id.includes('2500') && p.dn === 2000
        );
        const migrated = migrateProducts(saved);
        // Utrwal poprawki migracji z powrotem do API
        if (hadDn2500Bug) {
            saveStudnieProducts(migrated).catch(() => {});
        }
        return migrated;
    } catch {
        const data = JSON.parse(JSON.stringify(defaultProducts));
        return migrateProducts(data);
    }
}

function renamePłyty(p) {
    // Funkcja wyłączona - pozwala użytkownikowi na swobodne nazywanie Płyt
}

async function saveStudnieProducts(data) {
    try {
        const res = await fetch('/api/products-studnie', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error('saveStudnieProducts: serwer zwrócił błąd', res.status, err);
            showToast('Błąd zapisu cennika studni: ' + (err.error || res.status), 'error');
            return false;
        }
        return true;
    } catch (err) {
        console.error('saveStudnieProducts: błąd sieci', err);
        showToast('Błąd sieci przy zapisie cennika studni', 'error');
        return false;
    }
}

/* ===== SPRAWDZANIE STATUSU BACKENDU ===== */
async function checkBackendStatus() {
    const indicators = [
        document.querySelector('#backend-status-indicator span'),
        window.parent !== window && window.parent.document
            ? window.parent.document.querySelector('#backend-status-indicator span')
            : null
    ];
    try {
        const response = await fetch(`http://${window.location.hostname}:8000/api/v1/sync/pull`, {
            method: 'GET'
        });
        if (response.ok) {
            isBackendOnline = true;
            indicators.forEach((indicator) => {
                if (indicator) {
                    indicator.style.background = '#4ade80'; // jasny zielony
                    indicator.style.boxShadow = '0 0 8px #4ade80';
                    indicator.parentElement.title = 'Serwer OR-Tools połączony';
                }
            });
        } else {
            throw new Error('Backend response not ok');
        }
    } catch (e) {
        isBackendOnline = false;
        indicators.forEach((indicator) => {
            if (indicator) {
                indicator.style.background = '#f87171'; // czerwony
                indicator.style.boxShadow = '0 0 8px #f87171';
                indicator.parentElement.title = 'Serwer obliczeniowy OFFLINE (działa tryb JS)';
            }
        });
    }
}
checkBackendStatus(); // Sprawdź natychmiast po załadowaniu
setInterval(checkBackendStatus, 15000); // Sprawdź co 15 sekund

// DOMContentLoaded
