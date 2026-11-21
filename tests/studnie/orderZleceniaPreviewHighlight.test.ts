// @ts-nocheck -- testuje klasy SVG przez vm bez DOM przeglądarki.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const formSource = fs.readFileSync(
    path.join(__dirname, '../../public/js/studnie/orderZleceniaForm.js'),
    'utf8'
);
const rendererSource = fs.readFileSync(
    path.join(__dirname, '../../public/js/studnie/diagramRenderer.js'),
    'utf8'
);
const componentsSource = fs.readFileSync(
    path.join(__dirname, '../../public/js/studnie/diagramComponents.js'),
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

function createDiagramContext(components: ReturnType<typeof component>[], modalActive: boolean) {
    const modal = { classList: { contains: () => modalActive } };
    const svg: any = {
        setAttribute: () => {},
        querySelectorAll: () => components,
        innerHTML: ''
    };
    const context: any = {
        window: {},
        document: { getElementById: (id: string) => (id === 'zlecenia-modal' ? modal : null) },
        buildVisibleComponents: () => [{}],
        calculateCanvasParams: () => ({ svgW: 300, svgH: 500, pxMm: 1, totalMm: 0, cx: 150 }),
        drawAllComponents: () => ({ svg: '<g></g>', dimLinesY: [] }),
        drawTransitions: () => '',
        drawPrecoInsertLine: () => '',
        drawSegmentDimensions: () => '',
        drawTotalHeightBar: () => '',
        drawDnLabel: () => ''
    };
    vm.createContext(context);
    vm.runInContext(rendererSource, context);
    return { context, svg };
}

function renderDrilledRingShape() {
    const context: any = { window: {}, SVG_COLORS: {} };
    vm.createContext(context);
    vm.runInContext(componentsSource, context);
    return vm.runInContext(
        `drawComponentShape({ componentType: 'krag_ot' }, 0, 0, 100, 50, 50, 1, { fill: '#123', stroke: '#456' })`,
        context
    );
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

    it('wyróżnia aktywny element na głównym podglądzie studni tylko w edytorze zleceń', () => {
        const other = component(1);
        const active = component(2);
        const { context, svg } = createDiagramContext([other, active], true);
        const well = { id: 'well-1', dn: 1000, config: [{}] };
        context.zleceniaSelectedIdx = 0;
        context.zleceniaElementsList = [{ well, elementIndex: 2 }];

        context.renderWellDiagram(svg, well);

        expect(active.classes.has('zlecenia-active-component')).toBe(true);
        expect(other.classes.has('zlecenia-active-component')).toBe(false);
    });

    it('nie zostawia wyróżnienia w zwykłym podglądzie studni', () => {
        const active = component(2);
        const { context, svg } = createDiagramContext([active], false);
        const well = { id: 'well-1', dn: 1000, config: [{}] };
        context.zleceniaSelectedIdx = 0;
        context.zleceniaElementsList = [{ well, elementIndex: 2 }];

        context.renderWellDiagram(svg, well);

        expect(active.classes.has('zlecenia-active-component')).toBe(false);
    });

    it('rysuje krąg z otworami bez bocznych kółek', () => {
        expect(renderDrilledRingShape()).not.toContain('<circle');
    });
});
