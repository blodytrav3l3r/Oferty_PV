// @ts-check
/**
 * mlRewardHooks.js — Reward signals za decyzje użytkownika.
 *
 * Hookuje się w wellActions.js: addWellComponent, removeWellComponent,
 * oraz w zdarzenia akceptacji/odrzucenia studni.
 *
 * Reward: +1.0 ACCEPT (AI), +0.5 ACCEPT (manual)
 *         -1.0 REJECT
 *         -0.3 MODIFY (>=2 modyfikacje)
 *         -0.2 SWAP
 *         +0.2 MODIFY (<2 modyfikacje)
 */

(function () {
    'use strict';

    const REWARD_URL = '/api/telemetry/ai/reward';
    const TIMEOUT_MS = 1000;

    /**
     * Studnie z rewardem w locie — dedup PER STUDNIA (wellId), nie globalny.
     * Globalny single-flight gubił nagrody przy pętlach przez wiele studni
     * (zapis oferty/zamówienia) — tylna studnia była cicho pomijana.
     */
    const _rewardInFlightByWell = new Set();

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
    function sendReward(params) {
        const well =
            params && params.well
                ? params.well
                : typeof getCurrentWell === 'function'
                  ? getCurrentWell()
                  : null;
        if (!well) return;

        const wellKey = well.id || 'well-anon';
        if (_rewardInFlightByWell.has(wellKey)) return;
        _rewardInFlightByWell.add(wellKey);

        const snap = Object.assign({}, getConfigSnapshot(well));
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
        const rankInfo = (well && well._aiRankInfo) || {};
        const scoreBefore =
            params.scoreBefore !== undefined ? params.scoreBefore : rankInfo.scoreBefore;
        const scoreAfter =
            params.scoreAfter !== undefined ? params.scoreAfter : rankInfo.scoreAfter;

        // Domyślna wartość wasAiRanked wyprowadzana z configSource studni (AUTO_AI = dobór
        // z rankingiem AI). Jawna wartość z callera ma priorytet — flaga jest wtedy spójna
        // z konkretną studnią akceptowaną w pętli (np. zapis oferty/wielu studni).
        const wasAiRanked =
            params.wasAiRanked !== undefined
                ? !!params.wasAiRanked
                : well.configSource === 'AUTO_AI';

        const payload = {
            action: params.action,
            wellId: well.id || 'unknown',
            dn: parseInt(well.dn) || 0,
            scoreBefore: scoreBefore,
            scoreAfter: scoreAfter,
            wasAiRanked: wasAiRanked,
            configSnapshot: snap
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(function () {
                controller.abort();
            }, TIMEOUT_MS);

            fetch(REWARD_URL, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify(payload),
                signal: controller.signal
            })
                .then(function () {
                    clearTimeout(timeoutId);
                    _rewardInFlightByWell.delete(wellKey);
                })
                .catch(function () {
                    clearTimeout(timeoutId);
                    _rewardInFlightByWell.delete(wellKey);
                });
        } catch (_e) {
            _rewardInFlightByWell.delete(wellKey);
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
        sendReward: sendReward
    };
})();
