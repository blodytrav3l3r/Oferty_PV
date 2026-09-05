// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
// Bulk P0 FE: 1× claim + PUT chunkami + reconciliacja claimed = saved + recycled.
// DoD: abort bezpieczny po claimie i w trakcie retryAfter; recycle tylko niezapisanych.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function fakeDocument() {
    const els: Record<string, any> = {};
    return {
        _els: els,
        getElementById: (id: string) => els[id] || null,
        createElement: () => ({
            style: {},
            set innerHTML(v: string) {
                this._html = v;
            },
            get innerHTML() {
                return this._html || '';
            },
            remove: jest.fn(),
            querySelectorAll: () => [],
            addEventListener: () => {},
            onclick: null
        }),
        body: { appendChild: jest.fn() },
        activeElement: null
    };
}

function loadCtx(fetchImpl: any) {
    const doc = fakeDocument();
    const context: any = {
        fetch: fetchImpl,
        authHeaders: () => ({}),
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        showToast: jest.fn(),
        productionOrders: [],
        wells: [],
        zleceniaElementsList: [],
        zleceniaSelectedIdx: -1,
        wellsSnapshotBeforeZlecenia: null,
        currentUser: { id: 'u1', firstName: 'A', lastName: 'B' },
        document: doc,
        window: {} as any,
        requestAnimationFrame: (cb: any) => setTimeout(cb, 0),
        cancelAnimationFrame: (id: any) => clearTimeout(id),
        // vm nie dziedziczy timerów Node — sleep/retry ich potrzebują jak w przeglądarce.
        setTimeout,
        clearTimeout,
        AbortController,
        console
    };
    context.window = { debounce: undefined };
    vm.createContext(context);
    for (const f of ['excelBulkJob.js', 'orderBulk.js']) {
        vm.runInContext(
            fs.readFileSync(path.join(__dirname, '../../public/js/studnie', f), 'utf8'),
            context
        );
    }
    // Deterministyczny builder zamiast buildAutoOrderData (ciężki, produktowy).
    context.buildAutoOrderData = (el: any) => ({
        id: 'po_' + el.i,
        wellId: 'w' + el.i,
        productionOrderNumber: ''
    });
    context.collectSharedFormData = () => ({ userId: 'u1' });
    context.buildZleceniaWellList = () => {};
    context.renderZleceniaList = () => {};
    context.refreshGlobalMetrics = () => {};
    return context;
}

function jsonResp(status: number, body: any, headers: Record<string, string> = {}) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (k: string) => headers[k] || null },
        json: async () => body
    };
}

describe('executeBulkGeneration — batch', () => {
    test('450 elementów: 3 claimy 200+200+50 + 3 PUT + retry 429 + recycle tylko 2 niezapisanych', async () => {
        const calls: any[] = [];
        let seqBase = 0;
        const fetchImpl = jest.fn(async (url: string, opts: any) => {
            calls.push({ url, method: opts && opts.method, body: opts && opts.body });
            if (url.includes('claim-production-numbers')) {
                const n = JSON.parse(opts.body).count;
                expect(n).toBeLessThanOrEqual(200);
                const nums = Array.from({ length: n }, (_, i) => seqBase + i + 1);
                seqBase += n;
                return jsonResp(200, {
                    numbers: nums.map((s) => 'N' + s),
                    seqs: nums
                });
            }
            if (url.includes('recycle-numbers')) {
                return jsonResp(200, {
                    ok: true,
                    returned: JSON.parse(opts.body).seqNumbers.length
                });
            }
            // PUT batch
            const data = JSON.parse(opts.body).data;
            const firstId = data[0].id;
            if (firstId === 'po_200' && !fetchImpl.retried) {
                // Pierwsza próba chunka 2 → 429, retry przechodzi w całości.
                fetchImpl.retried = true;
                return jsonResp(429, { error: 'limit' }, { 'Retry-After': '1' });
            }
            if (firstId === 'po_400') {
                // Ostatni chunk: 2 pierwsze id bez saved (jawny partial success).
                return jsonResp(200, { ok: true, saved: data.slice(2).map((d: any) => d.id) });
            }
            return jsonResp(200, { ok: true, saved: data.map((d: any) => d.id) });
        });
        const ctx = loadCtx(fetchImpl);
        const elements = Array.from({ length: 450 }, (_, i) => ({ i, product: { name: 'P' + i } }));

        await ctx.executeBulkGeneration(elements);

        const claims = calls.filter((c) => c.url.includes('claim-production-numbers'));
        const puts = calls.filter((c) => c.url.includes('/production') && c.method === 'PUT');
        const recycles = calls.filter((c) => c.url.includes('recycle-numbers'));
        expect(claims.map((c: any) => JSON.parse(c.body).count)).toEqual([200, 200, 50]);
        expect(puts.length).toBe(4); // 200 + 429 + retry + 50
        expect(ctx.productionOrders.length).toBe(448);
        // Numery po kolei popupu, 1:1 z built.
        expect(ctx.productionOrders[0].productionOrderNumber).toBe('N1');
        for (const o of ctx.productionOrders) {
            expect(o.productionOrderNumber).toBe('N' + (parseInt(o.id.slice(3), 10) + 1));
        }
        // Recycle DOKŁADNIE 2 niezapisane seq (DoD: tylko niezapisane).
        // Trzeci chunk to elementy 400..449 → brak saved dla seq 401,402.
        expect(recycles.length).toBe(1);
        expect(JSON.parse(recycles[0].body).seqNumbers).toEqual([401, 402]);
    }, 30000);

    test('abort po pierwszym chunku claima → recycle 200, zero PUT, zero zapisów', async () => {
        const calls: any[] = [];
        const fetchImpl = jest.fn(async (url: string, opts: any) => {
            calls.push({ url, method: opts && opts.method, body: opts && opts.body });
            if (url.includes('claim-production-numbers')) {
                const n = JSON.parse(opts.body).count;
                return jsonResp(200, {
                    numbers: Array.from({ length: n }, (_, i) => 'N' + (i + 1)),
                    seqs: Array.from({ length: n }, (_, i) => i + 1)
                });
            }
            if (url.includes('recycle-numbers')) {
                return jsonResp(200, { ok: true });
            }
            return jsonResp(200, { ok: true, saved: [] });
        });
        const ctx = loadCtx(fetchImpl);
        // Abort tuż po claimie (DoD: abort bezpieczny po claimie).
        const realClaim = ctx._bulkClaimRange;
        ctx._bulkClaimRange = async (...a: any[]) => {
            const r = await realClaim(...a);
            ctx._excelBulkCancel();
            return r;
        };
        const elements = Array.from({ length: 450 }, (_, i) => ({ i, product: { name: 'P' + i } }));

        await ctx.executeBulkGeneration(elements);

        expect(ctx.productionOrders.length).toBe(0);
        const puts = calls.filter((c) => c.url.includes('/production') && c.method === 'PUT');
        expect(puts.length).toBe(0);
        const recycles = calls.filter((c) => c.url.includes('recycle-numbers'));
        const returnedSeqs = recycles.flatMap((c: any) => JSON.parse(c.body).seqNumbers);
        // Invariant: claimed 200 (1 chunk przed abortem) = saved 0 + recycled 200.
        expect(returnedSeqs.sort((a: number, b: number) => a - b)).toEqual(
            Array.from({ length: 200 }, (_, i) => i + 1)
        );
    }, 30000);
});

