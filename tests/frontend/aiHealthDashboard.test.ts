/**
 * @jest-environment jsdom
 */
// @ts-nocheck
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadDashboard(metricsPromise?: Promise<unknown>) {
    const code = fs.readFileSync(
        path.resolve(__dirname, '../../public/js/admin/mlHealthDashboard.js'),
        'utf8'
    );
    const sandbox: any = {
        window: {
            fetchJson: (url: string) =>
                url === '/metrics' && metricsPromise
                    ? metricsPromise
                    : Promise.resolve(
                          url === '/metrics'
                              ? {
                                    endpoints: {
                                        'POST /api/telemetry/ai/predict/batch': {
                                            p95: 42,
                                            p99: 84,
                                            recent: { n: 6, errors: 0 }
                                        },
                                        'POST /api/telemetry/ai/reward': {
                                            recent: { n: 2, errors: 1 }
                                        },
                                        'POST /api/telemetry/ai/reward-batch': {
                                            recent: { n: 3, errors: 0 }
                                        }
                                    }
                                }
                              : {
                                    aiMlEnabled: true,
                                    mlOnline: true,
                                    modelTrained: true,
                                    modelAccuracy: 0.8,
                                    modelVersion: 'v1',
                                    telemetryCount: 12,
                                    featureCount: 11,
                                    lastTrainingAt: '2026-11-27T10:00:00.000Z',
                                    trainingRunning: false,
                                    totalRewards: 4,
                                    driftPct: 0,
                                    dataFreshness: {
                                        lastTelemetryAt: '2026-11-27T10:30:00.000Z',
                                        lastFeatureAt: '2026-11-27T10:20:00.000Z'
                                    },
                                    fallbacks24h: {
                                        total: 3,
                                        byReason: {
                                            timeout: 2,
                                            http_error: 0,
                                            empty_response: 0,
                                            partial_response: 0,
                                            network_error: 1,
                                            unspecified: 0
                                        }
                                    },
                                    compatibility24h: {
                                        total: 4,
                                        truncated: false,
                                        byStatus: {
                                            compatible: 2,
                                            warning: 1,
                                            blocked: 1,
                                            unknown: 0
                                        }
                                    },
                                    dataQuality: {
                                        withFeatureSnapshotPct: 95,
                                        withSolverSourcePct: 95,
                                        withWellTypePct: 95,
                                        manualOverrideCount: 0
                                    }
                                }
                      ),
            aiMlEnabled: () => Promise.resolve(true),
            escapeHtml: (value: unknown) => String(value),
            escapeHtmlAttr: (value: unknown) => String(value),
            aiMlDisabledHtml: () => '<div>disabled</div>'
        },
        document,
        lucide: undefined,
        Date,
        Number
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'mlHealthDashboard.js' });
    return sandbox.window as { mlHealthRender: (containerId: string) => void };
}

describe('mlHealthDashboard data freshness', () => {
    it('renders database freshness and bounded fallback outcomes', async () => {
        document.body.innerHTML = '<div id="health"></div>';
        loadDashboard().mlHealthRender('health');
        await new Promise((resolve) => setTimeout(resolve, 0));

        const host = document.getElementById('health');
        expect(host?.textContent).toContain('Ostatnia telemetria');
        expect(host?.textContent).toContain('Ostatni feature');
        expect(host?.textContent).toContain('Fallback zgłoszony klientem · 24 h');
        expect(host?.textContent).toContain('timeout: 2');
        expect(host?.textContent).toContain('puste: 0');
        expect(host?.textContent).toContain('częściowe: 0');
        expect(host?.textContent).toContain('sieć: 1');
        expect(host?.textContent).toContain('API predykcji p95 / p99');
        expect(host?.textContent).toContain('42 / 84 ms');
        expect(host?.textContent).toContain('Błędy API reward');
        expect(host?.textContent).toContain('5xx / 5 ostatnich żądań');
        expect(host?.textContent).toContain('Dry-run kompatybilności · 24 h');
        expect(host?.textContent).toContain('zgodne: 2 · ostrzeżenia: 1 · blokady: 1');
    });

    it('renders health before slow process metrics arrive', async () => {
        document.body.innerHTML = '<div id="health"></div>';
        let resolveMetrics: (value: unknown) => void = () => undefined;
        const metricsPromise = new Promise<unknown>((resolve) => {
            resolveMetrics = resolve;
        });
        loadDashboard(metricsPromise).mlHealthRender('health');
        await new Promise((resolve) => setTimeout(resolve, 0));

        const host = document.getElementById('health');
        expect(host?.textContent).toContain('Ostatnia telemetria');
        expect(host?.textContent).toContain('ładowanie metryk procesu');
        expect(host?.textContent).not.toContain('42 / 84 ms');

        resolveMetrics({
            endpoints: {
                'POST /api/telemetry/ai/predict/batch': {
                    p95: 42,
                    p99: 84,
                    recent: { n: 6, errors: 0 }
                }
            }
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(host?.textContent).toContain('42 / 84 ms');
    });
});
