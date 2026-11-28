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
});
