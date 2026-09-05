// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function loadOrderDto() {
    const context: any = {
        window: {},
        structuredClone: (obj: any) => JSON.parse(JSON.stringify(obj))
    };
    const code = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/orderDto.js'),
        'utf8'
    );
    vm.createContext(context);
    vm.runInContext(code, context);
    return context.window;
}

function fullUiWell() {
    return {
        id: 'well-1',
        name: 'S1',
        dn: '1000',
        rzednaDna: 100.5,
        rzednaWlazu: 103.2,
        magazyn: 'Kluczbork',
        psiaBuda: false,
        stycznaNadbudowa1200: false,
        zakonczenie: 'konus-1',
        zakonczenieByDn: { 1000: 'konus-1' },
        redukcjaDN1000: false,
        redukcjaTargetDN: null,
        wkladkaDennica: 'brak',
        wkladkaNadbudowa: '3mm',
        wkladkaZwienczenie: 'brak',
        wkladkaOsadnikPreco: 'nie',
        wkladkaOsadnikH: 0,
        kineta: 'beton',
        spocznik: 'beton',
        spocznikH: '1/2',
        dennicaMaterial: 'betonowa',
        stopnie: 'drabinka',
        doplata: 0,
        malowanieW: 'brak',
        malowanieWewCena: 0,
        malowanieZ: 'brak',
        malowanieZewCena: 0,
        precoFullHeight: 'nie',
        pehdDiscount: 0,
        autoSelect: true,
        autoLocked: true,
        configSource: 'AUTO',
        config: [
            {
                productId: 'dennica-1',
                quantity: 1,
                frozenPrice: 740,
                frozenPriceBase: 740,
                frozenName: 'Dennica',
                _elemId: 'el-1'
            },
            { productId: 'krag-1', quantity: 2 }
        ],
        przejscia: [
            {
                productId: 'prz-160',
                dn: '160',
                rzednaWlaczenia: 101.0,
                angle: 90,
                angleExecution: 90,
                angleGony: '100',
                flowType: 'WLOT',
                doplata: 0,
                frozenPrice: 100
            }
        ],
        // --- runtime/cache: NIE mogą opuścić przeglądarki ---
        _lastAutoConfig: JSON.stringify([{ productId: 'x', quantity: 9 }]),
        _lastAutoTelemetryId: 'tel-1',
        _aiRankInfo: { score: 1 },
        _lastSolveInputHash: 'abc',
        __resCache: { big: true },
        _psiaBudaBackup: { kineta: 'beton' },
        configErrors: ['Błąd zapasu'],
        configStatus: 'ERROR',
        wellHeight: 2700,
        type: 'krag',
        warehouse: 'Kluczbork',
        solverCache: { huge: 'x'.repeat(100) },
        renderMeta: { row: 1 },
        telemetry: { events: [1, 2, 3] }
    };
}

describe('orderDto — allowlist transportowa (P0.1)', () => {
    let dto: any;
    beforeAll(() => {
        dto = loadOrderDto();
    });

    test('nie mutuje wejścia i zwraca DTO z polami biznesowymi', () => {
        const well = fullUiWell();
        const out = dto.toWellOrderDTO(well);
        expect(out.id).toBe('well-1');
        expect(out.dn).toBe('1000');
        expect(out.rzednaDna).toBe(100.5);
        expect(out.kineta).toBe('beton');
        expect(out.configSource).toBe('AUTO');
        // wejście nietknięte
        expect(well._lastAutoConfig).toBeDefined();
        expect(well.config).toHaveLength(2);
    });

    test('runtime/cache/telemetry NIE wyciekają do DTO', () => {
        const out = dto.toWellOrderDTO(fullUiWell());
        for (const k of [
            '_lastAutoConfig',
            '_lastAutoTelemetryId',
            '_aiRankInfo',
            '_lastSolveInputHash',
            '__resCache',
            '_psiaBudaBackup',
            'configErrors',
            'configStatus',
            'wellHeight',
            'type',
            'warehouse',
            'solverCache',
            'renderMeta',
            'telemetry'
        ]) {
            expect(out).not.toHaveProperty(k);
        }
    });

    test('zachowuje _elemId i frozenPrice (PZ + kolumna Ceny z oferty)', () => {
        const out = dto.toWellOrderDTO(fullUiWell());
        expect(out.config[0]._elemId).toBe('el-1');
        expect(out.config[0].frozenPrice).toBe(740);
        expect(out.config[0].frozenPriceBase).toBe(740);
        expect(out.config[0].frozenName).toBe('Dennica');
        expect(out.przejscia[0].frozenPrice).toBe(100);
        expect(out.przejscia[0].angle).toBe(90);
        expect(out.przejscia[0].flowType).toBe('WLOT');
    });

    test('odcina transient pozycji config (isPlaceholder, _addedAt, _xp)', () => {
        const well = fullUiWell();
        well.config.push({
            productId: 'krag-2',
            quantity: 1,
            isPlaceholder: true,
            _addedAt: Date.now(),
            _xp: {}
        });
        const out = dto.toWellOrderDTO(well);
        const last = out.config[out.config.length - 1];
        expect(last).not.toHaveProperty('isPlaceholder');
        expect(last).not.toHaveProperty('_addedAt');
        expect(last).not.toHaveProperty('_xp');
        expect(last.productId).toBe('krag-2');
    });

    test('pomija pozycje bez productId i studnie bez obiektu', () => {
        expect(dto.toWellConfigItemDTO(null)).toBeNull();
        expect(dto.toWellConfigItemDTO({ quantity: 2 })).toBeNull();
        expect(dto.toWellPrzejscieDTO({ dn: '160' })).toBeNull();
        expect(dto.toWellOrderDTO(null)).toBeNull();
        expect(dto.toOrderWellsDTO(null)).toEqual([]);
    });

    test('toOrderWellsDTO filtruje puste wpisy, quantity domyślnie 1', () => {
        const out = dto.toOrderWellsDTO([fullUiWell(), null, { dn: '1000', config: [] }]);
        expect(out).toHaveLength(2);
        const noQty = dto.toWellConfigItemDTO({ productId: 'k-1' });
        expect(noQty.quantity).toBe(1);
    });
});
