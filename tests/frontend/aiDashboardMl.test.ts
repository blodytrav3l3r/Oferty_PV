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
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const STATUS = {
    mlOnline: true,
    aiInfluencePct: 40,
    modelVersion: 'v1',
    activeModelAuc: 0.8421,
    baselineAccuracy: 0.731,
    activeModelMetrics: { prAuc: 0.7, f1: 0.6, logLoss: 0.5, ece: 0.1 },
    trainingRunning: false,
    labeledCount: 120,
    featureCount: 200,
    labelCounts: { accepted: 10, rejected: 2, modified: 3, noFeedback: 5 },
    totalRewards: 5,
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
    const sandbox = {
        window: {
            AI_ENDPOINTS: { mlStatus: '/ml-status', models: '/models' },
            fetchJson: (url) => Promise.resolve(url === '/ml-status' ? STATUS : { models: [] }),
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
    return sandbox.window;
}

function tick(ms = 20) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('aiDashboardMl metryki', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('ROC-AUC i baseline jako osobne karty, bez odejmowania i bez pp', async () => {
        const win = loadMl();
        const host = document.createElement('div');
        document.body.appendChild(host);
        win.aiRenderMlStatus(host);
        await tick();
        const html = host.innerHTML;
        expect(html).toContain('ROC-AUC modelu');
        expect(html).toContain('0.8421');
        expect(html).toContain('Baseline accuracy');
        expect(html).toContain('0.7310');
        expect(html).not.toContain('Baseline vs Model');
        expect(html).not.toContain(' pp');
    });
});
