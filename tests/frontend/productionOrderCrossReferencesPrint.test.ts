// @ts-nocheck -- testuje buildery wydruku w izolowanych kontekstach vm.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.join(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function escapeHtml(value: string) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

describe('powiązane numery PZ na wydrukach', () => {
    const savedPz = {
        id: 'pz-dennica',
        productionOrderNumber: 'N/00001/26',
        productionOrderPrintNumber: 'LK/00001/26',
        wellId: 'well-1',
        elementIndex: 5,
        componentType: 'dennica',
        product: { componentType: 'dennica' },
        dn: 'DN1000',
        przejscia: [],
        uwagi: 'Uwagi ręczne',
        siblingCrossReferences: 'Kręgi: K/00002/26 <script>'
    };

    it('wydruk zlecenia pokazuje magazyn zapisany w PZ, a dla starszych danych używa Kluczborka', () => {
        const editorContext: any = {
            window: {},
            buildPrzejsciaRows: () => [],
            ensureDisplayIndices: () => {},
            getPowlokaString: () => 'Brak',
            paramLabel: (value: string) => value || '',
            generateWellSvg: () => '',
            escapeHtml,
            renderTemplate: (_template: string, payload: any) => payload.MAGAZYN
        };
        vm.createContext(editorContext);
        vm.runInContext(read('public/js/studnie/printManager.js'), editorContext);

        const editorData = {
            ...savedPz,
            magazyn: 'Włocławek',
            isSavedProductionOrder: true,
            well: { dn: savedPz.dn, przejscia: [] },
            product: { componentType: 'dennica' }
        };
        expect(editorContext.buildZlecenieHtml('{{MAGAZYN}}', editorData)).toBe('Włocławek');
        expect(
            editorContext.buildZlecenieHtml('{{MAGAZYN}}', { ...editorData, magazyn: '<script>' })
        ).toBe('&lt;script&gt;');

        const catalogContext: any = {
            window: { escapeHtml },
            buildPrzejsciaRowsFromPO: () => [],
            ensureDisplayIndices: () => {},
            getPowloka: () => 'Brak',
            paramLabel: (value: string) => value || '',
            generateSvgFromPO: () => '',
            renderTemplate: (_template: string, payload: any) => payload.MAGAZYN
        };
        vm.createContext(catalogContext);
        vm.runInContext(read('public/js/spa/zleceniaHelpers.js'), catalogContext);

        expect(catalogContext.buildZlecenieFromPO('{{MAGAZYN}}', editorData)).toBe('Włocławek');
        expect(catalogContext.buildZlecenieFromPageBlock('{{MAGAZYN}}', editorData)).toBe(
            'Włocławek'
        );
        expect(
            catalogContext.buildZlecenieFromPO('{{MAGAZYN}}', {
                ...editorData,
                magazyn: '<script>'
            })
        ).toBe('&lt;script&gt;');
        expect(
            catalogContext.buildZlecenieFromPO('{{MAGAZYN}}', { ...editorData, magazyn: undefined })
        ).toBe('Kluczbork');
        expect(read('public/templates/zlecenie.html')).toContain('{{MAGAZYN}}');
    });

    it('wydruk z edytora dopisuje powiązania ze świeżo pobranego PZ', () => {
        const context: any = {
            window: {},
            buildPrzejsciaRows: () => [],
            ensureDisplayIndices: () => {},
            getPowlokaString: () => 'Brak',
            paramLabel: (value: string) => value || '',
            generateWellSvg: () => '',
            escapeHtml,
            renderTemplate: (_template: string, payload: any) => payload.UWAGI
        };
        vm.createContext(context);
        vm.runInContext(read('public/js/studnie/printManager.js'), context);

        const output = context.buildZlecenieHtml('{{UWAGI}}', {
            ...savedPz,
            well: { id: savedPz.wellId, dn: savedPz.dn, przejscia: [] },
            isSavedProductionOrder: true
        });

        expect(output).toBe('Uwagi ręczne<br><b>Kręgi: K/00002/26 &lt;script&gt;</b>');
    });

    it('wydruk pojedynczy i wsadowy z kartoteki używa tych samych uwag PZ', () => {
        const context: any = {
            window: { escapeHtml },
            buildPrzejsciaRowsFromPO: () => [],
            ensureDisplayIndices: () => {},
            getPowloka: () => 'Brak',
            paramLabel: (value: string) => value || '',
            generateSvgFromPO: () => '',
            renderTemplate: (_template: string, payload: any) => payload.UWAGI
        };
        vm.createContext(context);
        vm.runInContext(read('public/js/spa/zleceniaHelpers.js'), context);

        const singlePrint = context.buildZlecenieFromPO('{{UWAGI}}', savedPz);
        const batchPrint = context.buildZlecenieFromPageBlock('{{UWAGI}}', savedPz);

        expect(singlePrint).toBe('Uwagi ręczne<br><b>Kręgi: K/00002/26 &lt;script&gt;</b>');
        expect(batchPrint).toBe(singlePrint);
    });

    it('kartoteka i edytor budują zgodne wiersze przejść z tego samego zapisanego PZ', () => {
        const savedOrder = {
            ...savedPz,
            componentType: 'dennica',
            dn: 'DN1000',
            przejscia: [
                {
                    productId: 'PVC-200',
                    productCategory: 'PVC SN8',
                    productDn: '200',
                    flowType: 'wlot',
                    angle: 45,
                    angleGony: '50.00',
                    angleExecution: 315,
                    heightFromElementMm: 300,
                    spadekKineta: '0',
                    spadekMufa: '0'
                }
            ],
            blindKinetaPrzejscia: [
                {
                    productId: 'PVC-200',
                    productCategory: 'Ślepa kineta',
                    productDn: '200',
                    flowType: 'wlot',
                    angle: 90,
                    angleGony: '100.00',
                    angleExecution: 270,
                    isBlindKineta: true
                }
            ]
        };
        const editorData = {
            ...savedOrder,
            srednica: savedOrder.dn,
            product: { componentType: savedOrder.componentType },
            well: {
                dn: savedOrder.dn,
                rzednaDna: 0,
                przejscia: savedOrder.przejscia,
                malowanieW: 'brak',
                malowanieZ: 'brak'
            },
            isSavedProductionOrder: true
        };
        const helperContext: any = {
            window: { escapeHtml },
            ensureDisplayIndices: () => {},
            paramLabel: (value: string) => value || '',
            getPowloka: () => 'Brak',
            generateSvgFromPO: () => '',
            renderTemplate: (_template: string, payload: any) => payload.UWAGI
        };
        vm.createContext(helperContext);
        vm.runInContext(read('public/js/spa/zleceniaHelpers.js'), helperContext);

        const editorContext: any = {
            window: { escapeHtml },
            FLOW_TYPES: { WYLOT: 'wylot' },
            studnieProducts: [],
            ensureDisplayIndices: () => {},
            paramLabel: (value: string) => value || '',
            escapeHtml,
            logger: { error() {}, warn() {}, info() {} }
        };
        vm.createContext(editorContext);
        vm.runInContext(read('public/js/studnie/printManager.js'), editorContext);

        const catalogRows = helperContext.buildPrzejsciaRowsFromPO(savedOrder);
        const editorRows = editorContext.buildPrzejsciaRows(editorData);

        expect(catalogRows).toEqual(editorRows);
        expect(catalogRows[0]).toMatchObject({
            rodzaj: 'PVC SN8',
            srednica: '200',
            spadekKineta: '',
            spadekMufa: '',
            uwagi: '+ 300 mm'
        });
        expect(catalogRows[1]).toMatchObject({
            rodzaj: 'Ślepa kineta',
            srednica: '200',
            uwagi: 'Ślepa'
        });
    });

    it('kartoteka i edytor budują tę samą zawartość etykiety z zapisanego PZ', () => {
        const savedOrder = {
            ...savedPz,
            snr: 's2',
            srednica: 'DN1000',
            productName: 'Dennica DN1000 H=750/600',
            etykietaElementy: [
                { ilosc: '1 szt.', indeks: 'DDD-10-075', nazwa: 'Dennica DN1000' },
                { ilosc: '3 szt.', indeks: 'KZ-10-100', nazwa: 'Krąg DN1000' }
            ]
        };
        const template =
            '{{SNR}}|{{MAIN_ELEMENT}}|{{NR_ZLECENIA}}|{{ELEMENTY_ROWS}}|{{CERT_IMG}}|{{CERT_ALT}}|{{CERT_TEXT}}';
        const helperContext: any = {
            window: { escapeHtml },
            escapeHtml,
            renderTemplate: (html: string, payload: any) =>
                html.replace(/{{([A-Z_]+)}}/g, (_match, key) => payload[key] || '')
        };
        vm.createContext(helperContext);
        vm.runInContext(read('public/js/spa/zleceniaHelpers.js'), helperContext);

        const editorContext: any = {
            window: { escapeHtml },
            escapeHtml,
            renderTemplate: (html: string, payload: any) =>
                html.replace(/{{([A-Z_]+)}}/g, (_match, key) => payload[key] || '')
        };
        vm.createContext(editorContext);
        vm.runInContext(read('public/js/studnie/printEtykietaHelpers.js'), editorContext);

        const catalogOutput = helperContext.buildEtykietaFromPO(template, savedOrder);
        const editorOutput = editorContext.buildEtykietaHtml(template, savedOrder);
        const normalizeMarkupWhitespace = (html: string) =>
            html
                .replace(/>\s+</g, '><')
                .replace(/\s*\|\s*/g, '|')
                .trim();

        expect(normalizeMarkupWhitespace(catalogOutput)).toBe(
            normalizeMarkupWhitespace(editorOutput)
        );
    });

    it('wydruk PZ używa kanonicznego numeru zamiast numeru z symbolem opiekuna', () => {
        const context: any = {
            window: { escapeHtml },
            buildPrzejsciaRowsFromPO: () => [],
            ensureDisplayIndices: () => {},
            getPowloka: () => 'Brak',
            paramLabel: (value: string) => value || '',
            generateSvgFromPO: () => '',
            renderTemplate: (_template: string, payload: any) => payload.NR_ZLECENIA
        };
        vm.createContext(context);
        vm.runInContext(read('public/js/spa/zleceniaHelpers.js'), context);

        expect(context.buildZlecenieFromPO('{{NR_ZLECENIA}}', savedPz)).toBe('N/00001/26');
        expect(context.buildZlecenieFromPageBlock('{{NR_ZLECENIA}}', savedPz)).toBe('N/00001/26');
    });
});
