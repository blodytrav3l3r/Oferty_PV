/**
 * @jest-environment jsdom
 */
// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, jest } from '@jest/globals';

const DASHBOARD_SOURCE = fs.readFileSync(
    path.resolve(__dirname, '../../public/js/admin/aiDashboard.js'),
    'utf8'
);

function loadDashboard(
    aiMlEnabled: () => Promise<boolean | null>,
    fetchJson: ReturnType<typeof jest.fn> = jest.fn()
) {
    const sandbox = {
        window: {
            aiMlEnabled,
            fetchJson,
            aiMlDisabledHtml: () => '<div>AI OFF</div>',
            aiMlUnknownHtml: () => '<div>AI UNKNOWN</div>'
        },
        document
    };
    vm.createContext(sandbox);
    vm.runInContext(DASHBOARD_SOURCE, sandbox, { filename: 'aiDashboard.js' });
    return sandbox.window;
}

async function renderDashboard(aiMlEnabled: () => Promise<boolean | null>) {
    document.body.innerHTML = '<div id="host"></div>';
    const fetchJson = jest.fn();
    const dashboard = loadDashboard(aiMlEnabled, fetchJson);
    dashboard.aiDashboardRender('host');
    await Promise.resolve();
    await Promise.resolve();
    return { host: document.getElementById('host')!, fetchJson };
}

describe('AI dashboard feature flag gate', () => {
    it('does not render AI controls or call endpoints when the flag is OFF', async () => {
        const { host, fetchJson } = await renderDashboard(() => Promise.resolve(false));

        expect(host.textContent).toContain('AI OFF');
        expect(host.querySelector('#ai-run-cycle')).toBeNull();
        expect(fetchJson).not.toHaveBeenCalled();
    });

    it.each([
        ['unknown', () => Promise.resolve(null)],
        ['unavailable', () => Promise.reject(new Error('offline'))]
    ])('fails closed when the feature flag is %s', async (_state, aiMlEnabled) => {
        const { host } = await renderDashboard(aiMlEnabled);

        expect(host.textContent).toContain('AI UNKNOWN');
        expect(host.querySelector('#ai-run-cycle')).toBeNull();
    });
});
