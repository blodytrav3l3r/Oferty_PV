import fs from 'fs';
import path from 'path';
import vm from 'vm';

/**
 * Wspólny harness vm dla legacy plików public/js/studnie.
 * Pliki są klasycznymi skryptami (bez ESM): uruchamiamy je w kontekście,
 * w którym `window` jest tym samym obiektem co globalny kontekst — tak jak
 * w przeglądarce. DOM jest minimalnym stubem: testy rejestrują elementy,
 * których naprawdę używa testowana funkcja.
 */

export interface FakeEl {
    id: string;
    innerHTML: string;
    textContent: string;
    value: string;
    checked: boolean;
    disabled: boolean;
    hidden: boolean;
    style: Record<string, string>;
    dataset: Record<string, string>;
    attrs: Record<string, string>;
    children: any[];
    handlers: Record<string, Array<(...args: any[]) => any>>;
    classList: {
        add: (...names: string[]) => void;
        remove: (...names: string[]) => void;
        toggle: (name: string, force?: boolean) => boolean;
        contains: (name: string) => boolean;
    };
    setAttribute: (name: string, value: unknown) => void;
    getAttribute: (name: string) => string | null;
    addEventListener: (type: string, fn: (...args: any[]) => any) => void;
    appendChild: (child: any) => any;
    append: (...children: any[]) => void;
    remove: () => void;
    focus: () => void;
    insertAdjacentHTML: (position: string, html: string) => void;
    contains: (other: any) => boolean;
    closest: (selector: string) => any;
    querySelector: (selector: string) => any;
    querySelectorAll: (selector: string) => any[];
    dispatch?: (type: string, event?: any) => Promise<void>;
    [key: string]: any;
}

function toCamel(name: string): string {
    return name.slice(5).replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

export function makeEl(id: string, props: Record<string, unknown> = {}): FakeEl {
    const classes = new Set<string>();
    const el: FakeEl = {
        id,
        innerHTML: '',
        textContent: '',
        value: '',
        checked: false,
        disabled: false,
        hidden: false,
        style: {},
        dataset: {},
        attrs: {},
        children: [],
        handlers: {},
        classList: {
            add: (...names) => names.forEach((n) => classes.add(n)),
            remove: (...names) => names.forEach((n) => classes.delete(n)),
            toggle: (name, force) => {
                const on = force === undefined ? !classes.has(name) : force;
                if (on) classes.add(name);
                else classes.delete(name);
                return on;
            },
            contains: (name) => classes.has(name)
        },
        setAttribute(name, value) {
            el.attrs[name] = String(value);
            if (name.startsWith('data-')) el.dataset[toCamel(name)] = String(value);
        },
        getAttribute: (name) => el.attrs[name] ?? null,
        addEventListener: (type, fn) => {
            el.handlers[type] = [...(el.handlers[type] || []), fn];
        },
        appendChild: (child) => {
            el.children.push(child);
            return child;
        },
        append: (...children) => {
            el.children.push(...children);
        },
        remove: () => {
            el.removed = true;
        },
        focus: () => {
            el.focused = true;
        },
        insertAdjacentHTML: (_position, html) => {
            el.innerHTML += html;
        },
        contains: (other) => other === el || el.children.includes(other),
        closest: (selector) => {
            if (selector === '[data-action]') return el.attrs['data-action'] ? el : null;
            return null;
        },
        querySelector: (selector) => el.queryOne?.[selector] ?? null,
        querySelectorAll: (selector) => el.queryAll?.[selector] ?? []
    };
    Object.assign(el, props);
    el.dispatch = async (type, event = {}) => {
        for (const fn of el.handlers[type] || []) await fn(event);
    };
    return el;
}

export interface FakeDom {
    els: Map<string, FakeEl>;
    body: FakeEl;
    document: any;
    el: (id: string) => FakeEl;
    register: (id: string, props?: Record<string, unknown>) => FakeEl;
    setQueryAll: (selector: string, items: any[]) => void;
    setQueryOne: (selector: string, item: any) => void;
}

export function createDom(): FakeDom {
    const els = new Map<string, FakeEl>();
    const queryAll = new Map<string, any[]>();
    const queryOne = new Map<string, any>();
    const body = makeEl('body');

    const el = (id: string) => {
        const existing = els.get(id);
        if (existing) return existing;
        const created = makeEl(id);
        els.set(id, created);
        return created;
    };

    const document = {
        body,
        activeElement: null,
        getElementById: (id: string) => els.get(id) ?? null,
        createElement: (tag: string) => {
            const created = makeEl(`dyn-${tag}`);
            created.tag = tag;
            return created;
        },
        querySelectorAll: (selector: string) => queryAll.get(selector) ?? [],
        querySelector: (selector: string) => queryOne.get(selector) ?? null,
        addEventListener: () => undefined
    };

    return {
        els,
        body,
        document,
        el,
        register: (id, props) => {
            const created = makeEl(id, props);
            els.set(id, created);
            return created;
        },
        setQueryAll: (selector, items) => queryAll.set(selector, items),
        setQueryOne: (selector, item) => queryOne.set(selector, item)
    };
}

export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function escapeHtmlAttr(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export interface HarnessOptions {
    /** Ścieżka względem katalogu repo, np. public/js/studnie/offerHistory.js */
    file: string;
    dom: FakeDom;
    /** Dodatkowe globals (window === kontekst). */
    globals?: Record<string, unknown>;
    /** Wyrażenie zwracające funkcje do przetestowania, np. `{ renderWellParams }`. */
    expose?: string;
    /** Callbacki setTimeout wykonujemy od razu — testy nie czekają. */
    runTimers?: boolean;
}

export interface Harness {
    context: any;
    exposed: any;
    dom: FakeDom;
}

export function loadStudnieScript(options: HarnessOptions): Harness {
    const { file, dom, expose, globals = {}, runTimers = true } = options;
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    const structuredCloneFn =
        (globalThis as { structuredClone?: (value: unknown) => unknown }).structuredClone ??
        ((value: unknown) => JSON.parse(JSON.stringify(value)));
    const context: any = {
        console,
        document: dom.document,
        structuredClone: structuredCloneFn,
        setTimeout: (fn: (...args: any[]) => void, _ms?: number) => {
            if (runTimers) fn();
            return 0;
        },
        clearTimeout: () => undefined,
        setInterval: () => 0,
        clearInterval: () => undefined,
        ...globals
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(source + (expose ? `\nthis.__exposed = (${expose});` : ''), context, {
        filename: file
    });
    return { context, exposed: context.__exposed, dom };
}
