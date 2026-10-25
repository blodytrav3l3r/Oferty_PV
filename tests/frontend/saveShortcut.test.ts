// @ts-nocheck -- vm sandbox, celowy brak typow dla public/js
import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * L1: Ctrl+S musi wykonywać realny zapis w module (rury/studnie), nie tylko
 * na pulpicie i nie tylko poza polem formularza.
 */
function readJs(rel: string): string {
    return fs.readFileSync(path.join(__dirname, '../../public/js', rel), 'utf8');
}

function loadCtx(globals: Record<string, unknown> = {}) {
    let handler: any = null;
    const sandbox: any = {
        console,
        Promise,
        document: {
            addEventListener: (evt: string, fn: any) => {
                if (evt === 'keydown') handler = fn;
            }
        },
        window: {} as any
    };
    Object.assign(sandbox.window, globals);
    vm.createContext(sandbox);
    vm.runInContext(readJs('shared/saveShortcut.js'), sandbox, { filename: 'saveShortcut.js' });
    return { sandbox, keydown: (e: any) => handler && handler(e) };
}

function evt(key = 's', mods: { ctrlKey?: boolean; metaKey?: boolean } = {}) {
    return {
        key,
        ctrlKey: !!mods.ctrlKey,
        metaKey: !!mods.metaKey,
        prevented: false,
        preventDefault() {
            this.prevented = true;
        }
    };
}

describe('L1 saveShortcut — Ctrl+S zapisuje naprawdę', () => {
    it('rury: woła saveOfferOrOrder i blokuje domyślny zapis strony', () => {
        const calls: string[] = [];
        const { keydown } = loadCtx({ saveOfferOrOrder: () => void calls.push('offerOrOrder') });
        const e = evt('s', { ctrlKey: true });
        keydown(e);
        expect(calls).toEqual(['offerOrOrder']);
        expect(e.prevented).toBe(true);
    });

    it('studnie: tryb zamówienia → saveCurrentOrder, oferta → saveOfferStudnie', () => {
        const calls: string[] = [];
        const order = loadCtx({
            orderEditMode: true,
            saveCurrentOrder: () => void calls.push('order'),
            saveOfferStudnie: () => void calls.push('offer')
        });
        order.keydown(evt('s', { ctrlKey: true }));
        expect(calls).toEqual(['order']);

        const offer = loadCtx({
            orderEditMode: false,
            saveCurrentOrder: () => void calls.push('order2'),
            saveOfferStudnie: () => void calls.push('offer2')
        });
        offer.keydown(evt('s', { ctrlKey: true }));
        expect(calls).toEqual(['order', 'offer2']);
    });

    it('Cmd+S działa jak Ctrl+S', () => {
        const calls: string[] = [];
        const { keydown } = loadCtx({ saveOfferOrOrder: () => void calls.push('x') });
        keydown(evt('s', { metaKey: true }));
        expect(calls).toEqual(['x']);
    });

    it('brak funkcji zapisu → brak preventDefault (przeglądarka może zapisać stronę)', () => {
        const { keydown } = loadCtx({});
        const e = evt('s', { ctrlKey: true });
        keydown(e);
        expect(e.prevented).toBe(false);
    });

    it('inny klawisz i brak modyfikatora → brak akcji', () => {
        const calls: string[] = [];
        const { keydown } = loadCtx({ saveOfferOrOrder: () => void calls.push('x') });
        keydown(evt('a', { ctrlKey: true }));
        keydown(evt('s'));
        expect(calls).toEqual([]);
    });

    it('błąd zapisu nie wywala handlera', () => {
        const { keydown } = loadCtx({
            saveOfferOrOrder: () => {
                throw new Error('boom');
            }
        });
        const e = evt('s', { ctrlKey: true });
        expect(() => keydown(e)).not.toThrow();
        expect(e.prevented).toBe(true);
    });
});
