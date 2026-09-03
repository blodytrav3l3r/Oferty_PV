// @ts-check
/**
 * mlDualRanking.js — AI Dual-Ranking dla solvera studni.
 *
 * Architektura:
 *   rankCandidates() ← główny punkt wejścia (wołany z wellSolver.js)
 *     ├─ normalizeTechnicalScores()  — min-max w poolu
 *     ├─ fetchAiScoresBatch()        — 1 request zamiast N
 *     ├─ compute finalScore          — techWeight × techNorm + aiWeight × (1 - aiScore)
 *     └─ exploration (confidence-based)
 *
 *   recordAiRankDecision() — zapisuje event AI_RANK_DECISION do telemetrii
 *
 * Zależności: window.fetch, window.telemetryRecordEvent
 */

(function () {
    'use strict';

    /* ===== KONFIGURACJA ===== */

    const BATCH_PREDICT_URL = '/api/telemetry/ai/predict/batch';
    const SETTINGS_URL = '/api/telemetry/ai/settings';
    const ML_STATUS_URL = '/api/telemetry/ai/ml-status';
    const FETCH_TIMEOUT = 3000;

    const MAX_AI_CANDIDATES = 10;

    const RELATIVE_GAP_THRESHOLD = 0.1;
    const EXPLORE_RATE_LOW_CONFIDENCE = 0.3;
    const EXPLORE_RATE_HIGH_CONFIDENCE = 0.05;
    // Minimalny rozrzut (1-aiScore) w poolu, przy którym AI w ogóle wpływa na ranking.
    // Przy auc~0.5 score zdegenerowanego modelu różnią się tylko na 4. miejscu po przecinku;
    // min-max bez progu rozciągałby ten szum do pełnej skali i produkował fałszywe flipy.
    const AI_COST_MIN_RANGE = 0.05;

    // P0 race: twardy budżet czasu na CAŁY AI path (metadata + predict).
    // Po przekroczeniu rankCandidates() zwraca ranking techniczny natychmiast,
    // a AI dogrywa w tle wyłącznie do telemetrii (nigdy nie mutuje decyzji).
    const AI_RACE_BUDGET_MS = 800;

    // Cache wpływu AI: { value, expiresAt }. P0: prosty TTL 60 s, bez sprzężenia
    // dashboard → ranking (PUT /ai/settings propaguje się w max 60 s).
    const INFLUENCE_CACHE_TTL_MS = 60 * 1000;
    let _influenceCache = { value: null, expiresAt: 0 };

    // FEATURE_VERSION musi być zgodny z wymiarami wektorów z FeatureExtractor
    // (v7 = 29 cech). Zgodna wersja unika 400 MISMATCH.
    let FEATURE_VERSION = 'v7';
    let _featureVersionFetched = false;
    const RANKING_VERSION = 'dual_v1';

    /** @type {Map<string, {score:number, timestamp:number}>} */
    const scoreCache = new Map();
    const CACHE_TTL = 15 * 60 * 1000;
    const CACHE_MAX_SIZE = 200;

    function setScoreCache(key, value) {
        if (scoreCache.size >= CACHE_MAX_SIZE) {
            const oldest = scoreCache.keys().next().value;
            if (oldest !== undefined) scoreCache.delete(oldest);
        }
        scoreCache.set(key, value);
    }

    // Okresowe czyszczenie przedawnionych wpisów cache co 5 min
    const _cacheCleanInterval = setInterval(
        function () {
            const now = Date.now();
            scoreCache.forEach(function (v, k) {
                if (now - v.timestamp > CACHE_TTL) scoreCache.delete(k);
            });
        },
        5 * 60 * 1000
    );

    /** @type {boolean} */
    let mlOnline = false;

    /** @type {string|null} */
    let activeModelVersion = null;

    /* ===== FEATURE FLAG — hierarchia: URL override > localStorage > backend > 0 ===== */

    async function fetchFeatureVersionFromBackend() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(function () {
                controller.abort();
            }, 2000);
            const res = await fetch(ML_STATUS_URL, {
                headers: authHeaders(),
                credentials: 'same-origin',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) return null;
            const data = await res.json();
            return typeof data.featureVersion === 'string' ? data.featureVersion : null;
        } catch (_e) {
            return null;
        }
    }

    // force=true wymusza ponowne pobranie wersji cech z backendu (używane przy
    // FEATURE_VERSION_MISMATCH — jednorazowy 400 nie może zablokować AI na całą sesję).
    async function resolveFeatureVersion(force) {
        if (_featureVersionFetched && !force) return FEATURE_VERSION;
        const backend = await fetchFeatureVersionFromBackend();
        if (backend !== null) {
            FEATURE_VERSION = backend;
        }
        _featureVersionFetched = true;
        return FEATURE_VERSION;
    }

    async function fetchAiInfluenceFromBackend() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(function () {
                controller.abort();
            }, 2000);
            const res = await fetch(SETTINGS_URL, {
                headers: authHeaders(),
                credentials: 'same-origin',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) return null;
            const data = await res.json();
            return parseInt(data.value, 10);
        } catch (_e) {
            return null;
        }
    }

    async function getAiInfluencePct() {
        // 0. Kill-switch: moduł OFF → czysty ranking techniczny, bez fetchy AI.
        try {
            if (typeof window.aiMlEnabled === 'function' && !(await window.aiMlEnabled())) {
                return 0;
            }
        } catch (_e) {
            /* ignoruj — fallback do standardowej hierarchii */
        }

        // 1. URL override (dev/test)
        const urlMatch = window.location.search.match(/[?&]ai_influence=(\d+)/);
        if (urlMatch) return parseInt(urlMatch[1], 10);

        // 2. localStorage override
        const local = window.localStorage.getItem('wells_ai_influence');
        if (local !== null) {
            const p = parseInt(local, 10);
            if (!isNaN(p) && p >= 0 && p <= 100) return p;
        }

        // 3. Backend config (DB settings) z cache TTL
        const now = Date.now();
        if (_influenceCache.value !== null && now < _influenceCache.expiresAt) {
            return _influenceCache.value;
        }
        const backend = await fetchAiInfluenceFromBackend();
        const val = backend !== null && backend >= 0 && backend <= 100 ? backend : 0; // 4. Default: shadow mode
        _influenceCache = { value: val, expiresAt: now + INFLUENCE_CACHE_TTL_MS };
        return val;
    }

    /* ===== BUDOWA WEKTORA CECH ===== */

    /**
     * Entropia Shannona znormalizowana przez entropie maksymalna (0..1).
     * IDENTYCZNY wzor jak backend (FeatureExtractor.ts) — wymagane, by
     * cecha ringVariety miala ta sama semantyke w treningu i na serve.
     * @param {string[]} items - lista ID (np. unikalnych ID kregow)
     * @returns {number}
     */
    function shannonEntropy(items) {
        if (!items || items.length === 0) return 0;
        const counts = new Map();
        for (const item of items) {
            counts.set(item, (counts.get(item) || 0) + 1);
        }
        let entropy = 0;
        const total = items.length;
        for (const count of counts.values()) {
            const p = count / total;
            entropy -= p * Math.log2(p);
        }
        const maxEntropy = Math.log2(counts.size);
        return maxEntropy > 0 ? entropy / maxEntropy : 0;
    }

    function getSeasonNum() {
        const m = new Date().getMonth() + 1;
        if (m >= 3 && m <= 5) return 0;
        if (m >= 6 && m <= 8) return 1;
        if (m >= 9 && m <= 11) return 2;
        return 3;
    }

    /**
     * Uzupełnia brakujące pola feature-context studni (fix train/serve skew).
     * Backend (telemetryBridge.js) liczy wellHeight = (rzednaWlazu - rzednaDna) * 1000
     * oraz wellType z psiaBuda / stycznaNadbudowa1200 — front musi robić dokładnie to samo,
     * zanim buildFeatureVector zbuduje wektor predykcji.
     * Mutacja w pamięci — nie wpływa na zapis oferty.
     * @param {Object} well
     */
    function ensureWellFeatureContext(well) {
        if (!well) return;

        const h = parseFloat(well.wellHeight);
        if (well.wellHeight === undefined || well.wellHeight === null || isNaN(h)) {
            const a = parseFloat(well.rzednaWlazu);
            const b = parseFloat(well.rzednaDna);
            if (Number.isFinite(a) && Number.isFinite(b)) {
                well.wellHeight = Math.round((a - b) * 1000);
            } else {
                well.wellHeight = 0;
            }
        }

        if (!well.type) {
            if (well.psiaBuda) {
                well.type = 'psia_buda';
            } else if (well.dn === 'styczna') {
                well.type = well.stycznaNadbudowa1200 ? 'styczna_1200' : 'styczna';
            } else {
                well.type = 'standard';
            }
        }

        // GAP B: frontend trzyma magazyn w well.magazyn ('Kluczbork'/'Włocławek'),
        // a nie well.warehouse. Normalizuj do kodu KLB/WL spójnie z backendem
        // (FeatureExtractor.normalizeWarehouse / TrainingPipeline.oneHotEncode).
        if (!well.warehouse) {
            const m = String(well.magazyn || 'Kluczbork').toUpperCase();
            well.warehouse =
                m.includes('WŁOCŁAWEK') || m.includes('WLOCLAWEK') || m === 'WL' ? 'WL' : 'KLB';
        }
    }

    /**
     * @param {Object} layout - layout konfiguracji studni
     * @param {Object} well - parametry studni
     * @returns {number[]} wektor 24 cech (v6)
     */
    /**
     * Nazwa produktu uszczelki dla danego DN i typu uszczelki — identyczna mapa
     * jak w recalcGaskets (actionsWellSync.js). Serve używa jej do doliczenia
     * kosztu uszczelek do totalPrice/totalWeight (spójność z treningiem).
     */
    function gasketNameForDn(uType, dnStr) {
        const uTypeNorm = String(uType || '').toUpperCase();
        if (uTypeNorm === 'GSG') return 'Uszczelka GSG DN' + dnStr;
        if (uTypeNorm === 'SDV') return 'Uszczelka SDV DN' + dnStr;
        if (uTypeNorm === 'SDV PO')
            return 'Uszczelka SDV DN' + dnStr + ' SDV z pierścieniem odciążającym';
        if (uTypeNorm === 'NBR') return 'Uszczelka GSG DN' + dnStr + ' z NBR';
        return 'Uszczelka GSG DN' + dnStr;
    }

    function buildFeatureVector(layout, well) {
        ensureWellFeatureContext(well);
        const dn = parseInt(well.dn) || 0;
        const heightMm = parseInt(well.wellHeight) || 0;
        const warehouse = (well.warehouse || 'KLB').toUpperCase();
        const wellType = (well.type || 'standard').toLowerCase();

        const hasReduction = !!well.redukcjaDN1000;
        const hasPsiaBuda = wellType === 'psia_buda';
        const hasStyczna = wellType === 'styczna' || wellType === 'styczna_1200';
        // GAP C: connectionCount na serve musi liczyć uszczelki tak jak trening
        // (FeatureExtractor: sealIds.length) i recalcGaskets — solver nie emituje
        // layout.sealCount, więc liczymy unikalne DN nośników uszczelek w layout.
        // recalcGaskets dodaje uszczelki tylko gdy well.uszczelka !== 'brak' —
        // przy 'brak' connectionCount=0 (spójnie z appliedSeals w treningu).
        const ringPattern = /^KDB-|^KDZ-/i;
        let connectionCount = 0;
        let ringCount =
            typeof layout.ringCount === 'number' && layout.ringCount > 0 ? layout.ringCount : 0;
        const ringUniqueIds = [];
        const seenRingIds = new Set();
        const gasketsEnabled = !!(well.uszczelka && well.uszczelka !== 'brak');
        // GASKET_CARRIERS = nośniki uszczelek wg recalcGaskets (actionsWellSync.js).
        // connectionCount = liczba UNIKALNYCH DN nośników ze WSZYSTKICH list layoutu
        // (kregItems + topItems + avrItems + dennica), spójnie z treningiem
        // (FeatureExtractor liczy unikalne DN w appliedSeals = 1 uszczelka per DN).
        const sealDns = new Set();
        const sealQtyByDn = {};
        const gasketCarrierLists = [
            ...(Array.isArray(layout.kregItems) ? layout.kregItems : []),
            ...(Array.isArray(layout.topItems) ? layout.topItems : []),
            ...(Array.isArray(layout.avrItems) ? layout.avrItems : []),
            layout.dennica ? [layout.dennica] : []
        ];
        for (const ki of gasketCarrierLists) {
            if (!ki || !ki.productId) continue;
            const prod =
                typeof window.studnieProducts !== 'undefined'
                    ? typeof getStudnieProductById === 'function'
                        ? getStudnieProductById(ki.productId)
                        : window.studnieProducts.find((p) => p.id === ki.productId)
                    : undefined;
            if (prod && prod.dn && gasketsEnabled) {
                const type = String(prod.componentType || '').toLowerCase();
                if (
                    type === 'krag' ||
                    type === 'krag_ot' ||
                    type === 'plyta_din' ||
                    type === 'plyta_redukcyjna' ||
                    type === 'konus'
                ) {
                    const dnStr = String(prod.dn);
                    sealDns.add(dnStr);
                    // recalcGaskets sumuje ILOŚCI nośników per DN (nie tylko unikalne
                    // DN jak connectionCount) — patrz requiredGaskets w actionsWellSync.js.
                    sealQtyByDn[dnStr] = (sealQtyByDn[dnStr] || 0) + (ki.quantity || 1);
                }
            }
        }
        connectionCount = sealDns.size;
        if (Array.isArray(layout.kregItems)) {
            for (const ki of layout.kregItems) {
                if (!ki || !ki.productId) continue;
                if (ringPattern.test(ki.productId)) {
                    // Liczba kręgów = liczba elementów kregowych (spójnie z treningiem
                    // FeatureExtractor/telemetryBridge liczącymi itemy, nie quantity).
                    ringCount++;
                    if (!seenRingIds.has(ki.productId)) {
                        seenRingIds.add(ki.productId);
                        ringUniqueIds.push(ki.productId);
                    }
                }
            }
        }
        const transitionsAboveDennica = Math.max(0, connectionCount - 1);
        // Cechy przejść szczelnych (v7): średnica (max piany) + podniesienie od dna.
        // Identyczna semantyka co aggregateTransitionFeatures (TrainingPipeline.ts) —
        // trening liczy z ai_transition_snapshots, serve z well.przejscia.
        const transHeights = [];
        const transList = Array.isArray(well.przejscia) ? well.przejscia : [];
        let transMaxDn = 0;
        for (const tp of transList) {
            const prod =
                typeof window.studnieProducts !== 'undefined'
                    ? typeof getStudnieProductById === 'function'
                        ? getStudnieProductById(tp.productId)
                        : window.studnieProducts.find((x) => x.id === tp.productId)
                    : undefined;
            if (prod && prod.dn != null) {
                const dn = parseInt(String(prod.dn), 10) || 0;
                if (dn > 0) transMaxDn = Math.max(transMaxDn, dn);
            }
            const hRaw = (parseFloat(tp.rzednaWlaczenia) - parseFloat(well.rzednaDna)) * 1000;
            if (Number.isFinite(hRaw)) transHeights.push(Math.round(hRaw));
        }
        const transMinH = transHeights.length ? Math.min.apply(null, transHeights) : 0;
        const transMaxH = transHeights.length ? Math.max.apply(null, transHeights) : 0;
        const transAvgH = transHeights.length
            ? Math.round(transHeights.reduce((a, b) => a + b, 0) / transHeights.length)
            : 0;
        // totalPrice/totalWeight: kandydaci z solve() nie mają layout.totalPrice/Weight —
        // licz z komponentów rozwiązania (wzór jak telemetryBridge.js), żeby model widział
        // koszty przy rankingowaniu (wcześniej zawsze 0 → cechy martwe na serve).
        let totalPrice = layout.totalPrice || 0;
        let totalWeight = layout.totalWeight || 0;
        if ((!totalPrice || !totalWeight) && typeof window.studnieProducts !== 'undefined') {
            const itemLists = [
                ...(layout.kregItems || []),
                ...(layout.topItems || []),
                ...(layout.avrItems || []),
                ...(layout.dennica ? [layout.dennica] : [])
            ];
            for (const it of itemLists) {
                if (!it || !it.productId) continue;
                const prod =
                    typeof getStudnieProductById === 'function'
                        ? getStudnieProductById(it.productId)
                        : window.studnieProducts.find((p) => p.id === it.productId);
                if (prod) {
                    totalPrice += (parseFloat(prod.price) || 0) * (it.quantity || 1);
                    totalWeight += (parseFloat(prod.weight) || 0) * (it.quantity || 1);
                }
            }
            // GAP D (K3): recalcGaskets dokłada uszczelki do well.config, więc trening
            // (telemetryBridge sumuje configItems Z uszczelkami) ma wyższą totalPrice/
            // totalWeight niż serve (layout nie zawiera uszczelek). Dodaj koszt uszczelek
            // z tych samych nazw produktów co recalcGaskets — inaczej cena/waga na serve
            // jest systematycznie zaniżona (skew cech train/serve).
            if (gasketsEnabled) {
                for (const dnStr of Object.keys(sealQtyByDn)) {
                    const gasketProd = window.studnieProducts.find(
                        (p) =>
                            p.componentType === 'uszczelka' &&
                            p.name === gasketNameForDn(well.uszczelka, dnStr)
                    );
                    if (gasketProd) {
                        const qty = sealQtyByDn[dnStr];
                        totalPrice += (parseFloat(gasketProd.price) || 0) * qty;
                        totalWeight += (parseFloat(gasketProd.weight) || 0) * qty;
                    }
                }
            }
        }
        // ringVariety: entropia Shannona z UNIKALNYCH ID kregow (KDB-/KDZ-) —
        // identyczna semantyka jak backend (shannonEntropy nad unikalnymi ID kregow).
        const ringVariety = shannonEntropy(ringUniqueIds);

        // === v6: kineta (one-hot) + dennicaHeight ===
        const kineta = (well.kineta || '').toLowerCase();
        const isKinetaPreco = kineta === 'preco' || kineta === 'precotop';
        const isKinetaUnolith = kineta === 'unolith';
        const isKinetaStandard = kineta === 'beton' || kineta === '';
        // ponytail: dennicaHeight = wysokość dennicy ocenianego kandydata (layout.dennica).
        // Solver emituje 1 dennnicę na studnię, więc jest to spójne z telemetryBridge
        // (sumą dennicy z finalnego configa). Przy konfiguracji z 2+ dennnicami byłby
        // minimalny skew train/serve — zaakceptowany (rzadki przypadek, height w mm całkowitych).
        let dennicaHeightMm = 0;
        if (layout.dennica && layout.dennica.productId) {
            const prods =
                typeof window.studnieProducts !== 'undefined' ? window.studnieProducts : [];
            const prod = prods.find(function (p) {
                return p.id === layout.dennica.productId;
            });
            if (prod && prod.height) dennicaHeightMm = parseFloat(prod.height) || 0;
        }

        // GAP A: hasKnownTop w treningu = topType ustawiany tylko z konusa
        // (FeatureExtractor: konusIds.length > 0). Serve sprawdza czy topItems
        // zawiera konus — wcześniej liczył dowolne topItems (zawsze 1).
        let topHasKnown = false;
        if (Array.isArray(layout.topItems)) {
            for (const ti of layout.topItems) {
                if (!ti || !ti.productId) continue;
                const prod =
                    typeof window.studnieProducts !== 'undefined'
                        ? typeof getStudnieProductById === 'function'
                            ? getStudnieProductById(ti.productId)
                            : window.studnieProducts.find((p) => p.id === ti.productId)
                        : undefined;
                if (prod && String(prod.componentType || '').toLowerCase() === 'konus') {
                    topHasKnown = true;
                    break;
                }
            }
        }

        return [
            dn,
            heightMm,
            warehouse === 'KLB' ? 1 : 0,
            warehouse === 'WL' ? 1 : 0,
            wellType === 'standard' ? 1 : 0,
            wellType === 'psia_buda' ? 1 : 0,
            hasStyczna ? 1 : 0,
            hasReduction ? 1 : 0,
            hasPsiaBuda ? 1 : 0,
            ringCount,
            connectionCount,
            transitionsAboveDennica,
            totalPrice,
            totalWeight,
            ringVariety,
            getSeasonNum(),
            layout.dennica ? 1 : 0,
            topHasKnown ? 1 : 0,
            dn * ringCount,
            warehouse === 'KLB' && wellType === 'standard' ? 1 : 0,
            isKinetaPreco ? 1 : 0,
            isKinetaUnolith ? 1 : 0,
            isKinetaStandard ? 1 : 0,
            dennicaHeightMm,
            transList.length,
            transMaxDn,
            transMinH,
            transMaxH,
            transAvgH
        ];
    }

    /* ===== BATCH PREDYKCJA (dla rankCandidates) ===== */

    /**
     * Pobiera AI score dla wszystkich kandydatów w 1 requeście.
     * @param {Array<{id:number, solution:Object, technicalScore:number}>} candidates
     * @param {Object} well
     * @param {boolean} [retried] - wewn. flaga ponownej próby po FEATURE_VERSION_MISMATCH
     * @returns {Promise<Map<number, number>>} mapa candidateId → aiScore
     */
    async function fetchAiScoresBatch(candidates, well, retried) {
        const resultMap = new Map();
        const toFetch = [];
        await resolveFeatureVersion(retried);

        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            const features = buildFeatureVector(c.solution, well);
            // Klucz cache zawiera featureVersion — zmiana wersji cech nie serwuje starych score'ów.
            const key = FEATURE_VERSION + '|' + features.join(',');

            const cached = scoreCache.get(key);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                resultMap.set(c.id, cached.score);
            } else {
                toFetch.push({
                    id: c.id,
                    features: features,
                    wellType: well.type || '',
                    warehouse: well.warehouse || 'KLB',
                    dn: parseInt(well.dn) || 0,
                    // wellId umożliwia serwerową weryfikację scoreBefore w /ai/reward
                    // (sliding AUC nie ufa klienckiemu score — poisoning przez API)
                    wellId: well.id || undefined
                });
            }
        }

        if (toFetch.length === 0) {
            mlOnline = true;
            return resultMap;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(function () {
                controller.abort();
            }, FETCH_TIMEOUT);

            const res = await fetch(BATCH_PREDICT_URL, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({
                    candidates: toFetch,
                    featureVersion: FEATURE_VERSION
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                mlOnline = false;
                // Jednorazowy 400 FEATURE_VERSION_MISMATCH nie może zablokować AI na całą
                // sesję — odśwież wersję cech z backendu i ponów zapytanie (max 1 raz).
                if (res.status === 400 && !retried) {
                    try {
                        const err = await res.json();
                        if (err && err.error === 'FEATURE_VERSION_MISMATCH') {
                            return fetchAiScoresBatch(candidates, well, true);
                        }
                    } catch (_e) {
                        /* ignoruj — zejdź do fallbacku -1 */
                    }
                }
                // Fill uncached with -1
                for (let j = 0; j < toFetch.length; j++) {
                    resultMap.set(toFetch[j].id, -1);
                }
                return resultMap;
            }

            const data = await res.json();
            if (data.scores && data.scores.length > 0) {
                mlOnline = true;
                for (let k = 0; k < data.scores.length; k++) {
                    const s = data.scores[k];
                    activeModelVersion = s.version;
                    resultMap.set(s.id, s.score);
                    // Update cache
                    const featKey = toFetch.find(function (t) {
                        return t.id === s.id;
                    });
                    if (featKey) {
                        const fk = FEATURE_VERSION + '|' + featKey.features.join(',');
                        setScoreCache(fk, { score: s.score, timestamp: Date.now() });
                    }
                }
                // Fill any missing with -1
                for (let l = 0; l < toFetch.length; l++) {
                    if (!resultMap.has(toFetch[l].id)) {
                        resultMap.set(toFetch[l].id, -1);
                    }
                }
            } else {
                mlOnline = false;
                for (let m = 0; m < toFetch.length; m++) {
                    resultMap.set(toFetch[m].id, -1);
                }
            }
        } catch (_e) {
            mlOnline = false;
            for (let n = 0; n < toFetch.length; n++) {
                resultMap.set(toFetch[n].id, -1);
            }
        }

        return resultMap;
    }

    /* ===== NORMALIZACJA TECHNICAL SCORE ===== */

    /**
     * Min-max normalizacja w obrębie poolu.
     * lower technicalScore = lepszy.
     * @param {Array<{id:number, solution:Object, technicalScore:number}>} candidates
     * @returns {Array<{id:number, solution:Object, technicalScore:number, technicalNormalized:number}>}
     */
    function normalizeTechnicalScores(candidates) {
        if (candidates.length < 2) {
            return candidates.map(function (c) {
                return {
                    id: c.id,
                    technicalNormalized: 0.5,
                    technicalScore: c.technicalScore,
                    solution: c.solution
                };
            });
        }

        const scores = candidates.map(function (c) {
            return c.technicalScore;
        });
        const min = Math.min.apply(null, scores);
        const max = Math.max.apply(null, scores);
        const range = max - min || 1;

        return candidates.map(function (c) {
            return {
                id: c.id,
                solution: c.solution,
                technicalScore: c.technicalScore,
                technicalNormalized: (c.technicalScore - min) / range // 0=best, 1=worst
            };
        });
    }

    /* ===== GŁÓWNY RANKING ===== */

    /**
     * Główna funkcja rankowania: candidate pool → AI score → dual-score → posortowane.
     *
     * @param {Object} opts
     * @param {Array<{id:number, solution:Object, technicalScore:number}>} opts.candidates - pool z solve()
     * @param {Object} opts.well - parametry studni
     * @param {number} [opts.aiInfluencePct] - 0-100 (0=shadow)
     * @returns {Promise<{
     *   ranked: Array<{id:number, finalScore:number, technicalScore:number, technicalNormalized:number, aiScore:number, solution:Object}>,
     *   mlOnline: boolean,
     *   modelVersion: string|null,
     *   technicalWinner: Object,
     *   aiInfluencePct: number,
     *   rankingVersion: string,
     *   featureVersion: string
     * }>}
     */
    async function rankCandidates(opts) {
        const candidates = opts.candidates;
        const well = opts.well;

        if (!candidates || candidates.length === 0) {
            return {
                ranked: [],
                mlOnline: false,
                modelVersion: null,
                technicalWinner: null,
                aiInfluencePct: 0,
                rankingVersion: RANKING_VERSION,
                featureVersion: FEATURE_VERSION
            };
        }

        // 1. Poziom wpływu AI rozstrzyga się WEWNĄTRZ race (invariant 1) —
        // żaden await metadanych przed budżetem. undefined = pobierz w aiPath.
        const influencePct = opts.aiInfluencePct;

        // 2. Limit do MAX_AI_CANDIDATES
        const pool = candidates.slice(0, MAX_AI_CANDIDATES);

        // 3. Normalizacja technical score (min-max w poolu) — czysta synchroniczna,
        // część techniczna nigdy nie czeka na AI (invariant P0).
        const normalized = normalizeTechnicalScores(pool);
        const technicalWinner = candidates[0].solution;

        // 4. CAŁY AI path (influence + version + predict) w jednym wyścigu z budżetem
        // (invariant 1: budget startuje przed metadata, nie po niej).
        const aiPath = (async function () {
            const pct =
                influencePct !== undefined && influencePct !== null
                    ? influencePct
                    : await getAiInfluencePct();
            const aiScoreMap = await fetchAiScoresBatch(pool, well);
            return { influencePct: pct, aiScoreMap: aiScoreMap };
        })();
        // Jednolity kształt wyniku (TS2339: unii bez wspólnych pól nie zawęża).
        const aiSettled = aiPath.then(
            function (res) {
                return { ok: true, res: res, timedOut: false };
            },
            function () {
                return { ok: false, res: null, timedOut: false };
            }
        );
        let raceTimer = null;
        const raceTimeout = new Promise(function (resolve) {
            raceTimer = setTimeout(function () {
                resolve({ ok: false, res: null, timedOut: true });
            }, AI_RACE_BUDGET_MS);
        });
        const winner = await Promise.race([aiSettled, raceTimeout]);
        if (raceTimer) clearTimeout(raceTimer);

        if (winner.timedOut || !winner.ok) {
            // Timeout (lub błąd AI path): ranking techniczny natychmiast.
            // Invariant 2: od tego miejsca ŻADEN await zależny od AI.
            // Przegrany promise leci dalej w tle — wyłącznie telemetria
            // (invarianty 3–4: brak mutacji decyzji, well, DOM, solvera).
            aiSettled.then(function (late) {
                if (!late.ok) return;
                const lateRanked = computeRanked(
                    normalized,
                    late.res.aiScoreMap,
                    late.res.influencePct
                );
                recordAiRankDecision({
                    well: well,
                    ranked: lateRanked,
                    technicalWinner: technicalWinner,
                    aiWinner: lateRanked.length > 0 ? lateRanked[0].solution : null,
                    explorationTriggered: false,
                    exploredFrom: null,
                    aiInfluencePct: late.res.influencePct,
                    modelVersion: activeModelVersion,
                    rankingVersion: RANKING_VERSION,
                    featureVersion: FEATURE_VERSION,
                    background: true
                });
            });
            const offlineMap = new Map();
            for (let t = 0; t < pool.length; t++) offlineMap.set(pool[t].id, -1);
            return {
                ranked: computeRanked(
                    normalized,
                    offlineMap,
                    influencePct !== undefined && influencePct !== null ? influencePct : 0
                ),
                mlOnline: false,
                modelVersion: activeModelVersion,
                technicalWinner: technicalWinner,
                aiInfluencePct:
                    influencePct !== undefined && influencePct !== null ? influencePct : 0,
                rankingVersion: RANKING_VERSION,
                featureVersion: FEATURE_VERSION
            };
        }

        // AI zdążyło w budżecie — normalna ścieżka (jak dotychczas).
        const wonInfluencePct = winner.res.influencePct;
        const aiScoreMap = winner.res.aiScoreMap;

        // 5. Oblicz final score
        const ranked = computeRanked(normalized, aiScoreMap, wonInfluencePct);

        return {
            ranked: ranked,
            mlOnline: mlOnline,
            modelVersion: activeModelVersion,
            technicalWinner: technicalWinner,
            aiInfluencePct: wonInfluencePct,
            rankingVersion: RANKING_VERSION,
            featureVersion: FEATURE_VERSION
        };
    }

    /**
     * Czysta funkcja final score + sort (kroki 5–6 rankCandidates).
     * Bez I/O — współdzielona przez ścieżkę normalną, fallback i background.
     * @param {Array} normalized - wynik normalizeTechnicalScores
     * @param {Map} aiScoreMap - candidateId → aiScore (-1 = offline)
     * @param {number} influencePct - 0-100
     */
    function computeRanked(normalized, aiScoreMap, influencePct) {
        const aiWeight = influencePct / 100;
        const techWeight = 1 - aiWeight;

        // 5a. Surowy "koszt" AI (lower is better) dla kandydatów online.
        // Min-max w poolu — analogicznie do technicalNormalized. Bez tego każdy kandydat
        // ma identyczny aiCost (nasycony sigmoid ~0.9994) i AI nie zmienia kolejności.
        const rawAiCosts = normalized.map(function (c) {
            let aiScore = aiScoreMap.get(c.id);
            if (aiScore === undefined) aiScore = -1;
            return aiScore >= 0 ? 1 - aiScore : null;
        });
        const onlineCosts = rawAiCosts.filter(function (v) {
            return v !== null;
        });
        const minCost = onlineCosts.length > 0 ? Math.min.apply(null, onlineCosts) : 0;
        const maxCost = onlineCosts.length > 0 ? Math.max.apply(null, onlineCosts) : 0;
        const costRange = maxCost - minCost;

        const ranked = normalized.map(function (c) {
            let aiScore = aiScoreMap.get(c.id);
            if (aiScore === undefined) aiScore = -1;

            let finalScore;
            if (aiScore < 0) {
                // ML offline — spójna skala z normalizacją AI (0=best, 1=worst).
                finalScore = c.technicalNormalized;
            } else {
                // technicalNormalized: 0=best, 1=worst (lower is better)
                // aiScore: 0=worst, 1=best (higher is better)
                // Konwertuj AI na format "lower is better" i normalizuj w poolu.
                // Neutral (0) gdy <2 kandydatów online (brak względem kogo) lub rozrzut
                // <= AI_COST_MIN_RANGE (szum) — wtedy ranking pozostaje czysto techniczny,
                // a pojedynczy kandydat online nie dostaje kary 0.5 względem offline.
                const aiCost = 1 - aiScore;
                const aiCostNormalized =
                    onlineCosts.length < 2 || costRange <= AI_COST_MIN_RANGE
                        ? 0
                        : (aiCost - minCost) / costRange;
                finalScore = techWeight * c.technicalNormalized + aiWeight * aiCostNormalized;
            }

            return {
                id: c.id,
                solution: c.solution,
                technicalScore: c.technicalScore,
                technicalNormalized: c.technicalNormalized,
                aiScore: aiScore,
                finalScore: finalScore
            };
        });

        // 6. Sortuj ascending (niższy = lepszy)
        ranked.sort(function (a, b) {
            return a.finalScore - b.finalScore;
        });

        return ranked;
    }

    /* ===== EXPLORATION ===== */

    /**
     * Confidence-based exploration.
     * Mała różnica między top-2 → większa szansa na eksplorację.
     *
     * Eksploracja to celowy losowy wybór z top-puli — NIE jest to decyzja AI.
     * Zwracamy osobno aiWinner (czysty wybór modelu: ranked[0]) i ewentualny
     * solution po eksploracji, by caller nie oznaczył próbki eksploracyjnej jako AUTO_AI.
     *
     * @param {Array<{finalScore:number, solution:Object}>} ranked
     * @returns {{solution:Object|null, aiWinner:Object|null, explorationTriggered:boolean, exploredFrom:number|null}}
     */
    function selectWithExploration(ranked) {
        if (!ranked || ranked.length === 0) {
            return {
                solution: null,
                aiWinner: null,
                explorationTriggered: false,
                exploredFrom: null
            };
        }

        const aiWinner = ranked[0].solution;
        let winner = ranked[0];
        let triggered = false;
        let exploredFrom = null;

        if (ranked.length > 1) {
            const gap =
                (ranked[1].finalScore - ranked[0].finalScore) / Math.abs(ranked[0].finalScore || 1);
            const lowConfidence = gap < RELATIVE_GAP_THRESHOLD;
            const rate = lowConfidence ? EXPLORE_RATE_LOW_CONFIDENCE : EXPLORE_RATE_HIGH_CONFIDENCE;

            if (Math.random() < rate) {
                exploredFrom = 0;
                // Losuj z top-5 (lub top-3 gdy wysoka pewność)
                const poolSize = lowConfidence
                    ? Math.min(5, ranked.length)
                    : Math.min(3, ranked.length);
                const randomIdx = 1 + Math.floor(Math.random() * (poolSize - 1));
                winner = ranked[randomIdx];
                triggered = true;
            }
        }

        return {
            solution: winner.solution,
            aiWinner: aiWinner,
            explorationTriggered: triggered,
            exploredFrom: exploredFrom
        };
    }

    /* ===== REJESTRACJA DECYZJI AI (event AI_RANK_DECISION) ===== */

    /**
     * Zapisuje pełną decyzję rankingu do telemetrii.
     *
     * @param {Object} opts
     * @param {Object} opts.well - studnia
     * @param {Array} opts.ranked - posortowani kandydaci (z rankCandidates)
     * @param {Object} opts.technicalWinner - najlepszy technical (przed AI)
     * @param {Object|null} opts.aiWinner - zwycięzca po AI rankingu (może być == technicalWinner)
     * @param {boolean} opts.explorationTriggered
     * @param {number|null} opts.exploredFrom
     * @param {number} opts.aiInfluencePct
     * @param {string} opts.modelVersion
     * @param {string} opts.rankingVersion
     * @param {string} opts.featureVersion
     * @param {boolean} [opts.background] - dogranie po timeoutcie race (telemetria only,
     *   nigdy nie mutuje decyzji — invarianty P0 3–4)
     */
    function recordAiRankDecision(opts) {
        if (typeof window.telemetryRecordEvent !== 'function') return;

        let technicalWinnerIdx = -1;
        let aiWinnerIdx = -1;

        if (opts.ranked && opts.ranked.length > 0) {
            for (let i = 0; i < opts.ranked.length; i++) {
                if (opts.ranked[i].solution === opts.technicalWinner) {
                    technicalWinnerIdx = i;
                }
                if (opts.aiWinner && opts.ranked[i].solution === opts.aiWinner) {
                    aiWinnerIdx = i;
                }
            }
        }

        const reason = {
            candidateCount: opts.ranked ? opts.ranked.length : 0,
            technicalWinnerIdx: technicalWinnerIdx,
            aiWinnerIdx: aiWinnerIdx,
            aiInfluencePct: opts.aiInfluencePct,
            modelVersion: opts.modelVersion,
            rankingVersion: opts.rankingVersion,
            featureVersion: opts.featureVersion,
            explorationTriggered: opts.explorationTriggered,
            exploredFrom: opts.exploredFrom,
            background: !!opts.background,
            scoreGap:
                opts.ranked && opts.ranked.length > 1
                    ? (
                          (opts.ranked[1].finalScore - opts.ranked[0].finalScore) /
                          Math.abs(opts.ranked[0].finalScore || 1)
                      ).toFixed(4)
                    : null,
            top5Scores: opts.ranked
                ? opts.ranked.slice(0, 5).map(function (r) {
                      return {
                          technical: r.technicalScore,
                          technicalNorm: r.technicalNormalized,
                          aiScore: r.aiScore,
                          finalScore: r.finalScore
                      };
                  })
                : []
        };

        window.telemetryRecordEvent({
            eventType: 'ai_rank_decision',
            wellId: opts.well ? opts.well.id : 'unknown',
            changeReason: JSON.stringify(reason)
        });
    }

    /* ===== EKSPORT ===== */

    // Główne API
    window.rankCandidates = rankCandidates;
    window.recordAiRankDecision = recordAiRankDecision;
    window.selectWithExploration = selectWithExploration;
    window.getAiInfluencePct = getAiInfluencePct;
    window.buildFeatureVector = buildFeatureVector;
})();
