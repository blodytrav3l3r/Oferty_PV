// @ts-check
/**
 * mlDualRankingApi.js — AI Dual-Ranking API (config, features, prediction)
 *
 * Zależności: window.fetch
 */

/* ===== KONFIGURACJA ===== */

var BATCH_PREDICT_URL = '/api/telemetry/ai/predict/batch';
var SINGLE_PREDICT_URL = '/api/telemetry/ai/predict';
var SETTINGS_URL = '/api/telemetry/ai/settings';
var FETCH_TIMEOUT = 3000;

var MAX_AI_CANDIDATES = 10;
var MIN_AI_CANDIDATES = 3;

var RELATIVE_GAP_THRESHOLD = 0.1;
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

/* ===== FEATURE FLAG ===== */

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
    var urlMatch = window.location.search.match(/[?&]ai_influence=(\d+)/);
    if (urlMatch) return parseInt(urlMatch[1], 10);
    var local = window.localStorage.getItem('wells_ai_influence');
    if (local !== null) {
        var p = parseInt(local, 10);
        if (!isNaN(p) && p >= 0 && p <= 100) return p;
    }
    var backend = await fetchAiInfluenceFromBackend();
    if (backend !== null && backend >= 0 && backend <= 100) return backend;
    return 0;
}

/* ===== BUDOWA WEKTORA CECH ===== */

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

async function fetchAiScore(layout, well) {
    var features = buildFeatureVector(layout, well);
    var key = features.join(',');
    var cached = scoreCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.score;

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
            body: JSON.stringify({ candidates: toFetch, featureVersion: FEATURE_VERSION }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
            mlOnline = false;
            for (var j = 0; j < toFetch.length; j++) resultMap.set(toFetch[j].id, -1);
            return resultMap;
        }
        var data = await res.json();
        if (data.scores && data.scores.length > 0) {
            mlOnline = true;
            for (var k = 0; k < data.scores.length; k++) {
                var s = data.scores[k];
                activeModelVersion = s.version;
                resultMap.set(s.id, s.score);
                var featKey = toFetch.find(function (t) {
                    return t.id === s.id;
                });
                if (featKey) {
                    var fk = featKey.features.join(',');
                    scoreCache.set(fk, { score: s.score, timestamp: Date.now() });
                }
            }
            for (var l = 0; l < toFetch.length; l++) {
                if (!resultMap.has(toFetch[l].id)) resultMap.set(toFetch[l].id, -1);
            }
        } else {
            mlOnline = false;
            for (var m = 0; m < toFetch.length; m++) resultMap.set(toFetch[m].id, -1);
        }
    } catch (e) {
        mlOnline = false;
        for (var n = 0; n < toFetch.length; n++) resultMap.set(toFetch[n].id, -1);
    }
    return resultMap;
}
