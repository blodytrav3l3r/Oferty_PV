// @ts-check
/**
 * mlDualRanking.js — AI Dual-Ranking dla solvera studni.
 *
 * Final score = 0.6 × Technical + 0.4 × AI × 100
 * Exploration: 5% losowo z top-3 wariantów
 * Cache API: 15 min
 * Fallback: base scoring gdy ML offline
 *
 * Integracja: wywoływany z scoreLayout() w wellConfigRules.js
 */

(function () {
    'use strict';

    const AI_PREDICT_URL = '/api/telemetry/ai/predict';
    const FETCH_TIMEOUT = 2000;

    /** @type {Map<string, {score:number, timestamp:number}>} */
    const scoreCache = new Map();
    const CACHE_TTL = 15 * 60 * 1000;

    /** @type {boolean} */
    let mlOnline = false;

    /** @type {string|null} */
    let activeModelVersion = null;

    /**
     * Pobiera score AI dla danej konfiguracji
     * @param {Object} layout - layout konfiguracji studni
     * @param {Object} well - parametry studni
     * @returns {Promise<number>} AI score [0-1] lub -1 gdy offline
     */
    async function fetchAiScore(layout, well) {
        const features = buildFeatureVector(layout, well);
        const key = features.join(',');

        const cached = scoreCache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.score;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(function () {
                controller.abort();
            }, FETCH_TIMEOUT);

            const res = await fetch(AI_PREDICT_URL, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    features: features,
                    wellType: well.type || '',
                    warehouse: well.warehouse || 'KLB',
                    dn: parseInt(well.dn) || 0
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                mlOnline = false;
                return -1;
            }

            const data = await res.json();
            if (data.scores && data.scores.length > 0) {
                const s = data.scores[0];
                activeModelVersion = s.version;
                scoreCache.set(key, { score: s.score, timestamp: Date.now() });
                mlOnline = true;
                return s.score;
            }
            mlOnline = false;
            return -1;
        } catch (e) {
            mlOnline = false;
            return -1;
        }
    }

    /**
     * Buduje wektor cech z layoutu i well
     * @param {Object} layout
     * @param {Object} well
     * @returns {number[]}
     */
    function buildFeatureVector(layout, well) {
        var dn = parseInt(well.dn) || 0;
        var heightMm = parseInt(well.wellHeight) || 0;
        var warehouse = (well.warehouse || 'KLB').toUpperCase();
        var wellType = (well.type || 'standard').toLowerCase();

        var hasReduction = !!well.redukcjaDN1000;
        var hasPsiaBuda = wellType === 'psia_buda';
        var hasStyczna = wellType === 'styczna' || wellType === 'styczna_1200';
        var ringCount = layout.ringCount || 0;
        var connectionCount = layout.sealCount || 0;
        var transitionsAboveDennica = Math.max(0, connectionCount - 1);
        var totalPrice = layout.totalPrice || 0;
        var totalWeight = layout.totalWeight || 0;
        var ringVariety = layout.ringVariety || 0;

        var vec = [
            dn,
            heightMm,
            warehouse === 'KLB' ? 1 : 0,
            warehouse === 'WL' ? 1 : 0,
            wellType === 'standard' ? 1 : 0,
            wellType === 'psia_buda' ? 1 : 0,
            hasStyczna ? 1 : 0,
            hasReduction ? 1 : 0,
            hasPsiaBuda ? 1 : 0,
            hasStyczna ? 1 : 0,
            ringCount,
            connectionCount,
            transitionsAboveDennica,
            totalPrice,
            totalWeight,
            ringVariety
        ];

        return vec;
    }

    /**
     * Oblicza końcowy score z dual-ranking
     * @param {number} technicalScore - score z scoreLayout()
     * @param {number} aiScore - score z modelu AI [0-1] lub -1
     * @returns {number} Final score
     */
    function computeDualScore(technicalScore, aiScore) {
        if (aiScore < 0) {
            // ML offline — fallback do technical score
            return technicalScore;
        }
        // Final = 0.6 × Technical + 0.4 × AI × 100
        return 0.6 * technicalScore + 0.4 * aiScore * 100;
    }

    /**
     * Wzbogaca layout o AI score (jeśli dostępny)
     * @param {Object} layout - obiekt layoutu z wellSolver.js
     * @param {Object} well - parametry studni
     * @returns {Promise<Object>} layout z aiScore
     */
    async function mlEnrichLayout(layout, well) {
        var aiScore = await fetchAiScore(layout, well);
        layout._aiScore = aiScore;
        layout._mlOnline = mlOnline;
        layout._modelVersion = activeModelVersion;
        return layout;
    }

    /**
     * Wzbogaca tablicę layoutów i sortuje dual-ranking + exploration
     * @param {Array<Object>} layouts - tablica layoutów
     * @param {Object} well - parametry studni
     * @returns {Promise<Array<Object>>} layouty posortowane dual-ranking
     */
    async function mlRankLayouts(layouts, well) {
        if (!layouts || layouts.length === 0) return layouts;

        // Wzbogać każdy layout o AI score
        var enriched = await Promise.all(
            layouts.map(function (l) {
                return mlEnrichLayout(l, well);
            })
        );

        // Oblicz dual-ranking score
        enriched.forEach(function (l) {
            l._dualScore = computeDualScore(l.score || l._score || 0, l._aiScore);
        });

        // Sortuj po dual-score (ascending — niższy = lepszy)
        enriched.sort(function (a, b) {
            return (a._dualScore || Infinity) - (b._dualScore || Infinity);
        });

        // Exploration: 5% losowo z top-3 wariantów
        if (Math.random() < 0.05 && enriched.length > 1) {
            var top3 = enriched.slice(0, Math.min(3, enriched.length));
            var randomIdx = Math.floor(Math.random() * top3.length);
            var chosen = top3[randomIdx];
            var chosenPos = enriched.indexOf(chosen);
            if (chosenPos > 0) {
                enriched.splice(chosenPos, 1);
                enriched.unshift(chosen);
            }
        }

        return enriched;
    }

    /**
     * Status systemu ML
     * @returns {{online:boolean, modelVersion:string|null, cacheSize:number}}
     */
    function getMlStatus() {
        return {
            online: mlOnline,
            modelVersion: activeModelVersion,
            cacheSize: scoreCache.size
        };
    }

    // Eksport do window
    window.mlEnrichLayout = mlEnrichLayout;
    window.mlRankLayouts = mlRankLayouts;
    window.getMlStatus = getMlStatus;
    window.fetchAiScore = fetchAiScore;
    window.computeDualScore = computeDualScore;
})();
