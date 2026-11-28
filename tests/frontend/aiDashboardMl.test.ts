/**
 * @jest-environment jsdom
 */
// @ts-nocheck
/**
 * P1.4 — metryki ML jako osobne karty (ROC-AUC vs baseline accuracy).
 * Regresja: zakaz odejmowania różnych metryk ("Baseline vs Model … pp").
 * Wzorzec VM jak aiTransfer.test.ts; DOM z jsdom.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { describe, expect, it, beforeEach } from '@jest/globals';

const STATUS = {
    mlOnline: true,
    aiInfluencePct: 40,
    modelVersion: 'v1',
    activeModelAuc: 0.8421,
    baselineAccuracy: 0.731,
    activeModelMetrics: { testRocAuc: 0.76, prAuc: 0.7, f1: 0.6, logLoss: 0.5, ece: 0.1 },
    trainingRunning: false,
    labeledCount: 120,
    featureCount: 200,
    labelCounts: { accepted: 10, rejected: 2, modified: 3, noFeedback: 5 },
    totalRewards: 5,
    trainingRows: 80,
    rollbackTargetVersion: 'rollback-v1',
    lastTrainingSnapshot: {
        datasetSize: 115,
        trainSize: 80,
        validationSize: 17,
        testSize: 18,
        candidateModelVersion: 'v1',
        groupOverlapDiagnostics: {
            version: 1,
            status: 'available',
            totalRows: 115,
            rowsWithTelemetry: 115,
            well: { groupsAcrossSplits: 2 },
            offer: { groupsAcrossSplits: 1 }
        }
    },
    cacheSize: 6,
    trainingGate: {
        eligible: true,
        reason: 'ok',
        newSinceLastTrain: 10,
        minNewData: 50,
        hoursSinceLastTrain: 5,
        minHoursSinceLastTrain: 4,
        nextEligibleAt: null,
        lastAttempt: null
    }
};

function loadMl() {
    const code = fs.readFileSync(
        path.resolve(__dirname, '../../public/js/admin/aiDashboardMl.js'),
        'utf8'
    );
    let fetchJson = (url) => Promise.resolve(url === '/ml-status' ? STATUS : { models: [] });
    let confirmMessage = '';
    let rollbackRequestBody = null;
    const sandbox = {
        window: {
            AI_ENDPOINTS: {
                mlStatus: '/ml-status',
                models: '/models',
                train: '/train',
                rollback: '/rollback',
                predictionsStats: '/prediction-stats'
            },
            fetchJson: (url, options) => fetchJson(url, options),
            aiLoadingHtml: () => '<div>loading</div>',
            aiApiErrorHtml: (e) => '<div>error:' + e + '</div>',
            aiStatCard: (title, value) =>
                '<div class="ai-stat-card"><div>' + value + '</div><div>' + title + '</div></div>',
            aiStatusBadge: (ok) => (ok ? 'Online' : 'Offline'),
            escapeHtml: (s) => String(s),
            aiEscapeHtmlAttr: (s) => String(s).replace(/"/g, '&quot;'),
            aiSafeJson: (s) => {
                try {
                    return JSON.parse(s);
                } catch {
                    return null;
                }
            },
            aiUiConfirm: (message) => {
                confirmMessage = message;
                return Promise.resolve(true);
            },
            aiUiAlert: () => Promise.resolve(),
            // Panele z mlPanels.js — poza zakresem tego testu.
            aiRenderTrainingSources: () => {},
            aiRenderTrainingRuns: () => {},
            aiRenderFeatureImportance: () => {},
            aiRenderDrift: () => {}
        },
        document,
        lucide: undefined,
        setTimeout
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'aiDashboardMl.js' });
    return {
        win: sandbox.window,
        getConfirmMessage: () => confirmMessage,
        getRollbackRequestBody: () => rollbackRequestBody,
        setRollbackRequestBody: (body) => {
            rollbackRequestBody = body;
        },
        setFetchJson: (nextFetchJson) => {
            fetchJson = nextFetchJson;
        }
    };
}

function tick(ms = 20) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('aiDashboardMl metryki', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('ROC-AUC i baseline jako osobne karty, bez odejmowania i bez pp', async () => {
        const { win } = loadMl();
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();
        const html = host.innerHTML;
        expect(html).toContain('ROC-AUC modelu');
        expect(html).toContain('0.8421');
        expect(html).toContain('Baseline accuracy');
        expect(html).toContain('0.7310');
        expect(html).toContain('ROC-AUC testowy');
        expect(html).toContain('0.7600');
        expect(host.querySelectorAll('h5.ai-ml-group-label')).toHaveLength(4);
        expect(html).not.toContain('Baseline vs Model');
        expect(html).not.toContain(' pp');
    });

    it('ujawnia pochodzenie metryk: walidacja modelu i baseline na danych treningowych', async () => {
        const { win } = loadMl();
        const host = document.createElement('div');
        document.body.appendChild(host);

        win.aiRenderMlStatus(host);
        await tick();

        expect(host.textContent).toContain('ROC-AUC, PR-AUC, F1, LogLoss i ECE: walidacja n=17');
        expect(host.textContent).toContain('ROC-AUC testowy: niezależny zbiór testowy n=18');
        expect(host.textContent).toContain('Baseline accuracy: zbiór treningowy n=80');
        expect(host.textContent).toContain('model v1');
    });

    it('distingue historię, nowe dane kwalifikujące się i ostatni snapshot oraz opisuje reward jako licznik', async () => {
        const { win } = loadMl();
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();
        expect(host.textContent).toContain('Wszystkie wektory historyczne');
        expect(host.textContent).toContain('Nowe kwalifikujące się od SUCCESS');
        expect(host.textContent).toContain('Próbki ostatniego snapshotu');
        expect(host.textContent).toContain('Grupy w wielu zbiorach');
        expect(host.textContent).toContain('2 / 1');
        expect(host.textContent).toContain('115');
        expect(host.textContent).toContain('Zdarzenia reward');
        expect(host.textContent).not.toContain('Suma nagród');
    });

    it('utrzymuje stan ładowania do odpowiedzi wolnego endpointu statusu', async () => {
        let resolveStatus;
        const statusRequest = new Promise((resolve) => {
            resolveStatus = resolve;
        });
        const { win, setFetchJson } = loadMl();
        setFetchJson((url) =>
            url === '/ml-status' ? statusRequest : Promise.resolve({ models: [] })
        );
        const host = document.createElement('div');
        document.body.appendChild(host);

        win.aiRenderMlStatus(host);

        expect(host.textContent).toContain('loading');
        expect(host.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
        resolveStatus(STATUS);
        await tick();
        expect(host.textContent).toContain('ML Pipeline');
        expect(host.querySelector('[role="status"][aria-live="polite"]')?.textContent).toContain(
            'wczytane'
        );
    });

    it('pokazuje jawny błąd, gdy początkowe pobranie statusu jest niedostępne', async () => {
        const { win, setFetchJson } = loadMl();
        setFetchJson((url) =>
            Promise.resolve(url === '/ml-status' ? { error: 'unavailable' } : { models: [] })
        );
        const host = document.createElement('div');
        document.body.appendChild(host);

        win.aiRenderMlStatus(host);
        await tick();

        expect(host.textContent).toContain('error:unavailable');
        expect(host.querySelector('[role="alert"]')).not.toBeNull();
        expect(host.querySelector('.ai-ml-refresh-btn')).toBeNull();
    });

    it('pokazuje pusty stan modeli bez ukrywania dostępnych akcji admina', async () => {
        const { win, setFetchJson } = loadMl();
        setFetchJson((url) => Promise.resolve(url === '/ml-status' ? STATUS : { models: [] }));
        const host = document.createElement('div');
        document.body.appendChild(host);

        win.aiRenderMlStatus(host);
        await tick();

        expect(host.querySelector('.ai-model-empty').textContent).toContain(
            'Brak wytrenowanych modeli'
        );
        expect(host.querySelector('#ai-ml-train-btn').textContent).toContain('Uruchom trening ML');
    });

    it('odświeża ręcznie i zachowuje ostatnie dane jako stale po błędzie', async () => {
        const { win, setFetchJson } = loadMl();
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();
        expect(host.textContent).toContain('Ostatnia aktualizacja');
        const previousUpdate = host.querySelector('.ai-ml-updated-at').textContent;
        const refreshButton = host.querySelector('.ai-ml-refresh-btn');
        expect(refreshButton.tagName).toBe('BUTTON');
        expect(refreshButton.type).toBe('button');
        expect(refreshButton.getAttribute('aria-label')).toBe('Odśwież status AI/ML');
        expect(refreshButton.tabIndex).toBe(0);

        setFetchJson(() => Promise.reject(new Error('offline')));
        refreshButton.click();
        await tick();

        expect(host.textContent).toContain('Dane nieaktualne');
        expect(host.textContent).toContain('ROC-AUC modelu');
        expect(host.querySelector('.ai-ml-updated-at').textContent).toBe(previousUpdate);
        expect(host.querySelector('.ai-ml-refresh-btn').disabled).toBe(false);
    });

    it('identyfikuje model w akcjach i blokuje cały wiersz podczas żądania', async () => {
        let finishActivation;
        const activation = new Promise((resolve) => {
            finishActivation = resolve;
        });
        const model = {
            id: 'model-id',
            version: 'candidate-v2',
            active: false,
            trainingRows: 12,
            features: [],
            metrics: '{}',
            featureVersion: 'v1'
        };
        const { win, setFetchJson, getConfirmMessage } = loadMl();
        setFetchJson((url) => {
            if (url === '/ml-status') return Promise.resolve(STATUS);
            if (url === '/models') return Promise.resolve({ models: [model] });
            if (url === '/models/model-id/activate') return activation;
            return Promise.resolve({});
        });
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();

        const activate = host.querySelector('.ai-model-activate-btn');
        const promote = host.querySelector('.ai-model-promote-btn');
        expect(promote.tagName).toBe('BUTTON');
        expect(promote.tabIndex).toBe(0);
        expect(promote.getAttribute('aria-label')).toContain('candidate-v2');
        expect(activate.getAttribute('aria-label')).toContain('candidate-v2');
        activate.click();
        await tick(0);
        expect(getConfirmMessage()).toContain('candidate-v2');
        expect(activate.disabled).toBe(true);
        expect(promote.disabled).toBe(true);
        expect(host.querySelector('.ai-model-actions-cell').getAttribute('aria-busy')).toBe('true');

        finishActivation({ activated: false });
        await tick();
        expect(activate.disabled).toBe(false);
        expect(promote.disabled).toBe(false);
    });

    it('pokazuje zero danych jako zero i brak snapshotu jako brak wartości', async () => {
        const { win, setFetchJson } = loadMl();
        setFetchJson((url) =>
            Promise.resolve(
                url === '/ml-status'
                    ? {
                          ...STATUS,
                          featureCount: 0,
                          labeledCount: 0,
                          totalRewards: 0,
                          trainingRows: null,
                          rollbackTargetVersion: null,
                          trainingGate: { ...STATUS.trainingGate, newSinceLastTrain: 0 },
                          lastTrainingSnapshot: null
                      }
                    : { models: [] }
            )
        );
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();

        const rewards = Array.from(host.querySelectorAll('.ai-stat-card')).find((card) =>
            card.textContent.includes('Zdarzenia reward')
        );
        const snapshot = Array.from(host.querySelectorAll('.ai-stat-card')).find((card) =>
            card.textContent.includes('Próbki ostatniego snapshotu')
        );
        expect(rewards.querySelector('div').textContent).toBe('0');
        expect(snapshot.querySelector('div').textContent).toBe('—');
        expect(host.querySelector('#ai-ml-rollback-btn').disabled).toBe(true);
    });

    it('wyświetla czytelny powód bramki zamiast technicznego kodu', async () => {
        const { win, setFetchJson } = loadMl();
        setFetchJson((url) =>
            Promise.resolve(
                url === '/ml-status'
                    ? {
                          ...STATUS,
                          trainingGate: {
                              ...STATUS.trainingGate,
                              eligible: false,
                              reason: 'insufficient_new_data:0',
                              newSinceLastTrain: 0,
                              minNewData: 50
                          }
                      }
                    : { models: [] }
            )
        );
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();

        const reasonCard = Array.from(host.querySelectorAll('.ai-stat-card')).find((card) =>
            card.textContent.includes('Powód bramki')
        );
        expect(reasonCard.textContent).not.toContain('insufficient_new_data:0');
        expect(reasonCard.querySelector('div').textContent).toContain('0/50');
        expect(reasonCard.querySelector('div').textContent).toMatch(/za mało nowych/i);
    });

    it('używa spójnej wielkości liter w pustych kafelkach bramki', async () => {
        const { win, setFetchJson } = loadMl();
        setFetchJson((url) =>
            Promise.resolve(
                url === '/ml-status'
                    ? {
                          ...STATUS,
                          trainingGate: {
                              ...STATUS.trainingGate,
                              eligible: false,
                              reason: 'too_soon:4h',
                              hoursSinceLastTrain: null,
                              lastAttempt: null
                          }
                      }
                    : { models: [] }
            )
        );
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();

        const cards = Array.from(host.querySelectorAll('.ai-stat-card'));
        const getValue = (title) =>
            cards.find((card) => card.textContent.includes(title)).querySelector('div').textContent;
        expect(getValue('Od sukcesu')).toBe('Brak');
        expect(getValue('Ostatnia próba')).toBe('Brak prób');
        expect(getValue('Powód bramki')).toBe('Za krótko od ostatniego treningu');
    });

    it('układa kafelki bramki treningu w trzy kolumny jak pozostałe sekcje ML', async () => {
        const { win } = loadMl();
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();

        const gateSection = Array.from(host.querySelectorAll('.ai-ml-group')).find((section) =>
            section
                .querySelector('.ai-ml-group-label')
                .textContent.toLocaleLowerCase('pl-PL')
                .includes('bramka treningu')
        );
        expect(
            gateSection.querySelector('.ai-ml-group-grid').classList.contains('ai-ml-col-3')
        ).toBe(true);
    });

    it('ignoruje odpowiedź starszego odświeżenia po nowszym renderze', async () => {
        let resolveOldStatus;
        const oldStatus = new Promise((resolve) => {
            resolveOldStatus = resolve;
        });
        let statusRequests = 0;
        const { win, setFetchJson } = loadMl();
        setFetchJson((url) => {
            if (url !== '/ml-status') return Promise.resolve({ models: [] });
            statusRequests += 1;
            if (statusRequests === 2) return oldStatus;
            return Promise.resolve({ ...STATUS, activeModelAuc: 0.999 });
        });
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();
        host.querySelector('.ai-ml-refresh-btn').click();
        win.aiRenderMlStatus(host);
        await tick();
        resolveOldStatus({ ...STATUS, activeModelAuc: 0.111 });
        await tick();

        expect(host.textContent).toContain('0.9990');
        expect(host.textContent).not.toContain('0.1110');
    });

    it('potwierdza zakres treningu i wersję celu rollbacku przed akcją', async () => {
        let finishTraining;
        let finishRollback;
        const training = new Promise((resolve) => {
            finishTraining = resolve;
        });
        const rollback = new Promise((resolve) => {
            finishRollback = resolve;
        });
        const {
            win,
            setFetchJson,
            getConfirmMessage,
            getRollbackRequestBody,
            setRollbackRequestBody
        } = loadMl();
        setFetchJson((url, options) => {
            if (url === '/ml-status') return Promise.resolve(STATUS);
            if (url === '/models') return Promise.resolve({ models: [] });
            if (url === '/train') return training;
            if (url === '/rollback') {
                setRollbackRequestBody(JSON.parse(options.body));
                return rollback;
            }
            return Promise.resolve({});
        });
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();

        host.querySelector('#ai-ml-train-btn').click();
        await tick(0);
        expect(getConfirmMessage()).toContain('10 nowych kwalifikujących się próbkach');
        expect(getConfirmMessage()).toContain('v1');
        expect(host.querySelector('#ai-ml-train-btn').disabled).toBe(true);

        finishTraining({ trained: false, reason: 'insufficient_new_data' });
        await tick();
        host.querySelector('#ai-ml-rollback-btn').click();
        await tick(0);
        expect(getConfirmMessage()).toContain('rollback-v1');
        expect(host.querySelector('#ai-ml-rollback-btn').disabled).toBe(true);
        expect(getRollbackRequestBody()).toEqual({
            expectedActiveVersion: 'v1',
            expectedPreviousVersion: 'rollback-v1'
        });
        finishRollback({ rolledBack: false });
    });

    it('pokazuje rozkład akcji i świeżość z istniejącego endpointu predictions/stats', async () => {
        const { win, setFetchJson } = loadMl();
        setFetchJson((url) => {
            if (url === '/ml-status') return Promise.resolve(STATUS);
            if (url === '/prediction-stats') {
                return Promise.resolve({
                    total: 5,
                    actions: { ACCEPT: 3, REJECT: 2 },
                    recentScores: [0.7, 0.2],
                    recentCount: 2
                });
            }
            return Promise.resolve({ models: [] });
        });
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();

        const stats = host.querySelector('.ai-prediction-stats-host');
        expect(stats.textContent).toContain('/ai/predictions/stats');
        expect(stats.textContent).toContain('ACCEPT');
        expect(stats.textContent).toContain('3');
        expect(stats.textContent).toContain('REJECT');
        expect(stats.textContent).toContain('2');
        expect(stats.textContent).toContain('Zweryfikowane próbki score');
        expect(stats.textContent).not.toContain('suma wartości reward');
    });

    it('rozróżnia pusty licznik predictions/stats od błędu endpointu', async () => {
        const { win, setFetchJson } = loadMl();
        setFetchJson((url) => {
            if (url === '/ml-status') return Promise.resolve(STATUS);
            if (url === '/prediction-stats') {
                return Promise.resolve({ total: 0, actions: {}, recentScores: [], recentCount: 0 });
            }
            return Promise.resolve({ models: [] });
        });
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();
        expect(host.querySelector('.ai-prediction-stats-host').textContent).toContain(
            'Brak zdarzeń reward (0)'
        );

        setFetchJson((url) =>
            Promise.resolve(url === '/prediction-stats' ? { error: 'unavailable' } : STATUS)
        );
        win.aiRenderMlStatus(host);
        await tick();
        expect(host.querySelector('.ai-prediction-stats-host').textContent).toContain(
            'error:unavailable'
        );
    });
});
