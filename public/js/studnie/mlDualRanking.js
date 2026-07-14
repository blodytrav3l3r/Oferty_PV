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

    var BATCH_PREDICT_URL = '/api/telemetry/ai/predict/batch';
    var SINGLE_PREDICT_URL = '/api/telemetry/ai/predict';
    var SETTINGS_URL = '/api/telemetry/ai/settings';
    var FETCH_TIMEOUT = 3000;

    var MAX_AI_CANDIDATES = 10;
    var MIN_AI_CANDIDATES = 3;

    var RELATIVE_GAP_THRESHOLD = 0.1; // 10% — exploration próg
    var EXPLORE_RATE_LOW_CONFIDENCE = 0.3;
    var EXPLORE_RATE_HIGH_CONFIDENCE = 0.05;

    var FEATURE_VERSION = 'v3';
    var RANKING_VERSION = 'dual_v1';
    var SOLVER_VERSION = 'wellSolver_v5';

    /** @type {Map<string, {score:number, timestamp:number}>} */
    var scoreCache = new Map();
    var CACHE_TTL = 15 * 60 * 1000;

    /** @type {boolean} */
    var mlOnline = false;

    /** @type {string|null} */
    var activeModelVersion = null;

    /** @type {number} */
    var aiInfluencePct = 0;

    /* ===== FEATURE FLAG — hierarchia: URL override > localStorage > backend > 0 ===== */

    async function fetchAiInfluenceFromBackend() {
        try {
            var controller = new AbortController();
            var timeoutId = setTimeout(function () {
                controller.abort();
            }, 2000);
            var res = await fetch(SETTINGS_URL, {
                credentials: 'same-origin',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!res.ok) return null;
            var data = await res.json();
            return parseInt(data.value, 10);
        } catch (e) {
            return null;
        }
    }

    async function getAiInfluencePct() {
        // 1. URL override (dev/test)
        var urlMatch = window.location.search.match(/[?&]ai_influence=(\d+)/);
        if (urlMatch) return parseInt(urlMatch[1], 10);

        // 2. localStorage override
        var local = window.localStorage.getItem('wells_ai_influence');
        if (local !== null) {
            var p = parseInt(local, 10);
            if (!isNaN(p) && p >= 0 && p <= 100) return p;
        }

        // 3. Backend config (DB settings)
        var backend = await fetchAiInfluenceFromBackend();
        if (backend !== null && backend >= 0 && backend <= 100) return backend;

        // 4. Default: shadow mode
        return 0;
    }

    /* ===== BUDOWA WEKTORA CECH ===== */

    /**
     * @param {Object} layout - layout konfiguracji studni
     * @param {Object} well - parametry studni
     * @returns {number[]} wektor 16 cech
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
            hasStyczna ? 1 : 0,
            ringCount,
            connectionCount,
            transitionsAboveDennica,
            totalPrice,
            totalWeight,
            ringVariety
        ];
    }

    /* ===== POJEDYNCZA PREDYKCJA (fallback) ===== */

    /**
     * Pojedyncza predykcja AI — fallback dla mlEnrichLayout (zachowana kompatybilność).
     * @param {Object} layout
     * @param {Object} well
     * @returns {Promise<number>} AI score [0-1] lub -1 gdy offline
     */
    async function fetchAiScore(layout, well) {
        var features = buildFeatureVector(layout, well);
        var key = features.join(',');

        var cached = scoreCache.get(key);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.score;
        }

        try {
            var controller = new AbortController();
            var timeoutId = setTimeout(function () {
                controller.abort();
            }, FETCH_TIMEOUT);

            var res = await fetch(SINGLE_PREDICT_URL, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    features: features,
                    wellType: well.type || '',
                    warehouse: well.warehouse || 'KLB',
                    dn: parseInt(well.dn) || 0,
                    featureVersion: FEATURE_VERSION
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                mlOnline = false;
                return -1;
            }

            var data = await res.json();
            if (data.scores && data.scores.length > 0) {
                var s = data.scores[0];
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

    /* ===== BATCH PREDYKCJA (dla rankCandidates) ===== */

    /**
     * Pobiera AI score dla wszystkich kandydatów w 1 requeście.
     * @param {Array<{id:number, solution:Object, technicalScore:number}>} candidates
     * @param {Object} well
     * @returns {Promise<Map<number, number>>} mapa candidateId → aiScore
     */
    async function fetchAiScoresBatch(candidates, well) {
        var resultMap = new Map();
        var toFetch = [];

        for (var i = 0; i < candidates.length; i++) {
            var c = candidates[i];
            var features = buildFeatureVector(c.solution, well);
            var key = features.join(',');

            var cached = scoreCache.get(key);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                resultMap.set(c.id, cached.score);
            } else {
                toFetch.push({
                    id: c.id,
                    features: features,
                    wellType: well.type || '',
                    warehouse: well.warehouse || 'KLB',
                    dn: parseInt(well.dn) || 0
                });
            }
        }

        if (toFetch.length === 0) {
            mlOnline = true;
            return resultMap;
        }

        try {
            var controller = new AbortController();
            var timeoutId = setTimeout(function () {
                controller.abort();
            }, FETCH_TIMEOUT);

            var res = await fetch(BATCH_PREDICT_URL, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidates: toFetch,
                    featureVersion: FEATURE_VERSION
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                mlOnline = false;
                // Fill uncached with -1
                for (var j = 0; j < toFetch.length; j++) {
                    resultMap.set(toFetch[j].id, -1);
                }
                return resultMap;
            }

            var data = await res.json();
            if (data.scores && data.scores.length > 0) {
                mlOnline = true;
                for (var k = 0; k < data.scores.length; k++) {
                    var s = data.scores[k];
                    activeModelVersion = s.version;
                    resultMap.set(s.id, s.score);
                    // Update cache
                    var featKey = toFetch.find(function (t) {
                        return t.id === s.id;
                    });
                    if (featKey) {
                        var fk = featKey.features.join(',');
                        scoreCache.set(fk, { score: s.score, timestamp: Date.now() });
                    }
                }
                // Fill any missing with -1
                for (var l = 0; l < toFetch.length; l++) {
                    if (!resultMap.has(toFetch[l].id)) {
                        resultMap.set(toFetch[l].id, -1);
                    }
                }
            } else {
                mlOnline = false;
                for (var m = 0; m < toFetch.length; m++) {
                    resultMap.set(toFetch[m].id, -1);
                }
            }
        } catch (e) {
            mlOnline = false;
            for (var n = 0; n < toFetch.length; n++) {
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

        var scores = candidates.map(function (c) {
            return c.technicalScore;
        });
        var min = Math.min.apply(null, scores);
        var max = Math.max.apply(null, scores);
        var range = max - min || 1;

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
     *   aiInfluencePct: number,
     *   rankingVersion: string,
     *   featureVersion: string
     * }>}
     */
    async function rankCandidates(opts) {
        var candidates = opts.candidates;
        var well = opts.well;

        if (!candidates || candidates.length === 0) {
            return {
                ranked: [],
                mlOnline: false,
                modelVersion: null,
                aiInfluencePct: 0,
                rankingVersion: RANKING_VERSION,
                featureVersion: FEATURE_VERSION
            };
        }

        // 1. Ustal poziom wpływu AI
        var influencePct = opts.aiInfluencePct;
        if (influencePct === undefined || influencePct === null) {
            influencePct = await getAiInfluencePct();
        }
        aiInfluencePct = influencePct;

        // 2. Limit do MAX_AI_CANDIDATES
        var pool = candidates.slice(0, MAX_AI_CANDIDATES);

        // 3. Normalizacja technical score (min-max w poolu)
        var normalized = normalizeTechnicalScores(pool);

        // 4. Batch predict AI scores
        var aiScoreMap = await fetchAiScoresBatch(pool, well);

        // 5. Oblicz final score
        var aiWeight = influencePct / 100;
        var techWeight = 1 - aiWeight;

        var ranked = normalized.map(function (c) {
            var aiScore = aiScoreMap.get(c.id);
            if (aiScore === undefined) aiScore = -1;

            var finalScore;
            if (aiScore < 0) {
                // ML offline — fallback do technical score
                finalScore = c.technicalScore;
            } else {
                // technicalNormalized: 0=best, 1=worst (lower is better)
                // aiScore: 0=worst, 1=best (higher is better)
                // Konwertuj AI na format "lower is better"
                var aiCost = 1 - aiScore;
                finalScore = techWeight * c.technicalNormalized + aiWeight * aiCost;
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

        return {
            ranked: ranked,
            mlOnline: mlOnline,
            modelVersion: activeModelVersion,
            aiInfluencePct: influencePct,
            rankingVersion: RANKING_VERSION,
            featureVersion: FEATURE_VERSION
        };
    }

    /* ===== EXPLORATION ===== */

    /**
     * Confidence-based exploration.
     * Mała różnica między top-2 → większa szansa na eksplorację.
     *
     * @param {Array<{finalScore:number, solution:Object}>} ranked
     * @returns {{solution:Object, explorationTriggered:boolean, exploredFrom:number|null}}
     */
    function selectWithExploration(ranked) {
        if (!ranked || ranked.length === 0) {
            return { solution: null, explorationTriggered: false, exploredFrom: null };
        }

        var winner = ranked[0];
        var triggered = false;
        var exploredFrom = null;

        if (ranked.length > 1) {
            var gap =
                (ranked[1].finalScore - ranked[0].finalScore) / Math.abs(ranked[0].finalScore || 1);
            var lowConfidence = gap < RELATIVE_GAP_THRESHOLD;
            var rate = lowConfidence ? EXPLORE_RATE_LOW_CONFIDENCE : EXPLORE_RATE_HIGH_CONFIDENCE;

            if (Math.random() < rate) {
                exploredFrom = 0;
                // Losuj z top-5 (lub top-3 gdy wysoka pewność)
                var poolSize = lowConfidence
                    ? Math.min(5, ranked.length)
                    : Math.min(3, ranked.length);
                var randomIdx = 1 + Math.floor(Math.random() * (poolSize - 1));
                winner = ranked[randomIdx];
                triggered = true;
            }
        }

        return {
            solution: winner.solution,
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
     */
    function recordAiRankDecision(opts) {
        if (typeof window.telemetryRecordEvent !== 'function') return;

        var technicalWinnerIdx = -1;
        var aiWinnerIdx = -1;

        if (opts.ranked && opts.ranked.length > 0) {
            for (var i = 0; i < opts.ranked.length; i++) {
                if (opts.ranked[i].solution === opts.technicalWinner) {
                    technicalWinnerIdx = i;
                }
                if (opts.aiWinner && opts.ranked[i].solution === opts.aiWinner) {
                    aiWinnerIdx = i;
                }
            }
        }

        var reason = {
            candidateCount: opts.ranked ? opts.ranked.length : 0,
            technicalWinnerIdx: technicalWinnerIdx,
            aiWinnerIdx: aiWinnerIdx,
            aiInfluencePct: opts.aiInfluencePct,
            modelVersion: opts.modelVersion,
            rankingVersion: opts.rankingVersion,
            featureVersion: opts.featureVersion,
            explorationTriggered: opts.explorationTriggered,
            exploredFrom: opts.exploredFrom,
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

        // Odśwież wskaźnik UI — pokaże modelVersion, online, influence
        if (typeof updateAiStatusIndicator === 'function') {
            updateAiStatusIndicator();
        }
    }

    /* ===== WARSTWA ZGODNOŚCI (zachowanie starych API) ===== */

    /**
     * Stary interfejs — wzbogaca layout o AI score (telemetry, nie zmienia wyboru).
     * @deprecated Użyj rankCandidates() zamiast.
     */
    async function mlEnrichLayout(layout, well) {
        var aiScore = await fetchAiScore(layout, well);
        layout._aiScore = aiScore;
        layout._mlOnline = mlOnline;
        layout._modelVersion = activeModelVersion;
        return layout;
    }

    /**
     * Stary interfejs — ranking layoutów (zachowany dla kompatybilności).
     * @deprecated Użyj rankCandidates() zamiast.
     */
    async function mlRankLayouts(layouts, well) {
        if (!layouts || layouts.length === 0) return layouts;

        var candidates = layouts.map(function (l, idx) {
            return { id: idx, solution: l, technicalScore: l.score || l._score || 0 };
        });

        var result = await rankCandidates({ candidates: candidates, well: well });
        return result.ranked.map(function (r) {
            return r.solution;
        });
    }

    /**
     * Status systemu ML
     * @returns {{online:boolean, modelVersion:string|null, cacheSize:number, aiInfluencePct:number, rankingVersion:string}}
     */
    function getMlStatus() {
        return {
            online: mlOnline,
            modelVersion: activeModelVersion,
            cacheSize: scoreCache.size,
            aiInfluencePct: aiInfluencePct,
            rankingVersion: RANKING_VERSION
        };
    }

    /* ===== WSKAŹNIK AI W UI ===== */

    /**
     * Aktualizuje mały wskaźnik obok przycisku Auto w kreatorze studni.
     * Pokazuje: online/offline, poziom wpływu, model version, learning status.
     * Wywoływane okresowo i po każdym rankingu.
     */
    function updateAiStatusIndicator() {
        var dot = document.getElementById('ai-status-dot');
        var text = document.getElementById('ai-status-text');
        if (!dot || !text) return;

        var status = getMlStatus();
        var title = '';

        if (status.online) {
            if (status.aiInfluencePct > 0) {
                dot.style.background = '#10b981';
                text.textContent = 'AI ' + status.aiInfluencePct + '%';
                title = 'AI ranking aktywny (' + status.aiInfluencePct + '%)';
            } else {
                dot.style.background = '#6b7280';
                text.textContent = 'AI Shadow';
                title = 'AI online, tryb shadow (0%) — tylko obserwacja';
            }
            title +=
                ' | model: ' +
                (status.modelVersion || '?') +
                ' | ranking: ' +
                status.rankingVersion;

            // Oznacz czy model jest świeży (uczenie aktywne)
            if (status.cacheSize > 0) {
                dot.style.boxShadow =
                    '0 0 4px ' + (status.aiInfluencePct > 0 ? '#10b981' : '#6b7280');
            }
        } else {
            dot.style.background = '#9ca3af';
            dot.style.boxShadow = 'none';
            text.textContent = 'AI Offline';
            title = 'Brak wytrenowanego modelu ML — ranking techniczny';
        }

        text.title = title + '\nKliknij Auto, aby uruchomić solver z AI rankingiem';

        // W tle sprawdź learning status (baza wiedzy)
        fetchLearningStatusAsync();
    }

    /**
     * W tle sprawdza czy LearningEngine wykrył wzorce — aktualizuje tooltip.
     */
    var _lastLearningCheck = 0;

    function fetchLearningStatusAsync() {
        var now = Date.now();
        if (now - _lastLearningCheck < 60000) return; // max co 60s
        _lastLearningCheck = now;

        try {
            var controller = new AbortController();
            var timeoutId = setTimeout(function () {
                controller.abort();
            }, 3000);
            fetch('/api/telemetry/ai/knowledge/stats', {
                credentials: 'same-origin',
                signal: controller.signal
            })
                .then(function (r) {
                    return r.ok ? r.json() : null;
                })
                .then(function (stats) {
                    clearTimeout(timeoutId);
                    var text = document.getElementById('ai-status-text');
                    if (!text || !stats) return;
                    var existing = text.title || '';
                    text.title =
                        existing.split('\n')[0] +
                        '\nWzorce AI: ' +
                        (stats.active || 0) +
                        ' aktywnych, ' +
                        (stats.total || 0) +
                        ' total' +
                        '\nConfidence: ' +
                        (stats.avgConfidence ? Math.round(stats.avgConfidence * 100) + '%' : '—') +
                        '\nRekomendacje: ' +
                        (stats.acceptedRecommendations || 0) +
                        '/' +
                        (stats.totalRecommendations || 0) +
                        ' zaakc.';
                })
                .catch(function () {
                    clearTimeout(timeoutId);
                });
        } catch (e) {
            /* ignoruj */
        }
    }

    /**
     * Odświeża wskaźnik AI okresowo (co 30s).
     */
    function startAiStatusPoller() {
        updateAiStatusIndicator();
        setInterval(updateAiStatusIndicator, 30000);
    }

    // Uruchom po załadowaniu DOM
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(startAiStatusPoller, 2000); // 2s delay — daj czas na init
    } else {
        document.addEventListener('DOMContentLoaded', startAiStatusPoller);
    }

    /* ===== EKSPORT ===== */

    // Nowe API (główne)
    window.rankCandidates = rankCandidates;
    window.recordAiRankDecision = recordAiRankDecision;
    window.selectWithExploration = selectWithExploration;
    window.getAiInfluencePct = getAiInfluencePct;
    window.updateAiStatusIndicator = updateAiStatusIndicator;

    // Stare API (kompatybilność)
    window.mlEnrichLayout = mlEnrichLayout;
    window.mlRankLayouts = mlRankLayouts;
    window.getMlStatus = getMlStatus;
    window.fetchAiScore = fetchAiScore;
})();
