// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

function readJs(name: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js/studnie', name), 'utf8');
}

function readCss(): string {
    return fs.readFileSync(path.join(__dirname, '../../public/css/studnie.css'), 'utf8');
}

describe('krag_ot odroznia sie od krag (kolor)', () => {
    test('SSoT fill rozny (diagram + naglowek light)', () => {
        const ctx: any = { window: {} };
        vm.createContext(ctx);
        vm.runInContext(readJs('diagramTheme.js'), ctx);
        const theme = ctx.window.COMPONENT_THEME;
        expect(theme.krag.fill).not.toBe(theme.krag_ot.fill);
        expect(theme.krag_ot.fill).toContain('purple');
    });

    test('mapy bg kaflekov rozne', () => {
        for (const f of [
            'actionsConfigRender.js',
            'orderZleceniaRender.js',
            'transitionRenderer.js'
        ]) {
            const src = readJs(f);
            expect(src).toContain('krag_ot');
            // zaden krag_ot nie dzieli bg ze zwyklym kragiem
            expect(src).not.toMatch(/krag_ot:\s*\{\s*bg:\s*'var\(--cmp-krag\)'/);
        }
    });

    test('tint komorek Excela rozny', () => {
        const css = readCss();
        expect(css).toMatch(/excel-tint--krag_ot[\s\S]*?purple-alt/);
        expect(css).toMatch(
            /\.tile\[data-type='krag_ot'\][\s\S]*?--tile-accent:\s*var\(--purple-alt\)/
        );
    });
});
