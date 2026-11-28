import fs from 'fs';
import path from 'path';
import vm from 'vm';

const MODULE_PATH = path.join(__dirname, '../../public/js/studnie/aiOfferStatus.js');

class EventTargetMock {
    listeners = new Map<string, (() => void)[]>();

    addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, [...(this.listeners.get(type) || []), listener]);
    }

    dispatchEvent(event: { type: string }) {
        this.listeners.get(event.type)?.forEach((listener) => listener());
    }
}

describe('AI offer status UI lifecycle', () => {
    it('refreshes after the offer renderer dispatches its event on window', () => {
        const panel = { querySelector: () => null };
        const scheduled: (() => void)[] = [];
        const document = Object.assign(new EventTargetMock(), {
            documentElement: {},
            getElementById: (id: string) => (id === 'ai-offer-status' ? panel : null)
        });
        const window = Object.assign(new EventTargetMock(), {
            editingOfferIdStudnie: null,
            wells: [],
            clearTimeout() {},
            setTimeout: (callback: () => void) => {
                scheduled.push(callback);
                return scheduled.length;
            }
        });
        const context = {
            document,
            window,
            MutationObserver: class {
                observe() {}
                disconnect() {}
            },
            clearTimeout() {}
        };
        const source = fs
            .readFileSync(MODULE_PATH, 'utf8')
            .replace("import { fetchJson } from '../shared/fetchJson.js';", '');
        vm.runInNewContext(source, context, { filename: MODULE_PATH });
        const initializationSchedules = scheduled.length;

        window.dispatchEvent({ type: 'sok:studnie-offer-rendered' });

        expect(scheduled.length).toBe(initializationSchedules + 1);
    });

    it('does not re-trigger the list observer when an AI status is unchanged', async () => {
        const scheduled: (() => void)[] = [];
        const mutationCallbacks: (() => void)[] = [];
        let writes = 0;
        let observerRuns = 0;
        let indicatorText = '';
        let statusResponse: { wells?: { wellId: string; status: string }[]; error?: string } = {
            wells: [{ wellId: 'well-1', status: 'NO_DATA' }]
        };
        const list = {
            querySelectorAll: (selector: string) =>
                selector.includes('[data-ai-well-status]') ? [indicator] : [card]
        };
        const indicator = {
            title: '',
            hidden: true,
            attributes: new Map<string, string>(),
            classes: new Set<string>(),
            classList: {
                add(className: string) {
                    indicator.classes.add(className);
                },
                remove(className: string) {
                    indicator.classes.delete(className);
                }
            },
            setAttribute(name: string, value: string) {
                indicator.attributes.set(name, value);
            },
            removeAttribute(name: string) {
                indicator.attributes.delete(name);
            },
            get textContent() {
                return indicatorText;
            },
            set textContent(value: string) {
                indicatorText = value;
                writes += 1;
                mutationCallbacks.forEach((callback) => callback());
            }
        };
        const card = {
            querySelector: () => indicator,
            getAttribute: () => 'well-1'
        };
        const countsHost = { hidden: true, replaceChildren() {}, append() {} };
        const message = { textContent: '' };
        const content = { hidden: false };
        const toggleListeners = new Map<string, () => void>();
        const toggleAttributes = new Map<string, string>();
        const toggle = {
            addEventListener(type: string, listener: () => void) {
                toggleListeners.set(type, listener);
            },
            setAttribute(name: string, value: string) {
                toggleAttributes.set(name, value);
            },
            click() {
                toggleListeners.get('click')?.();
            }
        };
        const panel = {
            hidden: true,
            querySelector: (selector: string) => {
                if (selector === '[data-ai-status-counts]') return countsHost;
                if (selector === '[data-ai-status-content]') return content;
                if (selector === '[data-ai-status-toggle]') return toggle;
                return message;
            },
            setAttribute() {}
        };
        const document = Object.assign(new EventTargetMock(), {
            documentElement: {},
            getElementById: (id: string) =>
                id === 'ai-offer-status' ? panel : id === 'wells-list' ? list : null,
            createElement: () => ({
                className: '',
                textContent: '',
                setAttribute() {},
                append() {}
            })
        });
        const window = Object.assign(new EventTargetMock(), {
            editingOfferIdStudnie: 'offer-1',
            wells: [{ id: 'well-1' }],
            collapseGet: () => true,
            collapseSet: jest.fn(),
            clearTimeout() {},
            setTimeout: (callback: () => void) => {
                scheduled.push(callback);
                return scheduled.length;
            }
        });
        const context = {
            document,
            window,
            URLSearchParams,
            fetchJson: async () => statusResponse,
            MutationObserver: class {
                constructor(private readonly callback: () => void) {}

                observe(target: unknown) {
                    if (target === list) {
                        mutationCallbacks.push(() => {
                            observerRuns += 1;
                            this.callback();
                        });
                    }
                }

                disconnect() {}
            },
            clearTimeout() {}
        };
        const source = fs
            .readFileSync(MODULE_PATH, 'utf8')
            .replace("import { fetchJson } from '../shared/fetchJson.js';", '');
        vm.runInNewContext(source, context, { filename: MODULE_PATH });

        expect(content.hidden).toBe(false);
        expect(toggleAttributes.get('aria-expanded')).toBe('true');
        toggle.click();
        expect(content.hidden).toBe(true);
        expect(toggleAttributes.get('aria-expanded')).toBe('false');
        expect(window.collapseSet).toHaveBeenCalledWith('ai-offer-status-content', false);
        toggle.click();
        expect(content.hidden).toBe(false);

        scheduled[0]();
        for (let index = 0; index < 10; index += 1) await Promise.resolve();

        expect(writes).toBe(1);
        expect(observerRuns).toBe(1);
        expect(panel.hidden).toBe(false);

        statusResponse = { error: 'forbidden' };
        document.dispatchEvent({ type: 'sok:ai-offer-status-refresh' });
        scheduled[scheduled.length - 1]();
        for (let index = 0; index < 10; index += 1) await Promise.resolve();

        expect(panel.hidden).toBe(true);
        expect(indicator.hidden).toBe(true);
        expect(indicator.textContent).toBe('');
        expect(indicator.title).toBe('');
        expect(indicator.attributes.has('aria-label')).toBe(false);
        expect(indicator.classes.size).toBe(0);
        expect(countsHost.hidden).toBe(true);

        statusResponse = { error: 'server' };
        document.dispatchEvent({ type: 'sok:ai-offer-status-refresh' });
        scheduled[scheduled.length - 1]();
        for (let index = 0; index < 10; index += 1) await Promise.resolve();

        expect(panel.hidden).toBe(true);
        expect(indicator.hidden).toBe(true);
        expect(indicator.textContent).toBe('');
    });
});
