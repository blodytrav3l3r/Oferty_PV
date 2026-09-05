// @ts-check
/**
 * mlRewardHooks.js — Reward signals za decyzje użytkownika.
 *
 * Hookuje się w wellActions.js: addWellComponent, removeWellComponent,
 * oraz w zdarzenia akceptacji/odrzucenia studni.
 *
 * Reward: +1.0 ACCEPT (AI), +0.5 ACCEPT (manual)
 *         -1.0 REJECT
 *         -0.3 MODIFY (bez scoreBefore/scoreAfter)
 *         +/-0.5..0.5 MODIFY z poprawą (improvement*0.1, clamp)
 *         -0.2 SWAP
 */

(function () {
    'use strict';

    const REWARD_URL = '/api/telemetry/ai/reward';
    const REWARD_BATCH_URL = '/api/telemetry/ai/reward-batch';
    const REWARD_BATCH_CAP = 500;
    const TIMEOUT_MS = 1000;

    /**
     * Studnie z rewardem w locie — dedup PER STUDNIA (wellId), nie globalny.
     * Globalny single-flight gubił nagrody przy pętlach przez wiele studni
     * (zapis oferty/zamówienia) — tylna studnia była cicho pomijana.
     */
    const _rewardInFlightByWell = new Set();

    /* ===== KOLEJKA CONCURRENCY (safety net, nie substytut batchowania) =====
     * Chroni przed wyczerpaniem socketów (ERR_INSUFFICIENT_RESOURCES), gdyby
     * jakaś ścieżka wywołała sendReward w hurtowej pętli. Bulk idzie przez
     * sendRewardBatch (O(N/500) requestów); kolejka to druga linia obrony. */
    const MAX_CONCURRENT_REWARDS = 4;
    let _activeRewardRequests = 0;
    const _rewardQueue = [];

    function _processRewardQueue() {
        if (_activeRewardRequests >= MAX_CONCURRENT_REWARDS || _rewardQueue.length === 0) return;
        const task = _rewardQueue.shift();
        if (!task) return;
        _activeRewardRequests++;
        task().finally(function () {
            _activeRewardRequests--;
            _processRewardQueue();
        });
    }

    /**
     * Wysyła sygnał nagrody do backendu
     * @param {Object} params
     * @param {string} params.action - ACCEPT | REJECT | MODIFY | ADJUST | SWAP
     * @param {number} [params.scoreBefore]
     * @param {number} [params.scoreAfter]
     * @param {boolean} [params.wasAiRanked]
     * @param {string} [params.eventType] - OFFER_SAVED | ORDER_CONFIRMED
     * @param {Object} [params.aiRankSnapshot] - ostatnia decyzja AI_RANK_DECISION
     * @param {Object} [params.well] - studnia, której dotyczy sygnał (priorytet nad getCurrentWell)
     */
    /**
     * Buduje payload rewardu dla studni — współdzielony przez sendReward
     * i sendRewardBatch (parzystość single/batch). Zwraca null gdy brak studni.
     */
    function buildRewardPayload(params, well) {
        const w =
            well ||
            (params && params.well) ||
            (typeof getCurrentWell === 'function' ? getCurrentWell() : null);
        if (!w) return null;

        const snap = Object.assign({}, getConfigSnapshot(w));
        if (params.eventType) {
            snap.eventType = params.eventType;
        }

        // Dołącz snapshot ostatniej decyzji AI rankingu
        if (params.aiRankSnapshot) {
            snap.aiRankSnapshot = params.aiRankSnapshot;
        }

        // scoreBefore/scoreAfter z ostatniej decyzji rankingu (well._aiRankInfo ustawiany
        // w solverAutoSelect.js po AI DUAL-RANKING). Jawna wartość z callera ma priorytet.
        // To odblokowuje sliding AUC / auto-rollback w SelfEvaluation (backend /ai/reward).
        const rankInfo = (w && w._aiRankInfo) || {};
        const scoreBefore =
            params.scoreBefore !== undefined ? params.scoreBefore : rankInfo.scoreBefore;
        const scoreAfter =
            params.scoreAfter !== undefined ? params.scoreAfter : rankInfo.scoreAfter;

        // Domyślna wartość wasAiRanked wyprowadzana z configSource studni (AUTO_AI = dobór
        // z rankingiem AI). Jawna wartość z callera ma priorytet — flaga jest wtedy spójna
        // z konkretną studnią akceptowaną w pętli (np. zapis oferty/wielu studni).
        const wasAiRanked =
            params.wasAiRanked !== undefined ? !!params.wasAiRanked : w.configSource === 'AUTO_AI';

        return {
            action: params.action,
            wellId: w.id || 'unknown',
            dn: parseInt(w.dn) || 0,
            scoreBefore: scoreBefore,
            scoreAfter: scoreAfter,
            wasAiRanked: wasAiRanked,
            configSnapshot: snap,
            // MODIFY/REJECT odnoszą się do sugestii AUTO — backend etykietuje
            // wiersz sugestii (parentConfigId), nie najnowszy finalny config.
            parentConfigId:
                (params.action === 'MODIFY' || params.action === 'REJECT') && w._lastAutoTelemetryId
                    ? w._lastAutoTelemetryId
                    : undefined
        };
    }

    function sendReward(params) {
        const payload = buildRewardPayload(params || {}, null);
        if (!payload) return;

        const wellKey = payload.wellId;
        if (_rewardInFlightByWell.has(wellKey)) return;
        _rewardInFlightByWell.add(wellKey);

        _rewardQueue.push(function () {
            return postReward(payload).finally(function () {
                _rewardInFlightByWell.delete(wellKey);
            });
        });
        _processRewardQueue();
    }

    function postReward(payload) {
        try {
            if (!window.fetch) return Promise.resolve();
            const controller = new AbortController();
            const timeoutId = setTimeout(function () {
                controller.abort();
            }, TIMEOUT_MS);

            return fetch(REWARD_URL, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify(payload),
                signal: controller.signal
            })
                .then(function () {
                    clearTimeout(timeoutId);
                })
                .catch(function () {
                    clearTimeout(timeoutId);
                });
        } catch (_e) {
            return Promise.resolve();
        }
    }

    /**
     * Hurtowa wysyłka rewardów: O(N/500) sekwencyjnych requestów zamiast N.
     * Filtruje studnie BEZ potwierdzonego wiersza telemetry
     * (well._lastAutoTelemetryId ustawiane TYLKO z odpowiedzi serwera po
     * persystencji) — takie rewardy backend i tak odrzuca 400 WELL_NOT_FOUND,
     * więc ich wysyłka to czysty koszt. Eliminuje race telemetry→reward
     * z konstrukcji (nie zależy od kolejności wywołania).
     * @param {Array} wells
     * @param {Object} opts {action, eventType, wasAiRanked?: (well)=>boolean}
     * @returns {Promise<{sent:number, skippedNoTelemetry:number, chunks:number}>}
     */
    function sendRewardBatch(wells, opts) {
        opts = opts || {};
        if (!Array.isArray(wells) || wells.length === 0)
            return Promise.resolve({ sent: 0, skippedNoTelemetry: 0, chunks: 0 });

        const eligible = [];
        let skippedNoTelemetry = 0;
        wells.forEach(function (w) {
            if (!w || !Array.isArray(w.config) || w.config.length === 0) return;
            // Dowód persystencji wiersza telemetry — bez tego backend zwróci 400.
            if (!w._lastAutoTelemetryId) {
                skippedNoTelemetry++;
                return;
            }
            const payload = buildRewardPayload(
                {
                    action: opts.action || 'ACCEPT',
                    eventType: opts.eventType,
                    wasAiRanked:
                        typeof opts.wasAiRanked === 'function'
                            ? opts.wasAiRanked(w)
                            : w.configSource === 'AUTO_AI'
                },
                w
            );
            if (payload) eligible.push(payload);
        });
        if (eligible.length === 0) {
            return Promise.resolve({ sent: 0, skippedNoTelemetry, chunks: 0 });
        }

        const chunks = [];
        for (let i = 0; i < eligible.length; i += REWARD_BATCH_CAP) {
            chunks.push(eligible.slice(i, i + REWARD_BATCH_CAP));
        }

        // Sekwencyjnie — chunk za chunkiem, nigdy równolegle.
        let chain = Promise.resolve();
        const summary = { sent: 0, skippedNoTelemetry, chunks: chunks.length };
        chunks.forEach(function (chunk) {
            chain = chain.then(function () {
                return postRewardBatch(chunk, false).then(function (res) {
                    summary.sent += res.sent;
                    // Jednorazowy batchowany retry dla WELL_NOT_FOUND (rezydualny race).
                    if (res.retryItems.length > 0) {
                        return postRewardBatch(res.retryItems, true).then(function (retryRes) {
                            summary.sent += retryRes.sent;
                        });
                    }
                    return undefined;
                });
            });
        });
        return chain.then(function () {
            return summary;
        });
    }

    function postRewardBatch(items, isRetry) {
        const body = { items: items };
        try {
            if (!window.fetch) return Promise.resolve({ sent: 0, retryItems: [] });
            const controller = new AbortController();
            const timeoutId = setTimeout(function () {
                controller.abort();
            }, TIMEOUT_MS * 5);
            return fetch(REWARD_BATCH_URL, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify(body),
                signal: controller.signal
            })
                .then(function (response) {
                    clearTimeout(timeoutId);
                    if (!response || typeof response.json !== 'function') {
                        return { sent: 0, retryItems: [] };
                    }
                    return response.json().catch(function () {
                        return null;
                    });
                })
                .then(function (json) {
                    if (!json) return { sent: 0, retryItems: [] };
                    const applied = Array.isArray(json.applied) ? json.applied : [];
                    const rejected = Array.isArray(json.rejected) ? json.rejected : [];
                    let retryItems = [];
                    if (!isRetry) {
                        const retryIds = {};
                        rejected.forEach(function (r) {
                            if (r && r.reason === 'WELL_NOT_FOUND' && r.wellId) {
                                retryIds[r.wellId] = true;
                            }
                        });
                        retryItems = items.filter(function (it) {
                            return retryIds[it.wellId];
                        });
                    }
                    return { sent: applied.length, retryItems };
                })
                .catch(function () {
                    return { sent: 0, retryItems: [] };
                });
        } catch (_e) {
            return Promise.resolve({ sent: 0, retryItems: [] });
        }
    }

    /**
     * Tworzy snapshot konfiguracji studni
     * @param {Object} well
     * @returns {Object}
     */
    function getConfigSnapshot(well) {
        if (!well) return {};
        return {
            dn: well.dn,
            height: well.wellHeight,
            type: well.type,
            warehouse: well.warehouse,
            ringCount: (well.config || []).length,
            configSource: well.configSource,
            reduction: well.redukcjaDN1000
        };
    }

    /**
     * Hook: studnia zaakceptowana przez użytkownika
     * @param {Object} [opts]
     * @param {number} [opts.scoreBefore]
     * @param {number} [opts.scoreAfter]
     * @param {boolean} [opts.wasAiRanked]
     * @param {string} [opts.eventType]
     * @param {Object} [opts.aiRankSnapshot]
     * @param {Object} [opts.well] - studnia, której dotyczy akceptacja (pętle wielu studni)
     */
    function onWellAccepted(opts) {
        sendReward({
            action: 'ACCEPT',
            scoreBefore: opts && opts.scoreBefore,
            scoreAfter: opts && opts.scoreAfter,
            wasAiRanked: opts && opts.wasAiRanked,
            eventType: opts && opts.eventType,
            aiRankSnapshot: opts && opts.aiRankSnapshot,
            well: opts && opts.well
        });
    }

    /**
     * Hook: studnia odrzucona
     * @param {Object} [opts]
     * @param {number} [opts.scoreBefore]
     * @param {number} [opts.scoreAfter]
     * @param {boolean} [opts.wasAiRanked]
     * @param {Object} [opts.aiRankSnapshot]
     * @param {Object} [opts.well] - studnia, której dotyczy odrzucenie
     */
    function onWellRejected(opts) {
        sendReward({
            action: 'REJECT',
            scoreBefore: opts && opts.scoreBefore,
            scoreAfter: opts && opts.scoreAfter,
            wasAiRanked: opts && opts.wasAiRanked,
            aiRankSnapshot: opts && opts.aiRankSnapshot,
            well: opts && opts.well
        });
    }

    /**
     * Hook: modyfikacja konfiguracji
     * @param {number} [_modCount]
     */
    function onWellModified(_modCount) {
        sendReward({
            action: 'MODIFY',
            wasAiRanked: false
        });
    }

    /**
     * Hook: zamiana komponentu
     */
    function onWellSwap() {
        sendReward({
            action: 'SWAP',
            wasAiRanked: false
        });
    }

    // Eksport do window
    window.mlRewardHooks = {
        onWellAccepted: onWellAccepted,
        onWellRejected: onWellRejected,
        onWellModified: onWellModified,
        onWellSwap: onWellSwap,
        sendReward: sendReward,
        sendRewardBatch: sendRewardBatch,
        buildRewardPayload: buildRewardPayload,
        REWARD_BATCH_CAP: REWARD_BATCH_CAP
    };
})();
