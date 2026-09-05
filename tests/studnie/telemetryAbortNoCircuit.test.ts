// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadBridge(context) {
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/telemetryBridge.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return context;
}

function makeContext(rejectWith) {
    const fetchMock = jest.fn(() => Promise.reject(rejectWith()));
    const ctx = {
        window: {},
        // bridge sprawdza window.fetch, ale wola globalny fetch
        fetch: fetchMock,
        console: { warn: jest.fn(), info: () => {}, error: () => {}, log: () => {} },
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        AbortController: AbortController,
        Date: Date
    };
    ctx.window.fetch = fetchMock;
    ctx.window.location = { hostname: 'localhost' };
    ctx.self = ctx.window;
    return ctx;
}

describe('telemetryBridge circuit breaker', () => {
    test('wlasny timeout (AbortError) nie otwiera circuita 30 s', async () => {
        const ctx = makeContext(() => {
            const e = new Error('signal is aborted without reason');
            e.name = 'AbortError';
            return e;
        });
        loadBridge(ctx);

        for (let i = 0; i < 5; i++) {
            await ctx.window.telemetryRecordAcceptanceFull({
                telemetryId: 'probe-abort-' + i,
                accepted: true
            });
            // daj kolejce (max 2 rownolegle) czas na dociagniecie taska
            await new Promise((r) => setTimeout(r, 50));
        }

        // zaden request nie moze zostac zduszony pauza — kazdy probuje fetch
        expect(ctx.window.fetch).toHaveBeenCalledTimes(5);
        expect(ctx.console.warn).not.toHaveBeenCalled();
    });

    test('kontrola: prawdziwy blad sieci otwiera circuit po 3 failach', async () => {
        const ctx = makeContext(() => new Error('fetch failed'));
        loadBridge(ctx);

        for (let i = 0; i < 4; i++) {
            await ctx.window.telemetryRecordAcceptanceFull({
                telemetryId: 'probe-net-' + i,
                accepted: true
            });
            await new Promise((r) => setTimeout(r, 50));
        }

        // 4. wywolanie wpada w otwarty circuit — fetch tylko 3 razy + 1 warn
        expect(ctx.window.fetch).toHaveBeenCalledTimes(3);
        expect(ctx.console.warn).toHaveBeenCalledTimes(1);
    });
});
