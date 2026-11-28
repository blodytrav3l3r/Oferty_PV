import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from '@jest/globals';

jest.mock('../../src/prismaClient', () => ({ __esModule: true, default: {} }));
jest.mock('../../src/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import { FeatureExtractor } from '../../src/services/ml/FeatureExtractor';
import { FEATURE_NAMES } from '../../src/config/mlConstants';

const PRODUCTS = [
    {
        id: 'KDB-1000-500',
        name: 'Krąg DN1000/500',
        price: 100,
        weight: 50,
        componentType: 'krag',
        dn: '1000',
        height: 500
    },
    {
        id: 'KDZ-1200-500',
        name: 'Krąg DN1200/500 z otworami',
        price: 300,
        weight: 150,
        componentType: 'krag_ot',
        dn: '1200',
        height: 500
    },
    {
        id: 'DDD-1000-500',
        name: 'Dennica DN1000 H=500',
        price: 200,
        weight: 100,
        componentType: 'dennica',
        dn: '1000',
        height: 500
    },
    {
        id: 'g-gsg-1000',
        name: 'Uszczelka GSG DN1000',
        price: 10,
        weight: 2,
        componentType: 'uszczelka',
        dn: '1000',
        height: 0
    },
    {
        id: 'g-gsg-1200',
        name: 'Uszczelka GSG DN1200',
        price: 12,
        weight: 3,
        componentType: 'uszczelka',
        dn: '1200',
        height: 0
    },
    {
        id: 'g-sdv-1000',
        name: 'Uszczelka SDV DN1000',
        price: 20,
        weight: 4,
        componentType: 'uszczelka',
        dn: '1000',
        height: 0
    },
    {
        id: 'g-sdv-1200',
        name: 'Uszczelka SDV DN1200',
        price: 22,
        weight: 5,
        componentType: 'uszczelka',
        dn: '1200',
        height: 0
    },
    {
        id: 'g-sdvpo-1000',
        name: 'Uszczelka SDV DN1000 z pierścieniem odciążającym',
        price: 30,
        weight: 6,
        componentType: 'uszczelka',
        dn: '1000',
        height: 0
    },
    {
        id: 'g-sdvpo-1200',
        name: 'Uszczelka SDV DN1200 z pierścieniem odciążającym',
        price: 32,
        weight: 7,
        componentType: 'uszczelka',
        dn: '1200',
        height: 0
    },
    {
        id: 'g-nbr-1000',
        name: 'Uszczelka GSG DN1000 z NBR',
        price: 40,
        weight: 8,
        componentType: 'uszczelka',
        dn: '1000',
        height: 0
    },
    {
        id: 'g-nbr-1200',
        name: 'Uszczelka GSG DN1200 z NBR',
        price: 42,
        weight: 9,
        componentType: 'uszczelka',
        dn: '1200',
        height: 0
    }
];

const VARIANTS = [
    { type: 'brak', connectionCount: 0, totalPrice: 700, totalWeight: 350 },
    { type: 'GSG', connectionCount: 2, totalPrice: 732, totalWeight: 357 },
    { type: 'SDV', connectionCount: 2, totalPrice: 762, totalWeight: 363 },
    { type: 'SDV PO', connectionCount: 2, totalPrice: 792, totalWeight: 369 },
    { type: 'NBR', connectionCount: 2, totalPrice: 822, totalWeight: 375 }
];

function makeLayout() {
    return {
        kregItems: [
            { productId: 'KDB-1000-500', quantity: 2 },
            { productId: 'KDZ-1200-500', quantity: 1 }
        ],
        topItems: [],
        avrItems: [],
        dennica: { productId: 'DDD-1000-500', quantity: 1 }
    };
}

function makeWell(uszczelka: string) {
    return {
        id: 'feature-parity-gasket',
        dn: '1000',
        wellHeight: 1500,
        magazyn: 'Kluczbork',
        type: 'standard',
        uszczelka,
        kineta: 'beton',
        rzednaDna: 0,
        rzednaWlazu: 1.5,
        przejscia: [],
        config: [] as Array<{ productId: string; quantity: number }>
    };
}

function loadGasketSync() {
    const productsById = new Map(PRODUCTS.map((product) => [product.id, product]));
    const sandbox: any = {
        window: { studnieProducts: PRODUCTS },
        studnieProducts: PRODUCTS,
        getStudnieProductById: (id: string) => productsById.get(id) || null,
        getCurrentWell: () => null
    };
    vm.createContext(sandbox);
    for (const filename of ['actionsWellSync.js', 'wellConfigRules.js']) {
        const source = fs.readFileSync(
            path.join(__dirname, '../../public/js/studnie', filename),
            'utf8'
        );
        vm.runInContext(source, sandbox, { filename });
    }
    return sandbox.window;
}

function loadCandidateBuilder() {
    const gasketSync = loadGasketSync();
    const source = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/mlDualRanking.js'),
        'utf8'
    );
    const sandbox: any = {
        window: {
            location: { search: '' },
            localStorage: { getItem: () => null },
            studnieProducts: PRODUCTS,
            findGasketProduct: gasketSync.findGasketProduct
        },
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        console: { warn: () => {}, log: () => {} },
        AbortController,
        setTimeout,
        clearTimeout,
        setInterval: () => 0,
        Map,
        Set,
        Math,
        Date,
        JSON
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'mlDualRanking.js' });
    return sandbox.window.buildFeatureVector;
}

