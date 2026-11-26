// @ts-nocheck -- diagramComponents.js jest klasycznym skryptem uruchamianym w vm.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const source = fs.readFileSync(
    path.join(__dirname, '../../public/js/studnie/diagramComponents.js'),
    'utf8'
);
const dragSource = fs.readFileSync(
    path.join(__dirname, '../../public/js/studnie/offerSvgDrag.js'),
    'utf8'
);
const diagramCss = fs.readFileSync(path.join(__dirname, '../../public/css/studnie.css'), 'utf8');

function createContext(dropIndex: number) {
    const context: any = {
        window: { RELIEF_DYLATACJA_MM: 50 },
        _svgDropTargetIndex: dropIndex,
        SVG_COLORS: {
            dimLine: 'dim-line',
            dimText: 'dim-text',
            fallback: 'fallback',
            fallback_stroke: 'fallback-stroke',
            labelWhite: 'label'
        },
        COMPONENT_THEME: {},
        reliefDylatacjaMm: () => 50
    };
    vm.createContext(context);
    vm.runInContext(source, context);
    return context;
}

const components = [
    { _cfgIdx: 0, componentType: 'krag', height: 100, isPlaceholder: false },
    { _cfgIdx: 1, componentType: 'krag', height: 120, isPlaceholder: true }
];
const canvas = {
    pxMm: 1,
    cx: 150,
    mT: 20,
    bodyDN: 1000,
    relief: { ringZero: new Set(), gapAfter: new Set() }
};

describe('diagram studni — brak przerwy w podglądzie przeciągania', () => {
    it('nie dodaje markera ani przerwy przy wskazanym miejscu upuszczenia', () => {
        const context = createContext(1);
        const { svg } = context.drawAllComponents(components, canvas);

        expect(svg).not.toContain('well-diagram-drop-marker');
        expect(svg).toContain('y="120"');
        expect(svg).toContain('data-cfg-idx="1"');
    });

    it('nie dodaje wskaźnika poza przeciąganiem', () => {
        const context = createContext(-1);
        const { svg } = context.drawAllComponents(components, canvas);

        expect(svg).not.toContain('well-diagram-drop-marker');
    });

    it('nie rysuje kropek, linii ani przerwy', () => {
        const { svg } = createContext(1).drawAllComponents(components, canvas);

        expect(svg).not.toContain('well-diagram-drop-marker');
        expect(svg).not.toContain('well-diagram-drop-marker__dot');
        expect(diagramCss).not.toContain('well-diagram-drop-flow');
        expect(diagramCss).not.toContain('well-diagram-drop-marker');
    });

    it('nie dodaje przerwy po ostatnim elemencie', () => {
        const context = createContext(2);
        const { svg } = context.drawAllComponents(components, canvas);

        expect(svg).not.toContain('well-diagram-drop-marker');
        expect(svg).not.toContain('height="8"');
    });

    it('aktualizuje wskaźnik zgodnie z pozycją kursora między elementami', () => {
        const groups = [0, 1, 2].map((index) => ({
            getAttribute: () => String(index),
            getBoundingClientRect: () => ({ top: index * 100, height: 50 })
        }));
        const well = { config: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
        const context: any = {
            window: { svgDragStartIndex: 0, requestAnimationFrame: (callback) => callback() },
            _svgDropTargetIndex: 0,
            getCurrentWell: () => well,
            document: {
                getElementById: () => ({
                    querySelectorAll: () => groups
                })
            },
            renderWellDiagram: () => {}
        };
        vm.createContext(context);
        vm.runInContext(dragSource, context);
        context.window.svgDragStartIndex = 0;

        context.handleLiveSvgDrag(220);

        expect(vm.runInContext('_svgDropTargetIndex', context)).toBe(1);
        expect(context.window.svgDragStartIndex).toBe(1);
        expect(well.config.map((item) => item.id)).toEqual(['b', 'a', 'c']);
    });
});
