import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from '@jest/globals';

function loadMlPanels(sources: unknown, users: unknown): any {
    const code = fs.readFileSync(
        path.resolve(__dirname, '../../public/js/admin/mlPanels.js'),
        'utf8'
    );
    const requests: Array<{ url: string; options?: { method?: string } }> = [];
    const window: any = {
        AI_ENDPOINTS: { trainingUsers: '/training-users', users: '/users' },
        fetchJson: (url: string, options?: { method?: string }) => {
            requests.push({ url, options });
            return Promise.resolve(url === '/training-users' ? sources : users);
        },
        requests,
        aiLoadingHtml: () => '<div>loading</div>',
        aiApiErrorHtml: (error: string) => '<div>error:' + error + '</div>',
        escapeHtml: (value: unknown) => String(value),
        aiEscapeHtmlAttr: (value: unknown) => String(value),
        showToast: () => {}
    };
    const sandbox = { window, document: {}, setTimeout, clearTimeout };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return window;
}

function renderTrainingSources(window: ReturnType<typeof loadMlPanels>) {
    const host = {
        innerHTML: '',
        querySelectorAll: () => [],
        querySelector: () => null
    };
    const container = { querySelector: () => host };
    window.aiRenderTrainingSources(container);
    return new Promise<string>((resolve) => setTimeout(() => resolve(host.innerHTML), 0));
}

describe('AI training source status', () => {
    it('shows that training is paused when the allowlist is unconfigured', async () => {
        const window = loadMlPanels({ status: 'UNCONFIGURED', configured: false, userIds: [] }, [
            { id: 'u1', username: 'user1', role: 'USER' }
        ]);

        const html = await renderTrainingSources(window);

        expect(html).toContain('Trening wstrzymany');
        expect(html).not.toContain('model uczy się na danych wszystkich');
    });

    it('does not show editable sources when the allowlist is unavailable', async () => {
        const window = loadMlPanels({ status: 'UNAVAILABLE', configured: false, userIds: [] }, [
            { id: 'u1', username: 'user1', role: 'USER' }
        ]);

        const html = await renderTrainingSources(window);

        expect(html).toContain('Źródła treningu niedostępne');
        expect(html).not.toContain('ai-source-user');
    });

    it('marks the migrated population for administrator review', async () => {
        const window = loadMlPanels(
            {
                status: 'CONFIGURED',
                configured: true,
                legacyMigrated: true,
                userIds: ['u1']
            },
            [{ id: 'u1', username: 'user1', role: 'USER' }]
        );

        const html = await renderTrainingSources(window);

        expect(html).toContain('Sprawdź odziedziczoną listę');
    });

    it('allows a malformed allowlist to be replaced from the admin panel', async () => {
        const window = loadMlPanels({ status: 'INVALID', configured: false, userIds: [] }, [
            { id: 'u1', username: 'user1', role: 'USER' }
        ]);

        const html = await renderTrainingSources(window);

        expect(html).toContain('Konfiguracja źródeł jest uszkodzona');
        expect(html).toContain('ai-source-user');
    });

    it.each([
        ['network failure', null],
        ['API error response', { error: 'server' }],
        ['malformed response', { data: 'not-an-array' }]
    ])('does not enable allowlist edits after users endpoint %s', async (_label, usersResponse) => {
        const window = loadMlPanels(
            { status: 'CONFIGURED', configured: true, userIds: ['u1'] },
            usersResponse
        );

        const html = await renderTrainingSources(window);

        expect(html).toContain('Nie udało się pobrać listy użytkowników');
        expect(html).not.toContain('ai-source-user');
        expect(html).not.toContain('ai-sources-select-all');
        expect(html).not.toContain('ai-sources-select-none');
        expect(
            window.requests.some(
                (request: { options?: { method?: string } }) => request.options?.method === 'PUT'
            )
        ).toBe(false);
    });
});