describe('executeBulkGeneration — chunkowanie claima', () => {
    function claimCtx(total: number, failOnClaim = -1) {
        const calls: any[] = [];
        let seqBase = 0;
        let claimNo = 0;
        const fetchImpl = jest.fn(async (url: string, opts: any) => {
            calls.push({ url, method: opts && opts.method, body: opts && opts.body });
            if (url.includes('claim-production-numbers')) {
                claimNo++;
                if (claimNo === failOnClaim) return jsonResp(400, { error: 'max' });
                const n = JSON.parse(opts.body).count;
                const nums = Array.from({ length: n }, (_, i) => seqBase + i + 1);
                seqBase += n;
                return jsonResp(200, { numbers: nums.map((s) => 'N' + s), seqs: nums });
            }
            if (url.includes('recycle-numbers')) return jsonResp(200, { ok: true });
            const data = JSON.parse(opts.body).data;
            return jsonResp(200, { ok: true, saved: data.map((d: any) => d.id) });
        });
        const ctx = loadCtx(fetchImpl);
        const elements = Array.from({ length: total }, (_, i) => ({
            i,
            product: { name: 'P' + i }
        }));
        return { ctx, calls, elements };
    }
    const claimCounts = (calls: any[]) =>
        calls
            .filter((c) => c.url.includes('claim-production-numbers'))
            .map((c) => JSON.parse(c.body).count);

    test.each([
        [0, []],
        [200, [200]],
        [201, [200, 1]],
        [400, [200, 200]],
        [401, [200, 200, 1]],
        [450, [200, 200, 50]]
    ])(
        '%i elementów → claimy %j, numery 1:1',
        async (total, expected) => {
            const { ctx, calls, elements } = claimCtx(total);
            await ctx.executeBulkGeneration(elements);
            expect(claimCounts(calls)).toEqual(expected);
            if (total === 0) {
                expect(ctx.productionOrders.length).toBe(0);
                return;
            }
            // numbers.length === seqs.length === built.length, kolejność 1:1.
            expect(ctx.productionOrders.length).toBe(total);
            for (const o of ctx.productionOrders) {
                expect(o.productionOrderNumber).toBe('N' + (parseInt(o.id.slice(3), 10) + 1));
            }
        },
        30000
    );

    test('MUST: błąd 2. claima → bulk przerwany, PUT nie startuje, recycle pierwszych 200', async () => {
        const { ctx, calls, elements } = claimCtx(450, 2);
        await ctx.executeBulkGeneration(elements);
        expect(claimCounts(calls)).toEqual([200, 200]);
        const puts = calls.filter((c) => c.url.includes('/production') && c.method === 'PUT');
        expect(puts.length).toBe(0);
        expect(ctx.productionOrders.length).toBe(0);
        const recycles = calls.filter((c) => c.url.includes('recycle-numbers'));
        const returnedSeqs = recycles.flatMap((c: any) => JSON.parse(c.body).seqNumbers);
        expect(returnedSeqs.sort((a: number, b: number) => a - b)).toEqual(
            Array.from({ length: 200 }, (_, i) => i + 1)
        );
    }, 30000);
});
