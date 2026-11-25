import fs from 'fs';
import path from 'path';
import vm from 'vm';

describe('partialLoader — zbiorczy wynik ładowania', () => {
    test('raportuje błędy HTTP i sieci, zachowując udane partiale oraz zdarzenie końca', async () => {
        const fragments = [
            {
                id: 'success',
                path: '/success.html',
                innerHTML: '',
                getAttribute: () => '/success.html'
            },
            {
                id: 'http-failure',
                path: '/missing.html',
                innerHTML: '',
                getAttribute: () => '/missing.html'
            },
            {
                id: 'network-failure',
                path: '/offline.html',
                innerHTML: '',
                getAttribute: () => '/offline.html'
            }
        ];
        const events: Array<{ type: string; detail?: unknown }> = [];
        const documentMock = {
            querySelectorAll: () => fragments,
            getElementById: (id: string) => fragments.find((fragment) => fragment.id === id),
            dispatchEvent: (event: { type: string; detail?: unknown }) => events.push(event)
        };
        const sandbox = {
            document: documentMock,
            fetch: jest.fn(async (url: string) => {
                if (url.startsWith('/missing.html')) return { ok: false, status: 404 };
                if (url.startsWith('/offline.html')) throw new Error('offline');
                return { ok: true, text: async () => '<p>ready</p>' };
            }),
            CustomEvent: function (type: string, init?: { detail?: unknown }) {
                return { type, detail: init?.detail };
            },
            console: { error: jest.fn(), warn: jest.fn() }
        };
        const source = fs.readFileSync(
            path.join(__dirname, '../../public/js/shared/partialLoader.js'),
            'utf8'
        );

        vm.runInNewContext(source, sandbox);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        expect(fragments[0].innerHTML).toBe('<p>ready</p>');
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('partials:loaded');
        expect(events[0].detail).toMatchObject({
            failed: 2,
            failures: [
                { id: 'http-failure', path: '/missing.html' },
                { id: 'network-failure', path: '/offline.html' }
            ]
        });
    });
});
