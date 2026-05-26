/* ===== KREATOR ===== */
function goToWizardStep(step) {
    if (step <= 3 && typeof orderEditMode !== 'undefined' && orderEditMode) {
        // Jeśli wracamy do kroku 1, 2 lub 3 z kroku 5, musimy wyjść z trybu zamówienia
        // Przekazujemy krok docelowy, aby po załadowaniu poprawnie go ustawić
        exitWizardOrderMode(step);
        return; // exitWizardOrderMode wywoła goToWizardStep ponownie
    }

    if (typeof startStudnieViewTransition === 'function') {
        startStudnieViewTransition();
    }

    currentWizardStep = step;
    document.querySelectorAll('.wizard-step').forEach((s) => s.classList.remove('active'));
    updateWizardIndicator();

    const layout = document.querySelector('.well-app-layout');
    if (layout) {
        if (step === 1 || step === 2 || step === 4) {
            layout.classList.add('intro-mode');
        } else {
            layout.classList.remove('intro-mode');
        }
    }

    if (step === 4) {
        // Krok 4.1 (Karta budowy) — własny panel w builderze
        const builderSection = document.getElementById('section-builder');
        if (builderSection && !builderSection.classList.contains('active')) {
            showSection('builder');
        }
        const target = document.getElementById('wizard-step-4');
        if (target) target.classList.add('active');
        
        // Załaduj dane tylko jeśli jesteśmy w trybie edycji zamówienia 
        // (przy nowym zamówieniu funkcja jest już wywoływana z parametrem w orderManager.js)
        if (typeof orderEditMode !== 'undefined' && orderEditMode && typeof initKartaBudowyStep4 === 'function') {
            initKartaBudowyStep4();
        }
        
        return;
    }

    if (step === 5) {
        // Krok 4.2 (Zamówienie) — wejdź w tryb edycji zamówienia w builderze
        enterWizardOrderMode();
        return;
    }

    // Dla kroków 1-3 upewnij się, że jesteśmy w sekcji builder
    const builderSection = document.getElementById('section-builder');
    if (builderSection && !builderSection.classList.contains('active')) {
        showSection('builder');
    }

    const target = document.getElementById('wizard-step-' + step);
    if (target) target.classList.add('active');
    
    if (step === 3) updateWizardSummaryBar();
    if (step === 2) validateWizardStep2();
}

/**
 * Wejście w tryb zamówienia z poziomu kreatora (krok 4).
 * Szuka zamówienia powiązanego z bieżącą ofertą i ładuje je do edycji.
 */
function enterWizardOrderMode() {
    // Jeśli już jesteśmy w trybie zamówienia — zostań w builderze
    if (typeof orderEditMode !== 'undefined' && orderEditMode) {
        const builderSection = document.getElementById('section-builder');
        if (builderSection && !builderSection.classList.contains('active')) {
            showSection('builder');
        }
        // Aktywuj wizard-step-3 (builder) bo krok 4.2 nie ma własnego panelu
        const target = document.getElementById('wizard-step-3');
        if (target) target.classList.add('active');
        return;
    }

    // Znajdź zamówienie dla bieżącej oferty
    if (!editingOfferIdStudnie) {
        showToast('Najpierw zapisz ofertę, aby móc przejść do zamówienia', 'error');
        currentWizardStep = 3;
        updateWizardIndicator();
        return;
    }

    const oId = typeof normalizeId === 'function' ? normalizeId(editingOfferIdStudnie) : editingOfferIdStudnie;
    const order = (typeof ordersStudnie !== 'undefined' && ordersStudnie)
        ? ordersStudnie.find((o) => normalizeId(o.offerId) === oId)
        : null;

    if (order) {
        // Wczytaj zamówienie do edycji
        if (typeof enterOrderEditMode === 'function') {
            enterOrderEditMode(order.id);
        }
    } else {
        showToast('Brak zamówienia dla tej oferty. Utwórz zamówienie z poziomu podsumowania oferty.', 'info');
        currentWizardStep = 3;
        updateWizardIndicator();
    }
}

/**
 * Wyjście z trybu zamówienia i powrót do trybu oferty.
 */
