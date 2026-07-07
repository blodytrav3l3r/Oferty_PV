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

    /** @type {boolean} flaga do unikania duplikatów */
    var _rewardInFlight = false;

    /**
     * Wysyła sygnał nagrody do backendu
     * @param {Object} params
     * @param {string} params.action - ACCEPT | REJECT | MODIFY | ADJUST | SWAP
     * @param {number} [params.scoreBefore]
     * @param {number} [params.scoreAfter]
     * @param {boolean} [params.wasAiRanked]
     */
    function sendReward(params) {
        if (_rewardInFlight) return;

        var well = typeof getCurrentWell === 'function' ? getCurrentWell() : null;
        if (!well) return;

        _rewardInFlight = true;

        var payload = {
            action: params.action,
            wellId: well.id || 'unknown',
            dn: parseInt(well.dn) || 0,
            scoreBefore: params.scoreBefore,
            scoreAfter: params.scoreAfter,
            wasAiRanked: params.wasAiRanked,
            configSnapshot: getConfigSnapshot(well)
        };

        try {
            var controller = new AbortController();
            var timeoutId = setTimeout(function () {
                controller.abort();
            }, TIMEOUT_MS);

            fetch(REWARD_URL, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            })
                .then(function () {
                    clearTimeout(timeoutId);
                    _rewardInFlight = false;
                })
                .catch(function () {
                    _rewardInFlight = false;
                });
        } catch (e) {
            _rewardInFlight = false;
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
     */
    function onWellAccepted(opts) {
        sendReward({
            action: 'ACCEPT',
            scoreBefore: opts && opts.scoreBefore,
            scoreAfter: opts && opts.scoreAfter,
            wasAiRanked: opts && opts.wasAiRanked
        });
    }

    /**
     * Hook: studnia odrzucona
     * @param {Object} [opts]
     */
    function onWellRejected(opts) {
        sendReward({
            action: 'REJECT',
            scoreBefore: opts && opts.scoreBefore,
            scoreAfter: opts && opts.scoreAfter,
            wasAiRanked: opts && opts.wasAiRanked
        });
    }

    /**
     * Hook: modyfikacja konfiguracji
     * @param {number} [modCount]
     */
    function onWellModified(modCount) {
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
