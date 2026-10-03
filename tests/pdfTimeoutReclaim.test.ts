/**
 * D-018: timeout RUNNING jobu zwalnia slot natychmiast (reclaim).
 * Fake timers — deterministyczne 60 s bez czekania. Chromium mockowane.
 */
const deferreds: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];
let newPageCalls = 0;

jest.mock('puppeteer', () => ({
    __esModule: true,
    default: {
        launch: jest.fn(async () => ({
            newPage: jest.fn(async () => {
                newPageCalls++;
                return {
                    setContent: jest.fn(async () => {}),
                    pdf: jest.fn(
                        () =>
                            new Promise((resolve, reject) => {
                                deferreds.push({ resolve, reject });
                            })
                    )
                };
            }),
            close: jest.fn(async () => {})
        }))
    }
}));

import { generatePDF, getPdfMetrics } from '../src/services/pdf/pdfEngine';

async function flushMicro() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(() => {
    jest.useFakeTimers();
    deferreds.length = 0;
    newPageCalls = 0;
});

afterEach(async () => {
    // Drenaż: dobij wiszące rendery, spłucz finally, wróć do real timers.
    for (const d of deferreds.splice(0)) d.resolve(Buffer.from('pdf'));
    await jest.advanceTimersByTimeAsync(0);
    await flushMicro();
    jest.useRealTimers();
    await flushMicro();
});

describe('D-018 reclaim slotu przy 504', () => {
    test('(1+2) timeout running jobu zwalnia slot; kolejny startuje bez czekania; późny wynik odrzucany', async () => {
        const pA = generatePDF('<h1>a</h1>');
        const pB = generatePDF('<h1>b</h1>');
        // Podłącz handlery WCZEŚNIE (brak unhandled rejection przy advance).
        const settledA = pA.then(
            () => ({ ok: true as const }),
            (e: { status?: number }) => ({ ok: false as const, status: e?.status })
        );
        const settledB = pB.then(
            () => ({ ok: true as const }),
            (e: { status?: number }) => ({ ok: false as const, status: e?.status })
        );
        await flushMicro();
        await flushMicro();
        expect(newPageCalls).toBe(2);

        await jest.advanceTimersByTimeAsync(30_000);
        const pC = generatePDF('<h1>c</h1>');
        const settledC = pC.then(
            (buf: Buffer) => ({ ok: true as const, buf }),
            (e: unknown) => ({ ok: false as const, err: e })
        );
        await flushMicro();
        // C czeka w kolejce — oba sloty zajęte przez wiszące A/B.
        expect(newPageCalls).toBe(2);
        expect(getPdfMetrics().queueDepth).toBe(1);

        // t=60 s dla A/B (t=30 s dla C): oba timeoutują → sloty wracają, C startuje.
        await jest.advanceTimersByTimeAsync(30_000);
        await flushMicro();

        const rA = await settledA;
        const rB = await settledB;
        expect(rA).toMatchObject({ ok: false, status: 504 });
        expect(rB).toMatchObject({ ok: false, status: 504 });
        // KLUCZOWE: C wystartował bez rozwiązywania deferreds A/B.
        expect(newPageCalls).toBe(3);
        expect(getPdfMetrics().queueDepth).toBe(0);

        // (2) późne wyniki A/B odrzucane — brak podwójnej odpowiedzi, brak crashu.
        const doneBefore = getPdfMetrics().done;
        deferreds[0].resolve(Buffer.from('late-A'));
        deferreds[1].resolve(Buffer.from('late-B'));
        await flushMicro();
        await flushMicro();
        expect(getPdfMetrics().done).toBe(doneBefore);

        // C kończy się normalnie.
        deferreds[2].resolve(Buffer.from('pdf-C'));
        const rC = await settledC;
        expect(rC.ok).toBe(true);
        await flushMicro();
        expect(getPdfMetrics().activeJobs).toBe(0);
    });

    test('(3) szybki job bez zmian: 200, slot wraca', async () => {
        const p = generatePDF('<h1>fast</h1>');
        await flushMicro();
        expect(newPageCalls).toBe(1);
        deferreds[0].resolve(Buffer.from('pdf-fast'));
        await flushMicro();
        const buf = await p;
        expect(Buffer.isBuffer(buf)).toBe(true);
        expect(getPdfMetrics().activeJobs).toBe(0);
    });
});
