// @ts-nocheck -- testuje klasy SVG przez vm bez DOM przeglądarki.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const formSource = fs.readFileSync(
    path.join(__dirname, '../../public/js/studnie/orderZleceniaForm.js'),
    'utf8'
);

function component(index: number) {
    const classes = new Set<string>();
    return {
        getAttribute: (name: string) => (name === 'data-cfg-idx' ? String(index) : null),
        classList: {
            add: (name: string) => classes.add(name),
            remove: (name: string) => classes.delete(name)
        },
        classes
    };
}

function createPreviewContext(components: ReturnType<typeof component>[]) {
    const svg = { id: 'zlecenia-svg-preview', querySelectorAll: () => components };
    const context: any = {
        window: {},
        document: {
            getElementById: (id: string) => (id === 'zlecenia-svg-preview' ? svg : null),
            addEventListener: () => {}
        },
        renderWellDiagram: () => {},
        renderZleceniaWellConfig: () => {}
    };
    vm.createContext(context);
    vm.runInContext(formSource, context);
    return context;
}

describe('renderZleceniaSvgPreview aktywny element', () => {
    it('wyróżnia odpowiadający mu indeks konfiguracji studni', () => {
        const other = component(1);
        const active = component(2);
        const context = createPreviewContext([other, active]);
        const well = { id: 'well-1' };
        context.zleceniaSelectedIdx = 0;
        context.zleceniaElementsList = [{ well, elementIndex: 2 }];

        context.renderZleceniaSvgPreview(well);

        expect(active.classes.has('zlecenia-active-component')).toBe(true);
        expect(other.classes.has('zlecenia-active-component')).toBe(false);
    });

    it('czyści poprzednie wyróżnienie, gdy aktywny element pochodzi z innej studni', () => {
        const previous = component(2);
        previous.classList.add('zlecenia-active-component');
        const context = createPreviewContext([previous]);
        context.zleceniaSelectedIdx = 0;
        context.zleceniaElementsList = [{ well: { id: 'well-2' }, elementIndex: 2 }];

        context.renderZleceniaSvgPreview({ id: 'well-1' });

        expect(previous.classes.has('zlecenia-active-component')).toBe(false);
    });
});
