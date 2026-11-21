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
        wellId: 'well-1',
        elementIndex: 5,
        componentType: 'dennica',
        product: { componentType: 'dennica' },
        dn: 'DN1000',
        przejscia: [],
        uwagi: 'Uwagi ręczne',
        siblingCrossReferences: 'Kręgi: K/00002/26 <script>'
    };

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
});
