// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
// Correctness gate P1 (korekta 3 recenzji): legacy DOM-order == virtual seqOrder
// po otwarciu, zmianie numeru, drag/drop, wykluczeniu, przywróceniu, bulk.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadCtx() {
    const context: any = {
        productionOrders: [],
        wells: [],
        zleceniaElementsList: [],
        getElementStatus: () => 'open',
        escapeHtml: (s: any) => String(s),
        window: {} as any,
        document: { getElementById: () => null, createElement: () => null, body: {} },
        localStorage: { getItem: () => null },
        showToast: () => {},
        console
    };
    vm.createContext(context);
    const bulkCode = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/orderBulk.js'),
        'utf8'
    );
    vm.runInContext(bulkCode, context);
    return context;
}

/** Symulacja legacy: reorder aktywnych jak reorderBulkSeqList (splice + klasy na końcu). */
function legacySim(initial: number[], disabled: Set<number>, ops: any[]) {
    let active = initial.filter((w) => !disabled.has(w));
    let excluded: number[] = [];
    for (const op of ops) {
        if (op.t === 'num') {
            const from = active.indexOf(op.w);
            let to = op.n - 1;
            if (to >= active.length) to = active.length - 1;
            if (to < 0) to = 0;
            if (from >= 0 && from !== to) {
                active.splice(from, 1);
                active.splice(to, 0, op.w);
            }
        } else if (op.t === 'drop') {
            const from = active.indexOf(op.from);
            const to = active.indexOf(op.to);
            if (from >= 0 && to >= 0 && op.from !== op.to) {
                active.splice(from, 1);
                let at = active.indexOf(op.to) + (op.after ? 1 : 0);
                active.splice(at, 0, op.from);
            }
        } else if (op.t === 'toggle') {
            // Real legacy: element zostaje w DOM (segment excluded na końcu listy);
            // restore wkłada go na koniec active (partycja po kolejności DOM).
            if (excluded.includes(op.w)) {
                excluded = excluded.filter((x) => x !== op.w);
                active.push(op.w);
            } else {
                excluded.push(op.w);
                active = active.filter((x) => x !== op.w);
            }
        }
    }
    return { active, excluded };
}

describe('bulk seqOrder parity legacy == virtual', () => {
    test.each([101, 500, 1000])('N=%i: otwarcie, numer, drop, exclude, restore, bulk', (n) => {
        const ctx = loadCtx();
        const groups = new Map();
        const order: number[] = [];
        const disabled = new Set<number>();
        for (let i = 0; i < n; i++) {
            const open = i % 10 !== 9;
            groups.set(i, {
                wellIndex: i,
                wellName: 'S' + i,
                wellDn: '1000',
                totalCount: 2,
                openCount: open ? 2 : 0
            });
            order.push(i);
            if (!open) disabled.add(i);
        }
        const ops = [
            { t: 'num', w: 5, n: 1 },
            { t: 'drop', from: 20, to: 3, after: true },
            { t: 'toggle', w: 7 },
            { t: 'toggle', w: 8 },
            { t: 'num', w: 50, n: 2 },
            { t: 'toggle', w: 7 },
            { t: 'drop', from: 60, to: 1, after: false }
        ];

        // Legacy symulacja.
        const leg = legacySim(order, disabled, ops);

        // Virtual: te same operacje przez _bulkSeq* (model, nie DOM).
        let vOrder: number[] = order.slice();
        const vExcluded = new Set<number>();
        for (const op of ops) {
            if (op.t === 'num') {
                const p = ctx._bulkSeqPartition(vOrder, groups, vExcluded);
                const from = p.active.indexOf(op.w);
                let to = op.n - 1;
                if (to >= p.active.length) to = p.active.length - 1;
                if (to < 0) to = 0;
                if (from >= 0 && from !== to) {
                    const next = p.active.slice();
                    next.splice(from, 1);
                    next.splice(to, 0, op.w);
                    vOrder = next.concat(p.excluded, p.disabled);
                }
            } else if (op.t === 'drop') {
                vOrder = ctx._bulkSeqMove(vOrder, op.from, op.to, op.after);
                const p = ctx._bulkSeqPartition(vOrder, groups, vExcluded);
                vOrder = p.active.concat(p.excluded, p.disabled);
            } else if (op.t === 'toggle') {
                if (vExcluded.has(op.w)) vExcluded.delete(op.w);
                else vExcluded.add(op.w);
                const p = ctx._bulkSeqPartition(vOrder, groups, vExcluded);
                vOrder = p.active.concat(p.excluded, p.disabled);
            }
        }
        const vp = ctx._bulkSeqPartition(vOrder, groups, vExcluded);

        // Korekta 3: active (bulk), excluded, disabled, numeracja — wszystko równe.
        expect(vp.active).toEqual(leg.active);
        expect(vp.excluded).toEqual(leg.excluded);
        const legFlat = leg.active.concat(
            leg.excluded,
            [...disabled].sort((a, b) => a - b)
        );
        const vFlat = ctx._bulkSeqFlat(vOrder, groups, vExcluded);
        expect(vFlat).toEqual(legFlat);
        const nums = ctx._bulkSeqActiveNumbers(vOrder, groups, vExcluded);
        expect(nums.get(leg.active[0])).toBe(1);
        expect(nums.size).toBe(leg.active.length);
        leg.active.forEach((w: number, i: number) => expect(nums.get(w)).toBe(i + 1));
    });

    test('drop na samego siebie i spoza listy — brak zmiany', () => {
        const ctx = loadCtx();
        const groups = new Map([
            [0, { wellIndex: 0, openCount: 1 }],
            [1, { wellIndex: 1, openCount: 1 }]
        ]);
        expect(ctx._bulkSeqMove([0, 1], 0, 0, true)).toEqual([0, 1]);
        expect(ctx._bulkSeqMove([0, 1], 9, 0, false)).toEqual([0, 1]);
        expect(ctx._bulkSeqMove([0, 1], 0, 9, false)).toEqual([0, 1]);
        void groups;
    });
});