async function exitWizardOrderMode(targetStep = 3) {
    orderEditMode = null;
    if (typeof renderOrderModeBanner === 'function') renderOrderModeBanner();
    
    if (typeof editingOfferIdStudnie !== 'undefined' && editingOfferIdStudnie) {
        if (typeof loadSavedOfferStudnie === 'function') {
            await loadSavedOfferStudnie(editingOfferIdStudnie, null, 'builder', true);
        }
    }
    
    if (typeof refreshAll === 'function') refreshAll();
    
    // Teraz po załadowaniu przejdź do docelowego kroku
    if (targetStep) {
        goToWizardStep(targetStep);
    }
    
    showToast('<i data-lucide="bar-chart-2"></i> Powrót do edycji oferty', 'info');
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
                'Wybierz opcję w każdej grupie parametrów przed przejściem do oferty',
                'error'
            );
            // Jeśli użytkownik próbował przeskoczyć z kroku 1 bezpośrednio do 3, zabierz go zamiast tego do kroku 2
            if (currentWizardStep === 1) goToWizardStep(2);
            return;
        }
        goToWizardStep(3);
    } else if (targetStep === 4) {
        // Krok 4.1 — Karta budowy
        goToWizardStep(4);
    } else if (targetStep === 5) {
        // Krok 4.2 — Zamówienie (przełącza na widok podsumowania oferty/zamówienia)
        goToWizardStep(5);
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
    const line3 = document.getElementById('wizard-line-3');
    const line4 = document.getElementById('wizard-line-4');
    if (line1) line1.classList.toggle('completed', currentWizardStep > 1);
    if (line2) line2.classList.toggle('completed', currentWizardStep > 2);
    if (line3) line3.classList.toggle('completed', currentWizardStep > 3);
    if (line4) line4.classList.toggle('completed', currentWizardStep > 4);
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
            let wklArr = [];
            if (well.wkladkaDennica && well.wkladkaDennica !== 'brak') wklArr.push(`D:${well.wkladkaDennica}`);
            if (well.wkladkaNadbudowa && well.wkladkaNadbudowa !== 'brak') wklArr.push(`N:${well.wkladkaNadbudowa}`);
            if (well.wkladkaZwienczenie && well.wkladkaZwienczenie !== 'brak') wklArr.push(`Z:${well.wkladkaZwienczenie}`);
            const wkl = wklArr.length > 0 ? ` | PEHD [${wklArr.join(', ')}]` : '';
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
        const res = await fetchWithTimeout('/data/products_studnie.json', {}, 5000);
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
            // Mapuj polskie klucze z pliku JSON na angielskie używane w kodzie
            const KEY_MAP = {
                'Zapas dół mm': 'zapasDol',
                'Zapas góra mm': 'zapasGora',
                'Zapas dół min mm': 'zapasDolMin',
                'Zapas góra min mm': 'zapasGoraMin',
            };
            for (const [plKey, enKey] of Object.entries(KEY_MAP)) {
                if (p[plKey] !== undefined) {
                    p[enKey] = p[plKey];
                    delete p[plKey];
                }
            }

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
        const res = await fetchWithTimeout('/api/products-studnie');
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
        const response = await fetchWithTimeout(`http://${window.location.hostname}:8000/api/v1/health`, {
            method: 'GET'
        }, 5000);
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
                indicator.style.background = 'var(--danger-hover)'; // czerwony
                indicator.style.boxShadow = '0 0 8px var(--danger-hover)';
                indicator.parentElement.title = 'Serwer obliczeniowy OFFLINE (działa tryb JS)';
            }
        });
    }
}
setInterval(checkBackendStatus, 15000); // Sprawdź co 15 sekund (pierwsze sprawdzenie w DOMContentLoaded w app_studnie.js)

/* ===== CENNIK PRECO — load / save / defaults ===== */

/**
 * Zwraca domyślny cennik PRECO (hardcoded z Excela).
 * Struktura: { [dnStudni]: { kinety, spadekKineta, spadekMufa, uniesienie, redukcja, skrzynkaWlazowa } }
 */
