import fs from 'fs';
import path from 'path';
import vm from 'vm';

const dragSource = fs.readFileSync(
    path.join(__dirname, '../../public/js/studnie/actionsConfigDrag.js'),
    'utf8'
);
const cssSource = fs.readFileSync(path.join(__dirname, '../../public/css/studnie.css'), 'utf8');

function makeTile(index: number, list: { querySelectorAll: () => Tile[] }): Tile {
    const classes = new Set(['config-tile', 'is-drop-target']);
    return {
        parentElement: list,
        classList: {
            add: (className) => classes.add(className),
            remove: (...classNames) => classNames.forEach((className) => classes.delete(className)),
            contains: (className) => classes.has(className),
            toggle: (className, force) => {
                if (force) classes.add(className);
                else classes.delete(className);
                return force;
            }
        },
        getAttribute: (name) => (name === 'data-cfg-idx' ? String(index) : null),
        getBoundingClientRect: () => ({ top: 0, height: 20 })
    };
}

interface Tile {
    parentElement: { querySelectorAll: () => Tile[] };
    classList: {
        add: (className: string) => void;
        remove: (...classNames: string[]) => void;
        contains: (className: string) => boolean;
        toggle: (className: string, force: boolean) => boolean;
    };
    getAttribute: (name: string) => string | null;
    getBoundingClientRect: () => { top: number; height: number };
}

describe('studnie: podgląd miejsca upuszczenia elementu', () => {
    it('zostawia aktywną przerwę tylko przy aktualnie wskazanym kafelku', () => {
        const tiles: Tile[] = [];
        const list = { querySelectorAll: () => tiles };
        const previous = makeTile(0, list);
        const target = makeTile(1, list);
        tiles.push(previous, target);

        const window: Record<string, (...args: any[]) => void> = {};
        const well = { config: [{ id: 'a' }, { id: 'b' }] };
        const context = vm.createContext({
            window,
            document: { querySelectorAll: () => [] },
            getCurrentWell: () => well
        });
        vm.runInContext(dragSource, context);
        vm.runInContext('draggedCfgIndex = 0', context);

        window.handleCfgDragOver({
            preventDefault: () => {},
            dataTransfer: {},
            clientY: 5,
            target: { closest: () => target }
        });

        expect(previous.classList.contains('is-drop-target')).toBe(false);
        expect(target.classList.contains('is-drop-target')).toBe(true);
        expect(target.classList.contains('is-drop-target--after')).toBe(false);
        expect(well.config.map((item) => item.id)).toEqual(['a', 'b']);

        window.handleCfgDragOver({
            preventDefault: () => {},
            dataTransfer: {},
            clientY: 15,
            target: { closest: () => target }
        });

        expect(target.classList.contains('is-drop-target--after')).toBe(true);
        expect(well.config.map((item) => item.id)).toEqual(['a', 'b']);
    });

    it('otwiera animowany slot przed i za wskazanym kafelkiem', () => {
        expect(cssSource).toMatch(
            /\.config-tile\.is-drop-target:not\(\.is-drop-target--after\),\s*\.zl-config-tile\.is-drop-target:not\(\.is-drop-target--after\)\s*\{[^}]*margin-top:\s*var\(--tile-gap-sm-plus\)/s
        );
        expect(cssSource).toContain("content: 'WSTAW ELEMENT';");
        expect(cssSource).toMatch(/transition:\s*margin-top/);
        expect(cssSource).toContain('.config-tile.is-drop-target--after');
        expect(cssSource).toContain('.zl-config-tile.is-drop-target--after');
        expect(cssSource).toMatch(/\.zl-config-tile\s*\{\s*position:\s*relative;/);
    });

    it.each([
        { clientY: 5, expected: ['b', 'c', 'a', 'd'] },
        { clientY: 15, expected: ['b', 'c', 'd', 'a'] }
    ])('umieszcza element $clientY przed lub za wierszem docelowym', ({ clientY, expected }) => {
        const well = { config: ['a', 'b', 'c', 'd'].map((id) => ({ id })) };
        const window: Record<string, (...args: any[]) => void> = {};
        const context = vm.createContext({
            window,
            document: { querySelectorAll: () => [] },
            getCurrentWell: () => well,
            isOfferLocked: () => false,
            isWellLocked: () => false,
            updateAutoLockUI: () => {},
            renderWellConfig: () => {},
            renderWellDiagram: () => {},
            updateSummary: () => {},
            updateHeightIndicator: () => {}
        });
        vm.runInContext(dragSource, context);
        vm.runInContext('draggedCfgIndex = 0', context);

        window.handleCfgDrop({
            preventDefault: () => {},
            stopPropagation: () => {},
            clientY,
            target: { closest: () => makeTile(3, { querySelectorAll: () => [] }) }
        });

        expect(well.config.map((item) => item.id)).toEqual(expected);
    });
});
