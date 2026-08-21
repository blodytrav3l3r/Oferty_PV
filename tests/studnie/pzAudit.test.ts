import vm from 'vm';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Testy audytu PZ elementKey (orderZleceniaData.js) — klasyfikacja WARN/INFO,
 * dedupe w sesji, fallback na ofertę źródłową (po.offerId).
 */

function loadAudit() {
    const code = readFileSync(
        join(__dirname, '..', '..', 'public', 'js', 'studnie', 'orderZleceniaData.js'),
        'utf8'
    );
    const warnings: any[] = [];
    const infos: any[] = [];
    const toasts: string[] = [];
    const sandbox: any = {
        window: {},
        productionOrders: [],
        wells: [],
        offersStudnie: [],
        logger: {
            warn: (...a: any[]) => warnings.push(a),
            info: (...a: any[]) => infos.push(a),
            error: () => {}
        },
        showToast: (msg: string) => toasts.push(msg)
    };
    vm.createContext(sandbox);
    // loadProductionOrders odwołuje się do fetchWithTimeout/authHeaders tylko przy wywołaniu
    sandbox.runAudit = (pos: any[], wellsArr: any[], offers: any[]) => {
        sandbox.productionOrders = pos;
        sandbox.wells = wellsArr;
        sandbox.offersStudnie = offers;
        vm.runInContext('auditPzElementKeyMismatch()', sandbox);
    };
    vm.runInContext(code, sandbox);
    return { sandbox, warnings, infos, toasts };
}

describe('auditPzElementKeyMismatch — klasyfikacja i dedupe', () => {
    const po = {
        id: 'po1',
        wellId: 'well-1',
        elementKey: 'key-a',
        offerId: 'offer-1',
        productionOrderNumber: 'SA/N/00001/26'
    };

    test('PZ dopasowane w edytorze — brak logów', () => {
        const { sandbox, warnings, infos } = loadAudit();
        sandbox.runAudit([po], [{ id: 'well-1', config: [{ _elemId: 'key-a' }] }], []);
        expect(warnings).toHaveLength(0);
        expect(infos).toHaveLength(0);
    });

    test('elementKey żyje w ofercie źródłowej — INFO, nie WARN', () => {
        const { sandbox, warnings, infos } = loadAudit();
        sandbox.runAudit(
            [po],
            [{ id: 'well-1', config: [{ _elemId: 'other-key' }] }],
            [{ id: 'offer-1', wells: [{ id: 'well-1', config: [{ _elemId: 'key-a' }] }] }]
        );
        expect(warnings.filter((w: any[]) => String(w[1]).includes('nie pasuje'))).toHaveLength(0);
        expect(infos.some((i: any[]) => String(i[1]).includes('ofercie'))).toBe(true);
    });

    test('osierocone PZ — WARN + wpis do pzAuditMismatches + toast raz', () => {
        const { sandbox, warnings, toasts } = loadAudit();
        sandbox.runAudit([po], [{ id: 'well-1', config: [{ _elemId: 'x' }] }], []);
        expect(warnings.some((w: any[]) => String(w[1]).includes('nie pasuje'))).toBe(true);
        expect(sandbox.window.pzAuditMismatches).toHaveLength(1);
        expect(toasts).toHaveLength(1);
        // drugi przebieg — dedupe: bez nowego warna i bez toastów
        const before = warnings.length;
        sandbox.runAudit([po], [{ id: 'well-1', config: [{ _elemId: 'x' }] }], []);
        expect(warnings.length).toBe(before);
        expect(toasts).toHaveLength(1);
    });
});