function getDefaultPrecoPricing() {
    // Grupy DN rury do wyszukiwania w tabelach zakresowych
    // Wspólna tabela kinet (cena prosta + dopływ) — per DN studni
    const kinetyDn = {
        1000: [
            { dn: 150, prosta: 920, dodWlot: 300 },
            { dn: 200, prosta: 1100, dodWlot: 350 },
            { dn: 250, prosta: 1350, dodWlot: 400 },
            { dn: 300, prosta: 1750, dodWlot: 500 },
            { dn: 400, prosta: 2500, dodWlot: 700 },
            { dn: 500, prosta: 4000, dodWlot: 1000 },
            { dn: 600, prosta: 5200, dodWlot: 1300 }
        ],
        1200: [
            { dn: 150, prosta: 1050, dodWlot: 350 },
            { dn: 200, prosta: 1250, dodWlot: 400 },
            { dn: 250, prosta: 1550, dodWlot: 450 },
            { dn: 300, prosta: 2000, dodWlot: 550 },
            { dn: 400, prosta: 2900, dodWlot: 800 },
            { dn: 500, prosta: 4500, dodWlot: 1100 },
            { dn: 600, prosta: 5800, dodWlot: 1400 }
        ],
        1500: [
            { dn: 150, prosta: 1250, dodWlot: 400 },
            { dn: 200, prosta: 1500, dodWlot: 450 },
            { dn: 250, prosta: 1800, dodWlot: 550 },
            { dn: 300, prosta: 2400, dodWlot: 650 },
            { dn: 400, prosta: 3500, dodWlot: 950 },
            { dn: 500, prosta: 5200, dodWlot: 1300 },
            { dn: 600, prosta: 6800, dodWlot: 1700 }
        ],
        2000: [
            { dn: 150, prosta: 1700, dodWlot: 550 },
            { dn: 200, prosta: 2000, dodWlot: 600 },
            { dn: 250, prosta: 2400, dodWlot: 700 },
            { dn: 300, prosta: 3100, dodWlot: 850 },
            { dn: 400, prosta: 4500, dodWlot: 1200 },
            { dn: 500, prosta: 6500, dodWlot: 1600 },
            { dn: 600, prosta: 8500, dodWlot: 2100 }
        ],
        2500: [
            { dn: 150, prosta: 2200, dodWlot: 700 },
            { dn: 200, prosta: 2600, dodWlot: 800 },
            { dn: 250, prosta: 3100, dodWlot: 900 },
            { dn: 300, prosta: 4000, dodWlot: 1100 },
            { dn: 400, prosta: 5800, dodWlot: 1500 },
            { dn: 500, prosta: 8500, dodWlot: 2100 },
            { dn: 600, prosta: 11000, dodWlot: 2700 }
        ]
    };

    // Spadek w kinecie — zakresy procentowe → dopłata per grupa DN rury
    const spadekKineta = [
        { min: 2, max: 4, grupy: { '150-200': 200, '250-300': 250, '400-600': 350 } },
        { min: 5, max: 7, grupy: { '150-200': 300, '250-300': 380, '400-600': 500 } },
        { min: 8, max: 10, grupy: { '150-200': 460, '250-300': 550, '400-600': 700 } }
    ];

    // Spadek w mufie — takie same zakresy
    const spadekMufa = [
        { min: 2, max: 4, grupy: { '150-200': 150, '250-300': 200, '400-600': 300 } },
        { min: 5, max: 7, grupy: { '150-200': 250, '250-300': 320, '400-600': 450 } },
        { min: 8, max: 10, grupy: { '150-200': 380, '250-300': 460, '400-600': 600 } }
    ];

    // Uniesienie kinety — zakresy mm → dopłata per grupa DN rury głównej
    const uniesienie = [
        { min: 0, max: 100, grupy: { '150-300': 150, '400-600': 200 } },
        { min: 101, max: 200, grupy: { '150-300': 250, '400-600': 350 } },
        { min: 201, max: 400, grupy: { '150-300': 400, '400-600': 550 } },
        { min: 401, max: 600, grupy: { '150-300': 550, '400-600': 750 } }
    ];

    // Redukcja kinety — zakresy mm → dopłata per grupa DN
    const redukcja = [
        { min: 0, max: 50, grupy: { '150-300': 340, '400-600': 500 } },
        { min: 51, max: 100, grupy: { '150-300': 500, '400-600': 700 } }
    ];

    // Skrzynka włazowa — cena per DN studni (null = brak)
    const skrzynkaWlazowa = {
        1000: 400,
        1200: 450,
        1500: 500,
        2000: 600,
        2500: 750
    };

    // Cena za 1 mb wkładki do pełnej wysokości per DN studni
    const cenaPelnaWysMB = {
        1000: 1000,
        1200: 1200,
        1500: 1500,
        2000: 2000,
        2500: 2500
    };

    // Cena za samo dno osadnika per DN studni
    const cenaDnoOsadnika = {
        1000: 800,
        1200: 1000,
        1500: 1400,
        2000: 2000,
        2500: 2800
    };

    const result = {};
    [1000, 1200, 1500, 2000, 2500].forEach(dn => {
        result[dn] = {
            kinety: kinetyDn[dn] || [],
            spadekKineta,
            spadekMufa,
            uniesienie,
            redukcja,
            skrzynkaWlazowa: skrzynkaWlazowa[dn] || null,
            cenaPelnaWysMB: cenaPelnaWysMB[dn] || 0,
            cenaDnoOsadnika: cenaDnoOsadnika[dn] || 0
        };
    });
    return result;
}

/**
 * Ładuje cennik PRECO z backendu, z fallbackiem do domyślnych wartości.
 */
async function loadPrecoPricing() {
    try {
        const res = await fetchWithTimeout('/api/preco-pricing');
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
            precoPricing = json.data[0];
            console.log('[PRECO] Załadowano cennik z bazy');
            return;
        }
    } catch (e) {
        console.warn('[PRECO] Błąd pobierania cennika z API:', e);
    }
    precoPricing = getDefaultPrecoPricing();
    console.log('[PRECO] Użyto domyślnego cennika');
}

/**
 * Zapisuje cennik PRECO do backendu.
 */
async function savePrecoPricing(data) {
    try {
        const res = await fetch('/api/preco-pricing', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ data })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error('[PRECO] Błąd zapisu:', res.status, err);
            showToast('Błąd zapisu cennika PRECO: ' + (err.error || res.status), 'error');
            return false;
        }
        showToast('Cennik PRECO zapisany', 'success');
        return true;
    } catch (err) {
        console.error('[PRECO] Błąd sieci:', err);
        showToast('Błąd sieci przy zapisie cennika PRECO', 'error');
        return false;
    }
}

// DOMContentLoaded
