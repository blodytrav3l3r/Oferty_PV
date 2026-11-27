import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from '@jest/globals';

function loadMlPanels(response: unknown): any {
    const code = fs.readFileSync(
        path.resolve(__dirname, '../../public/js/admin/mlPanels.js'),
        'utf8'
    );
    const window: any = {
        AI_ENDPOINTS: { drift: '/drift', featureImportance: '/feature-importance' },
        fetchJson: () => Promise.resolve(response),
        aiLoadingHtml: () => '<div>loading</div>',
        aiApiErrorHtml: (error: string) => '<div>error:' + error + '</div>',
        escapeHtml: (value: unknown) => String(value)
    };
    const sandbox = { window, document: {}, setTimeout, clearTimeout };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return window;
}

function createHost() {
    return { innerHTML: '', querySelector: () => null };
}

function render(window: any, renderer: string) {
    const host = createHost();
    const container = {
        innerHTML: '',
        querySelector: () => host
    };
    window[renderer](container);
    return new Promise<string>((resolve) =>
        setTimeout(
            () => resolve(renderer === 'aiRenderDrift' ? host.innerHTML : container.innerHTML),
            0
        )
    );
}

describe('AI dashboard telemetry quality labels', () => {
    it('explains why drift is unavailable when training cohort changed', async () => {
        const window = loadMlPanels({
            feature: [],
            trainingScope: {
                status: 'UNAVAILABLE',
                reason: 'allowlist_scope_changed',
                modelVersion: 'v1'
            },
            prediction: { psi: null, baselineSamples: 0, currentSamples: 0 },
            label: { currentPositiveRate: null, trainingPositiveRate: null, delta: null },
            shadow: {}
        });

        const html = await render(window, 'aiRenderDrift');

        expect(html).toContain(
            'Zakres użytkowników różni się od zakresu użytego przy trenowaniu modelu v1'
        );
        expect(html).toContain('score pochodzi z żądania klienta');
        expect(html).not.toContain('Uruchom trening aby ustalić rozkłady referencyjne');
    });

    it('explains that starter weights are not trained feature importance', async () => {
        const window = loadMlPanels({ error: 'model_untrained' });

        const html = await render(window, 'aiRenderFeatureImportance');

        expect(html).toContain('Model nie jest wytrenowany');
        expect(html).not.toContain('0.0000');
    });

    it('does not show shadow AUC when model lineage cannot be matched', async () => {
        const window = loadMlPanels({
            feature: [],
            trainingScope: { status: 'AVAILABLE', reason: null, modelVersion: 'v1' },
            prediction: { psi: null, baselineSamples: 0, currentSamples: 0 },
            label: {},
            shadow: {
                candidateVersion: 'v2',
                reason: 'legacy_training_lineage',
                shadowAuc: null,
                productionAuc: null,
                samples: 0
            }
        });

        const html = await render(window, 'aiRenderDrift');

        expect(html).toContain('wynik niedostępny — brak zapisanego zakresu trenowania kandydata');
        expect(html).not.toContain('AUC — vs produkcja');
    });
});