function recordTelemetry(layout: ReturnType<typeof makeLayout>, well: ReturnType<typeof makeWell>) {
    const sync = loadGasketSync();
    well.config = [...layout.kregItems, ...layout.topItems, ...layout.avrItems, layout.dennica];
    sync.recalcGaskets(well);

    let payload: any;
    const fetch = (_url: string, options: any) => {
        payload = JSON.parse(options.body);
        return Promise.resolve({ status: 200, json: () => Promise.resolve({}) });
    };
    const sandbox: any = {
        window: { studnieProducts: PRODUCTS, fetch, location: { hostname: 'localhost' } },
        fetch,
        AbortController,
        setTimeout: () => 0,
        clearTimeout: () => undefined,
        console: { warn: () => {}, error: () => {}, log: () => {} },
        JSON,
        Promise
    };
    const source = fs.readFileSync(
        path.join(__dirname, '../../public/js/studnie/telemetryBridge.js'),
        'utf8'
    );
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'telemetryBridge.js' });
    sandbox.window.telemetryRecordConfig({
        well,
        configItems: well.config,
        solverSource: 'MANUAL'
    });
    if (!payload) throw new Error('telemetryBridge did not emit a config payload');
    return payload;
}

function extractTrainingFeatures(payload: any) {
    return new FeatureExtractor().extract({
        id: 'feature-parity-gasket',
        dn: payload.dn,
        warehouse: payload.warehouse,
        wellType: payload.wellType,
        wellHeight: payload.wellHeight,
        ringCount: payload.ringCount,
        wasAccepted: true,
        allComponentIds: JSON.stringify(payload.allComponentIds),
        appliedReductions: JSON.stringify(payload.appliedReductions),
        appliedKonus: JSON.stringify(payload.appliedKonus),
        appliedSeals: JSON.stringify(payload.appliedSeals),
        featureSnapshot: JSON.stringify(payload.featureSnapshot),
        kineta: payload.kineta,
        dennicaHeight: payload.dennicaHeight,
        createdAt: new Date().toISOString()
    } as any);
}

describe('parytet ceny, wagi i połączeń dla wariantów uszczelek', () => {
    const buildFeatureVector = loadCandidateBuilder();
    const featureIndex = (name: string) => FEATURE_NAMES.indexOf(name);

    it.each(VARIANTS)(
        '$type: kandydat i rzeczywisty snapshot treningowy zgadzają się dla DN1000/DN1200',
        (expected) => {
            const layout = makeLayout();
            const well = makeWell(expected.type);
            const candidate = buildFeatureVector(layout, well);
            const telemetry = recordTelemetry(layout, well);
            const training = extractTrainingFeatures(telemetry);

            expect(telemetry.featureSnapshot.totalPrice).toBe(expected.totalPrice);
            expect(telemetry.featureSnapshot.totalWeight).toBe(expected.totalWeight);
            expect(candidate[featureIndex('connectionCount')]).toBe(expected.connectionCount);
            expect(candidate[featureIndex('totalPrice')]).toBe(expected.totalPrice);
            expect(candidate[featureIndex('totalWeight')]).toBe(expected.totalWeight);
            expect(training.connectionCount).toBe(expected.connectionCount);
            expect(training.totalPrice).toBe(expected.totalPrice);
            expect(training.totalWeight).toBe(expected.totalWeight);
        }
    );
});
