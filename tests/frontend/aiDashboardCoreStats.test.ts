/**
 * @jest-environment jsdom
 */
// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, jest } from '@jest/globals';

const SOURCE = fs.readFileSync(
    path.resolve(__dirname, '../../public/js/admin/aiDashboardCore.js'),
    'utf8'
);

function loadCore(stats) {
    const sandbox = {
        window: {
            fetchJson: jest.fn(() => Promise.resolve(stats)),
            escapeHtmlAttr: (value) => String(value),
            aiLoadingHtml: () => '<div>loading</div>'
        },
        document
    };
    vm.createContext(sandbox);
    vm.runInContext(SOURCE, sandbox, { filename: 'aiDashboardCore.js' });
    return sandbox.window;
}

describe('AI knowledge stats display', () => {
    it('shows unavailable confidence when there are no active patterns', async () => {
        document.body.innerHTML = '<div id="stats"></div>';
        const win = loadCore({ total: 0, active: 0, archived: 0, avgConfidence: null });

        win.aiRenderStats(document.getElementById('stats'));
        await Promise.resolve();

        const text = document.getElementById('stats').textContent;
        expect(text).toContain('—');
        expect(text).not.toContain('0%');
    });
});
