// @ts-check
/**
 * mlDualRanking.js — AI Dual-Ranking (ranking, exploration, UI, eksport)
 *
 * Zależności: mlDualRankingApi.js (scoreCache, mlOnline, activeModelVersion,
 *   aiInfluencePct, getAiInfluencePct, fetchAiScoresBatch, fetchAiScore)
 */

/* ===== NORMALIZACJA TECHNICAL SCORE ===== */

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
            technicalNormalized: (c.technicalScore - min) / range
        };
    });
}

/* ===== GŁÓWNY RANKING ===== */

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
    var influencePct = opts.aiInfluencePct;
    if (influencePct === undefined || influencePct === null) {
        influencePct = await getAiInfluencePct();
    }
    aiInfluencePct = influencePct;
    var pool = candidates.slice(0, MAX_AI_CANDIDATES);
    var normalized = normalizeTechnicalScores(pool);
    var aiScoreMap = await fetchAiScoresBatch(pool, well);
    var aiWeight = influencePct / 100;
    var techWeight = 1 - aiWeight;
    var ranked = normalized.map(function (c) {
        var aiScore = aiScoreMap.get(c.id);
        if (aiScore === undefined) aiScore = -1;
        var finalScore;
        if (aiScore < 0) {
            finalScore = c.technicalScore;
        } else {
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

function selectWithExploration(ranked) {
    if (!ranked || ranked.length === 0)
        return { solution: null, explorationTriggered: false, exploredFrom: null };
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
            var poolSize = lowConfidence ? Math.min(5, ranked.length) : Math.min(3, ranked.length);
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

/* ===== REJESTRACJA DECYZJI AI ===== */

function recordAiRankDecision(opts) {
    if (typeof window.telemetryRecordEvent !== 'function') return;
    var technicalWinnerIdx = -1;
    var aiWinnerIdx = -1;
    if (opts.ranked && opts.ranked.length > 0) {
        for (var i = 0; i < opts.ranked.length; i++) {
            if (opts.ranked[i].solution === opts.technicalWinner) technicalWinnerIdx = i;
            if (opts.aiWinner && opts.ranked[i].solution === opts.aiWinner) aiWinnerIdx = i;
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
    if (typeof updateAiStatusIndicator === 'function') updateAiStatusIndicator();
}

/* ===== WARSTWA ZGODNOŚCI ===== */

async function mlEnrichLayout(layout, well) {
    var aiScore = await fetchAiScore(layout, well);
    layout._aiScore = aiScore;
    layout._mlOnline = mlOnline;
    layout._modelVersion = activeModelVersion;
    return layout;
}

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
            ' | model: ' + (status.modelVersion || '?') + ' | ranking: ' + status.rankingVersion;
        if (status.cacheSize > 0) {
            dot.style.boxShadow = '0 0 4px ' + (status.aiInfluencePct > 0 ? '#10b981' : '#6b7280');
        }
    } else {
        dot.style.background = '#9ca3af';
        dot.style.boxShadow = 'none';
        text.textContent = 'AI Offline';
        title = 'Brak wytrenowanego modelu ML — ranking techniczny';
    }
    text.title = title + '\nKliknij Auto, aby uruchomić solver z AI rankingiem';
    fetchLearningStatusAsync();
}

var _lastLearningCheck = 0;

function fetchLearningStatusAsync() {
    var now = Date.now();
    if (now - _lastLearningCheck < 60000) return;
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

function startAiStatusPoller() {
    updateAiStatusIndicator();
    setInterval(updateAiStatusIndicator, 30000);
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(startAiStatusPoller, 2000);
} else {
    document.addEventListener('DOMContentLoaded', startAiStatusPoller);
}

/* ===== EKSPORT ===== */

window.rankCandidates = rankCandidates;
window.recordAiRankDecision = recordAiRankDecision;
window.selectWithExploration = selectWithExploration;
window.getAiInfluencePct = getAiInfluencePct;
window.updateAiStatusIndicator = updateAiStatusIndicator;
window.mlEnrichLayout = mlEnrichLayout;
window.mlRankLayouts = mlRankLayouts;
window.getMlStatus = getMlStatus;
window.fetchAiScore = fetchAiScore;
