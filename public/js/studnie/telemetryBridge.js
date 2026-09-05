// @ts-check
/* =============================================================
   telemetryBridge.js — pasywny hook telemetry dla JS solvera.

   Ten moduł NIE zmienia logiki solvera. Jest wywoływany opcjonalnie
   z wellSolver.js / ringOptimizer.js / ruleEngine.js w punktach
   gdzie podejmowana jest decyzja o doborze.

   Solver JS pozostaje jedynym źródłem prawdy — telemetry jedynie
   OBCSERWUJE i wysyła dane do Node backend (/api/telemetry/ai/config).

   Jeśli endpoint nie odpowiada, ignorujemy — to pasywny obserwator.
   ============================================================= */

(function () {
    'use strict';

    const TELEMETRY_URL = '/api/telemetry/ai/config';
    const EVENT_URL = '/api/telemetry/ai/event';
    const VERSION_URL = '/api/telemetry/ai/version';
    const ACCEPTANCE_FULL_URL = '/api/telemetry/ai/acceptance-full';
    const TIMEOUT_MS = 1500; // krótki, żeby nie blokować UI when offline

    /* ===== WERSJE ===== */
    const SOLVER_VERSION = '1.0.0'; // src/version.ts
    const RULES_VERSION = '2026-06-30.1'; // data reguł doboru

    /* ===== STAN WEWNETRZNY ===== */
    let sequenceNo = 0;

    // Circuit breaker: przy padzie backendu kazdy auto-dobor/zapis strzelal
    // fetchem per studnia bez backoff -> wyczerpanie socketow przegladarki
    // (net::ERR_INSUFFICIENT_RESOURCES) i tysiace console.warn. Po 3 failach
    // z rzedu pauza 30 s (early-return), reset przy pierwszej odpowiedzi.
    let telemetryFailCount = 0;
    let telemetryCircuitUntil = 0;
    const TELEMETRY_CIRCUIT_THRESHOLD = 3;
    const TELEMETRY_CIRCUIT_COOLDOWN_MS = 30000;

    // Deduplikacja AUTO_JS w pamięci: wellId -> hash treści ostatnio wysłanego configa.
    // Pomijamy powtórki identycznej treści z tego samego źródła (re-render bez zmiany
    // wejść), bo duplikaty zawyżają hitCount/confidence wzorców i mnożą próbki treningowe.
    // Świadomie ograniczone do sesji — po reload strony historia znika (Opcja A, Etap 1).
    const autoJsDedupMap = new Map();

    /**
     * Stabilny fingerprint treści studni — tylko pola, które wpływają na dobór
     * elementów. Metadane (czas, liczba iteracji) są pomijane, by powtórka
     * tego samego doboru nie tworzyła nowego rekordu.
     * @param {Object} well
     * @param {Array} configItems
     * @returns {string}
     */
    function wellContentFingerprint(well, configItems) {
        const configKey = (configItems || [])
            .map(function (c) {
                return (c.productId || '') + ':' + (c.quantity || 1);
            })
            .sort()
            .join('|');
        const przejsciaKey = (well.przejscia || [])
            .map(function (p) {
                return p.productId || '';
            })
            .sort()
            .join('|');
        return [
            well.dn,
            well.rzednaDna,
            well.rzednaWlazu,
            well.magazyn,
            well.psiaBuda ? '1' : '0',
            well.stycznaNadbudowa1200 ? '1' : '0',
            well.zakonczenie,
            well.redukcjaDN1000 ? '1' : '0',
            well.redukcjaTargetDN,
            well.wkladkaZwienczenie,
            well.kineta || '',
            well.dennicaMaterial || '',
            well.configSource || '',
            pricingFingerprint(well),
            przejsciaKey,
            configKey
        ].join('§');
    }

    /**
     * Fingerprint wyceny studni (cena + waga) — zmiana rabatu/cennika musi
     * przepuścić ponowną wysyłkę, bo totalPrice jest cechą treningową ML.
     * @param {Object} well
     * @returns {string}
     */
    function pricingFingerprint(well) {
        try {
            if (typeof window.calcWellStats === 'function') {
                const stats = window.calcWellStats(well);
                if (stats && typeof stats.price === 'number' && typeof stats.weight === 'number') {
                    return (
                        Math.round(stats.price * 100) / 100 +
                        ':' +
                        Math.round(stats.weight * 100) / 100
                    );
                }
            }
        } catch (_e) {
            // silent
        }
        return '';
    }

    /**
     * Buduje ORYGINALNY (auto-dobrany) config studni do pola originalConfig
     * w rekordzie telemetrii. Bez snapshotu lub bez różnicy względem bieżącego
     * configu zwraca undefined — wtedy caller używa finalnego configu.
     *
     * Snapshot ustawia solverAutoSelect.js (`well._lastAutoConfig`) PO pełnym
     * przeliczeniu auto-doboru. Korekta użytkownika (configSource MANUAL*)
     * powoduje rozjazd snapshot <> config → learning engine ma materiał na
     * wzorce substitution/addition/removal.
     *
     * @param {Object} well
     * @returns {Array<{productId:string, quantity:number}>|undefined}
     */
    function buildOriginalConfigFromWell(well) {
        if (!well || !well._lastAutoConfig) return undefined;
        try {
            /** Kompaktuje komponenty do porównywalnej postaci + sortuje —
             *  kolejność elementów (drag) nie jest korektą, tylko przetasowaniem. */
            /** @param {Array} items */
            const compact = function (items) {
                return (items || [])
                    .map(function (it) {
                        return { productId: it.productId, quantity: it.quantity };
                    })
                    .sort(function (a, b) {
                        if (a.productId === b.productId) return a.quantity - b.quantity;
                        return a.productId < b.productId ? -1 : 1;
                    });
            };
            const original = JSON.parse(well._lastAutoConfig);
            const origKey = JSON.stringify(compact(original));
            const finalKey = JSON.stringify(compact(well.config || []));
            if (origKey === finalKey) return undefined;
            return original;
        } catch (_e) {
            return undefined;
        }
    }

    /**
     * Sprawdza, czy identyczna treść AUTO_JS dla tej studni była już wysłana
     * w bieżącej sesji. Jeśli tak — zwraca false (pomiń), wpp zapamiętuje i zwraca true.
     * @param {Object} well
     * @param {Array} configItems
     * @returns {boolean}
     */
    function shouldSendAutoJs(well, configItems) {
        const key = well.id || well.name || 'well-anon';
        const fp = wellContentFingerprint(well, configItems);
        if (autoJsDedupMap.get(key) === fp) {
            return false;
        }
        autoJsDedupMap.set(key, fp);
        return true;
    }

    /* ===== KOLEJKA REGULACJI RUCHU (ASYNC CONCURRENCY QUEUE) ===== */
    // Zapobiega wyczerpaniu socketow przegladarki (ERR_INSUFFICIENT_RESOURCES)
    // oraz 429 Too Many Requests przy hurtowych wywolaniach (zapis duzych ofert).
    const MAX_CONCURRENT_TELEMETRY = 2;
    const MAX_TELEMETRY_QUEUE_SIZE = 50;
    let activeTelemetryRequests = 0;
    /** @type {Array<() => Promise<any>>} */
    const telemetryQueue = [];

    function processTelemetryQueue() {
        if (activeTelemetryRequests >= MAX_CONCURRENT_TELEMETRY || telemetryQueue.length === 0) {
            return;
        }
        if (
            typeof Date !== 'undefined' &&
            telemetryCircuitUntil > 0 &&
            Date.now() < telemetryCircuitUntil
        ) {
            telemetryQueue.length = 0;
            return;
        }
        const task = telemetryQueue.shift();
        if (!task) return;

        activeTelemetryRequests++;
        task().finally(function () {
            activeTelemetryRequests--;
            processTelemetryQueue();
        });
    }

    /**
     * Bezpieczny fetch z timeoutem. Nie rzuca wyjątków.
     */
    function safeFetchInternal(url, payload) {
        try {
            if (!window.fetch) return Promise.resolve();
            // Otwarty circuit -> cicho pomijaj, bez nowych socketow i logow.
            if (
                typeof Date !== 'undefined' &&
                telemetryCircuitUntil > 0 &&
                Date.now() < telemetryCircuitUntil
            ) {
                return Promise.resolve();
            }
            // Guard: telemetryBridge laduje sie przed shared/auth.js
            // (studnie.html) — gole authHeaders() rzucaloby ReferenceError.
            const authPart = typeof authHeaders === 'function' ? authHeaders() : {};
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
            return fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', ...authPart },
                body: JSON.stringify(payload),
                signal: controller.signal
            })
                .then(function (response) {
                    clearTimeout(timeoutId);
                    if (!response) return undefined;
                    if (response.status === 429) {
                        // Rate limit osiagniety — wstrzymaj telemetrie na 15s i wyczysc kolejke, aby zapobiec powtarzającym sie bledom 429 w konsoli
                        if (typeof Date !== 'undefined') {
                            telemetryCircuitUntil = Date.now() + 15000;
                        }
                        telemetryQueue.length = 0;
                        return undefined;
                    }
                    if (response.status >= 500) return undefined;
                    // Odpowiedz HTTP 2xx/3xx/4xx (inny niz 429) -> reset licznika circuita
                    telemetryFailCount = 0;
                    telemetryCircuitUntil = 0;
                    if (typeof response.json === 'function') {
                        return response.json().catch(function () {
                            return undefined;
                        });
                    }
                    return undefined;
                })
                .catch(function (err) {
                    telemetryFailCount++;
                    // Jeden log na otwarcie circuita, nie per fail — to console.warn
                    // generowalo tysiace wpisow przy padzie backendu.
                    if (telemetryFailCount >= TELEMETRY_CIRCUIT_THRESHOLD) {
                        telemetryFailCount = 0;
                        if (typeof Date !== 'undefined') {
                            telemetryCircuitUntil = Date.now() + TELEMETRY_CIRCUIT_COOLDOWN_MS;
                        }
                        if (
                            window.location.hostname === 'localhost' ||
                            window.location.hostname === '127.0.0.1'
                        ) {
                            console.warn('[telemetry] Backend unavailable — pauza 30 s:', err);
                        }
                    }
                });
        } catch (_e) {
            return Promise.resolve();
        }
    }

    function safeFetch(url, payload) {
        if (
            typeof Date !== 'undefined' &&
            telemetryCircuitUntil > 0 &&
            Date.now() < telemetryCircuitUntil
        ) {
            return Promise.resolve();
        }
        if (telemetryQueue.length >= MAX_TELEMETRY_QUEUE_SIZE) {
            telemetryQueue.shift();
        }
        return new Promise(function (resolve) {
            telemetryQueue.push(function () {
                return safeFetchInternal(url, payload).then(resolve, resolve);
            });
            processTelemetryQueue();
        });
    }

    /**
     * Normalizuje wewnętrzny configSource studni do dozwolonego enum
     * solverSource backendu (AUTO_JS | MANUAL | AI_SUGGEST).
     * Frontend używa też 'AUTO', 'AUTO_AI', 'MANUAL_SWAP' — mapujemy je,
     * żeby Zod na /ai/config nie odrzucał payloadu (400).
     */
    function normalizeSolverSource(src) {
        if (src === 'AI_SUGGEST' || src === 'AUTO_AI') return 'AI_SUGGEST';
        if (src === 'MANUAL' || src === 'MANUAL_SWAP' || src == null || src === '') return 'MANUAL';
        return 'AUTO_JS'; // 'AUTO', 'AUTO_JS', cokolwiek innego
    }

    /**
     * Oblicza wysokość w mm bezpiecznie — Math.round(NaN) dałby NaN,
     * a JSON.stringify zamienia NaN na null (Zod odrzuca null dla number).
     */
    function safeHeightMm(a, b) {
        if (a === undefined || a === null || b === undefined || b === null) return undefined;
        const fa = parseFloat(a);
        const fb = parseFloat(b);
        if (!Number.isFinite(fa) || !Number.isFinite(fb)) return undefined;
        return Math.round((fa - fb) * 1000);
    }

    /**
     * Buduje snapshot komponentu z pojedynczego wpisu konfiguracji.
     */
    function buildComponentSnapshot(item, studnieProducts) {
        if (!item || !item.productId) return null;
        const prod = studnieProducts.find(function (p) {
            return p.id === item.productId;
        });
        return {
            productId: item.productId,
            productName: prod ? prod.name : undefined,
            componentType: prod ? prod.componentType : undefined,
            dn: prod ? prod.dn : undefined,
            height: prod && prod.height ? parseFloat(prod.height) || undefined : undefined
        };
    }

    /**
     * Zapisuje pełną konfigurację wygenerowaną przez solver.
     * Wywoływane Z wellSolver.js PO wygenerowaniu configa
     * (ale PRZED zapisaniem do studni). Pasywnie — żaden wynik solvera
     * nie zależy od tej funkcji.
     *
     * Może być też wywołana z offerManager.js przy zapisie oferty
     * z solverSource: 'MANUAL' i wasAccepted: true.
     *
     * @param {Object} options
     * @param {Object} options.well - studnia (well object)
     * @param {Array} options.configItems - wybrane elementy studni (config)
     * @param {string} options.solverSource - 'AUTO_JS' | 'MANUAL'
     * @param {number} options.computationMs - czas obliczeń w ms
     * @param {number} options.iterationCount - liczba iteracji solvera
     * @param {number} options.checkedVariants - liczba sprawdzonych wariantów
     * @param {number} options.rankingScore - wynik scoringu (opcjonalnie)
     * @param {string} options.selectionReason - powód wyboru (opcjonalnie)
     * @param {boolean} [options.wasAccepted] - czy konfiguracja została zaakceptowana (default false)
     * @param {string} [options.overrideReason] - powód ręcznej zmiany (override)
     */
    window.telemetryRecordConfig = function (options) {
        if (!options || !options.well) return;
        const well = options.well;
        const configItems = options.configItems || [];

        try {
            const studnieProducts = window.studnieProducts || [];

            // Wyodrębnij kategorie komponentów (snapshot)
            const appliedReductions = [];
            const appliedKonus = [];
            const appliedHatches = [];
            const appliedSeals = [];
            const allComponentIds = [];

            for (const item of configItems) {
                const snap = buildComponentSnapshot(item, studnieProducts);
                if (!snap) continue;
                allComponentIds.push(snap.productId);
                const type = (snap.componentType || '').toLowerCase();
                if (type.includes('redukcj') || type.includes('plytared')) {
                    appliedReductions.push(snap);
                } else if (type.includes('konus')) {
                    appliedKonus.push(snap);
                } else if (
                    type.includes('wla') ||
                    type.includes('kinet') ||
                    type.includes('pokryw')
                ) {
                    appliedHatches.push(snap);
                } else if (type.includes('uszczel')) {
                    appliedSeals.push(snap);
                }
            }

            // Przejścia (transition snapshots)
            const transitions = (well.przejscia || []).map(function (p, idx) {
                const prod = studnieProducts.find(function (x) {
                    return x.id === p.productId;
                });
                let dn = '';
                if (prod && prod.dn != null) {
                    dn = String(prod.dn);
                }
                return {
                    transitionNo: idx + 1,
                    dn: dn,
                    transitionType: 'rura_przejściowa',
                    producer: prod ? 'WITROS' : undefined,
                    heightFromBottomMm: safeHeightMm(p.rzednaWlaczenia, well.rzednaDna),
                    position: 'inline'
                };
            });

            // Oblicz totalPrice i totalWeight z configu
            let totalPrice = 0;
            let totalWeight = 0;
            for (let idx = 0; idx < configItems.length; idx++) {
                const ci = configItems[idx];
                const prod = studnieProducts.find(function (p) {
                    return p.id === ci.productId;
                });
                if (prod) {
                    totalPrice += (parseFloat(prod.price) || 0) * (ci.quantity || 1);
                    totalWeight += (parseFloat(prod.weight) || 0) * (ci.quantity || 1);
                }
            }

            // Pełna lista komponentów jako WellComponentSnapshot[]
            const configSnapshot = [];
            for (let _i = 0; _i < configItems.length; _i++) {
                const _snap = buildComponentSnapshot(configItems[_i], studnieProducts);
                if (_snap) configSnapshot.push(_snap);
            }

            const solverSource = normalizeSolverSource(options.solverSource);

            // Deduplikacja AUTO_JS: pomiń powtórkę identycznej treści w bieżącej sesji.
            // MANUAL/AI_SUGGEST zawsze przechodzą — to sygnały decyzji użytkownika.
            if (solverSource === 'AUTO_JS' && !shouldSendAutoJs(well, configItems)) {
                return;
            }

            const wellHeight = safeHeightMm(well.rzednaWlazu, well.rzednaDna);

            // Suma wysokości dennic z configu (produkty mają height w mm).
            // Cecha treningowa dennicaHeight (v6) — musi być spójna z buildFeatureVector.
            const dennicaHeightTotal = configItems.reduce(function (acc, ci) {
                const prod = studnieProducts.find(function (p) {
                    return p.id === ci.productId;
                });
                if (prod && prod.componentType === 'dennica' && prod.height) {
                    return acc + (parseFloat(prod.height) || 0);
                }
                return acc;
            }, 0);

            // Liczba kregow (cecha treningowa ringCount). Tylko komponenty o
            // componentType 'krag'/'krag_ot' — spójnie z backendem FeatureExtractor
            // (wzorzec ID KDB-*/KDZ-*) i buildFeatureVector (layout.kregItems).
            const ringCount = configItems.reduce(function (acc, ci) {
                const prod = studnieProducts.find(function (p) {
                    return p.id === ci.productId;
                });
                const type = prod ? String(prod.componentType || '').toLowerCase() : '';
                return type === 'krag' || type === 'krag_ot' ? acc + 1 : acc;
            }, 0);

            const payload = {
                // Kontekst
                wellId: well.id || undefined,
                warehouse: well.magazyn || undefined,
                dn: well.dn != null && well.dn !== '' ? String(well.dn) : undefined,

                // Parametry
                rzDna: well.rzednaDna ? parseFloat(well.rzednaDna) : undefined,
                rzWlazu: well.rzednaWlazu ? parseFloat(well.rzednaWlazu) : undefined,
                wellHeight: wellHeight,
                wellType: well.psiaBuda
                    ? 'psia_buda'
                    : well.dn === 'styczna'
                      ? well.stycznaNadbudowa1200
                          ? 'styczna_1200'
                          : 'styczna'
                      : 'standard',
                terminationType: well.zakonczenie || undefined,
                reductionType: well.redukcjaDN1000
                    ? 'DN' + (well.redukcjaTargetDN || 1000)
                    : undefined,
                zwiencenieType: well.wkladkaZwienczenie || undefined,
                kineta: well.kineta || undefined,
                dennicaHeight: dennicaHeightTotal > 0 ? dennicaHeightTotal : undefined,
                ringCount: ringCount,

                // Komponenty
                appliedReductions: appliedReductions,
                appliedKonus: appliedKonus,
                appliedHatches: appliedHatches,
                appliedSeals: appliedSeals,
                allComponentIds: allComponentIds,

                // Solver metadata
                solverSource: solverSource,
                solverVersion: SOLVER_VERSION,
                rulesVersion: RULES_VERSION,
                computationMs: Math.round(options.computationMs || 0),
                iterationCount: options.iterationCount || 0,
                checkedVariants: options.checkedVariants || 0,
                rankingScore: options.rankingScore,
                selectionReason: options.selectionReason || undefined,

                // Boolean flagi
                wasAutoGenerated: solverSource !== 'MANUAL',
                wasAccepted: options.wasAccepted === true,
                wasModified: /** @type {any} */ (options).wasModified === true,
                overrideReason: options.overrideReason || undefined,
                feedbackProcessed: false,

                originalConfig: /** @type {any} */ (options).originalConfig || configSnapshot,
                finalConfig: /** @type {any} */ (options).finalConfig || configSnapshot,

                // Przejścia (snapshots)
                transitions: transitions,

                // Feature snapshot - co AI w przyszłości dostanie jako features
                featureSnapshot: {
                    dnString: well.dn || 'unknown',
                    isPsiaBuda: !!well.psiaBuda,
                    isStyczna: !!well.stycznaNadbudowa1200,
                    isReduction: !!well.redukcjaDN1000,
                    transitionCount: (well.przejscia || []).length,
                    warehouse: well.magazyn || 'unknown',
                    ringCount: ringCount,
                    totalPrice: totalPrice,
                    totalWeight: totalWeight,
                    targetHeightMm: wellHeight || 0,
                    kineta: well.kineta || 'unknown',
                    dennicaHeight: dennicaHeightTotal,
                    dennicaMaterial: well.dennicaMaterial || 'unknown'
                }
            };

            // Łańcuch sugestia→decyzja: rekord decyzji (MANUAL) wskazuje sugestię
            // AUTO przez parentConfigId — backend etykietuje SUGESTIĘ, nie finalny config.
            if (solverSource === 'MANUAL' && well._lastAutoTelemetryId) {
                payload.parentConfigId = well._lastAutoTelemetryId;
            }

            // Sugestia AUTO: przechwyć telemetryId z odpowiedzi, by późniejsze
            // decyzje (edycja/akceptacja) mogły wskazać ten właśnie rekord.
            if (solverSource !== 'MANUAL') {
                safeFetch(TELEMETRY_URL, payload).then(function (res) {
                    if (res && res.telemetryId) {
                        well._lastAutoTelemetryId = res.telemetryId;
                    }
                });
            } else {
                // Wyślij pasywnie (bez oczekiwania na response)
                safeFetch(TELEMETRY_URL, payload);
            }
        } catch (_e) {
            /* pasywne — ignore */
        }
    };

    /**
     * Zapisuje pojedyncze zdarzenie użytkownika.
     *
     * @param {Object} event - { eventType, wellId, componentId, previousValue, newValue, changeReason }
     */
    window.telemetryRecordEvent = function (event) {
        if (!event || !event.eventType) return;
        try {
            sequenceNo++;
            const payload = Object.assign({ sequenceNo: sequenceNo }, event);
            safeFetch(EVENT_URL, payload);
        } catch (_e) {
            /* ignore */
        }
    };

    /**
     * Zapisuje acceptance z pełnym kontekstem oferty (acceptance-full).
     * Fire-and-forget — nie blokuje UI, nie rzuca wyjątków.
     *
     * @param {Object} options
     * @param {string} options.telemetryId - ID rekordu telemetry (jeśli znany) lub ID studni
     * @param {boolean} options.accepted - czy konfiguracja zaakceptowana
     * @param {string} [options.offerId] - ID oferty
     * @param {string} [options.wellId] - ID studni
     * @param {string} [options.warehouse] - magazyn
     * @param {Object} [options.configSnapshot] - snapshot konfiguracji
     */
    window.telemetryRecordAcceptanceFull = function (options) {
        if (!options || !options.telemetryId) return;
        try {
            safeFetch(ACCEPTANCE_FULL_URL, {
                telemetryId: options.telemetryId,
                accepted: !!options.accepted,
                offerId: options.offerId || undefined,
                wellId: options.wellId || undefined,
                warehouse: options.warehouse || undefined,
                configSnapshot: options.configSnapshot || undefined
            });
        } catch (_e) {
            /* pasywne — ignore */
        }
    };

    /**
     * Rejestruje wersję solvera (raz na sesję — dedup, żeby nie spamować 429).
     */
    let _versionRegistered = false;
    window.telemetryRegisterSolverVersion = function () {
        if (_versionRegistered) return;
        try {
            if (typeof sessionStorage !== 'undefined') {
                const key = 'telemetry_version_' + SOLVER_VERSION + '_' + RULES_VERSION;
                if (sessionStorage.getItem(key)) {
                    _versionRegistered = true;
                    return;
                }
                sessionStorage.setItem(key, '1');
            }
        } catch (_e) {}
        _versionRegistered = true;
        try {
            // stagger 2 requesty by nie burstować limitera (300/min współdzielony z /config)
            safeFetch(VERSION_URL, {
                componentType: 'solver',
                version: SOLVER_VERSION,
                description: 'JS solver (wellSolver.js + ringOptimizer.js + ruleEngine.js)'
            });
            setTimeout(function () {
                safeFetch(VERSION_URL, {
                    componentType: 'rules',
                    version: RULES_VERSION,
                    description: 'Reguły doboru elementów studni'
                });
            }, 400);
        } catch (_e) {
            /* ignore */
        }
    };

    /**
     * Oryginalny config auto-doboru studni — testowalny eksport.
     */
    window.buildOriginalConfigFromWell = buildOriginalConfigFromWell;
})();
