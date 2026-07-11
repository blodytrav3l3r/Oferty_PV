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
    const TIMEOUT_MS = 1500; // krótki, żeby nie blokować UI when offline

    /* ===== WERSJE ===== */
    const SOLVER_VERSION = '1.0.0'; // src/version.ts
    const RULES_VERSION = '2026-06-30.1'; // data reguł doboru

    /* ===== STAN WEWNETRZNY ===== */
    let sequenceNo = 0;

    /**
     * Bezpieczny fetch z timeoutem. Nie rzuca wyjątków.
     */
    function safeFetch(url, payload) {
        try {
            if (!window.fetch) return Promise.resolve();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
            return fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            })
                .then(function () {
                    clearTimeout(timeoutId);
                })
                .catch(function () {
                    /* telemetry pasywna - ignorujemy */
                });
        } catch (e) {
            return Promise.resolve();
        }
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
                if (prod && typeof prod.dn === 'string') {
                    dn = prod.dn;
                }
                return {
                    transitionNo: idx + 1,
                    dn: dn,
                    transitionType: 'rura_przejściowa',
                    producer: prod ? 'WITROS' : undefined,
                    heightFromBottomMm:
                        p.rzednaWlaczenia !== undefined && well.rzednaDna !== undefined
                            ? Math.round(
                                  (parseFloat(p.rzednaWlaczenia) -
                                      parseFloat(well.rzednaDna || 0)) *
                                      1000
                              )
                            : undefined,
                    position: 'inline'
                };
            });

            // Oblicz totalPrice i totalWeight z configu
            var totalPrice = 0;
            var totalWeight = 0;
            for (var idx = 0; idx < configItems.length; idx++) {
                var ci = configItems[idx];
                var prod = studnieProducts.find(function (p) {
                    return p.id === ci.productId;
                });
                if (prod) {
                    totalPrice += (parseFloat(prod.price) || 0) * (ci.quantity || 1);
                    totalWeight += (parseFloat(prod.weight) || 0) * (ci.quantity || 1);
                }
            }

            const payload = {
                // Kontekst
                wellId: well.id || undefined,
                warehouse: well.magazyn || undefined,
                dn: well.dn || undefined,

                // Parametry
                rzDna: well.rzednaDna ? parseFloat(well.rzednaDna) : undefined,
                rzWlazu: well.rzednaWlazu ? parseFloat(well.rzednaWlazu) : undefined,
                wellHeight:
                    well.rzednaDna !== undefined && well.rzednaWlazu !== undefined
                        ? Math.round(
                              (parseFloat(well.rzednaWlazu) - parseFloat(well.rzednaDna || 0)) *
                                  1000
                          )
                        : undefined,
                wellType: well.psiaBuda
                    ? 'psia_buda'
                    : well.stycznaNadbudowa1200
                      ? 'styczna_1200'
                      : 'standard',
                terminationType: well.zakonczenie || undefined,
                reductionType: well.redukcjaDN1000
                    ? 'DN' + (well.redukcjaTargetDN || 1000)
                    : undefined,
                zwiencenieType: well.wkladkaZwienczenie || undefined,

                // Komponenty
                appliedReductions: appliedReductions,
                appliedKonus: appliedKonus,
                appliedHatches: appliedHatches,
                appliedSeals: appliedSeals,
                allComponentIds: allComponentIds,

                // Solver metadata
                solverSource: options.solverSource || 'AUTO_JS',
                solverVersion: SOLVER_VERSION,
                rulesVersion: RULES_VERSION,
                computationMs: Math.round(options.computationMs || 0),
                iterationCount: options.iterationCount || 0,
                checkedVariants: options.checkedVariants || 0,
                rankingScore: options.rankingScore,
                selectionReason: options.selectionReason || undefined,

                // Boolean flagi
                wasAutoGenerated: (options.solverSource || 'AUTO_JS') !== 'MANUAL',
                wasAccepted: options.wasAccepted === true,
                overrideReason: options.overrideReason || undefined,
                feedbackProcessed: false,

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
                    ringCount: configItems.length,
                    totalPrice: totalPrice,
                    totalWeight: totalWeight,
                    targetHeightMm:
                        well.rzednaWlazu && well.rzednaDna !== undefined
                            ? Math.round(
                                  (parseFloat(well.rzednaWlazu) - parseFloat(well.rzednaDna || 0)) *
                                      1000
                              )
                            : 0
                }
            };

            // Wyślij pasywnie (bez oczekiwania na response)
            safeFetch(TELEMETRY_URL, payload);
        } catch (e) {
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
        } catch (e) {
            /* ignore */
        }
    };

    /**
     * Rejestruje wersję solvera (raz na start aplikacji).
     */
    window.telemetryRegisterSolverVersion = function () {
        try {
            safeFetch(VERSION_URL, {
                componentType: 'solver',
                version: SOLVER_VERSION,
                description: 'JS solver (wellSolver.js + ringOptimizer.js + ruleEngine.js)'
            });
            safeFetch(VERSION_URL, {
                componentType: 'rules',
                version: RULES_VERSION,
                description: 'Reguły doboru elementów studni'
            });
        } catch (e) {
            /* ignore */
        }
    };

    // Auto-rejestracja wersji na starcie
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            if (typeof window.telemetryRegisterSolverVersion === 'function') {
                window.telemetryRegisterSolverVersion();
            }
        });
    } else {
        window.telemetryRegisterSolverVersion();
    }
})();
