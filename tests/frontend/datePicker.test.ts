/**
 * @jest-environment jsdom
 */

// @ts-nocheck
/**
 * Kalendarz S.O.K. dla input[type=date] (shared/datePicker.js) + układ paska
 * filtrów kartoteki. Natywny popup Chromium nie da się ostylować, więc pole
 * jest readonly i otwiera własny popover — test pilnuje zapisu wartości,
 * wysłania `change` i podpinania pól dodanych po starcie (modale, partiale).
 */

import fs from 'fs';
import path from 'path';

function read(rel: string): string {
    return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

const src = read('public/js/shared/datePicker.js');
const kartotekaHtml = read('public/kartoteka.html');
const responsive = read('public/css/style.responsive.css');
const utilities = read('public/css/style.utilities.css');
const base = read('public/css/style.base.css');

const FIELD =
    '<input type="date" id="ka-date-from" aria-label="Data od" />' +
    '<input type="datetime-local" id="fu-contacted-at" aria-label="Data kontaktu" />';

let input: HTMLInputElement;
let dtInput: HTMLInputElement;

beforeAll(() => {
    document.body.innerHTML = FIELD;
    input = document.getElementById('ka-date-from') as HTMLInputElement;
    dtInput = document.getElementById('fu-contacted-at') as HTMLInputElement;
    new Function(src)();
    if (!input.readOnly) document.dispatchEvent(new Event('DOMContentLoaded'));
});

beforeEach(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    input.value = '';
});

const openPanel = (target: HTMLInputElement = input): HTMLElement => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return document.querySelector('.sok-datepicker') as HTMLElement;
};

const clickDay = (value: string): void => {
    const day = document.querySelector(`.sok-datepicker [data-date="${value}"]`) as HTMLElement;
    day.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

describe('kalendarz S.O.K. dla pól daty', () => {
    it('pole jest readonly (blokuje natywny popup) i otwiera kalendarz', () => {
        const panel = openPanel();
        expect(input.readOnly).toBe(true);
        expect(input.getAttribute('aria-haspopup')).toBe('dialog');
        expect(input.hasAttribute('aria-expanded')).toBe(false);
        expect(panel.hidden).toBe(false);
        expect(panel.getAttribute('role')).toBe('dialog');
        expect(panel.querySelectorAll('.sok-datepicker-day').length).toBe(42);
    });

    it('wybór dnia zapisuje wartość i wysyła change', () => {
        let changes = 0;
        input.addEventListener('change', () => changes++);
        openPanel();
        clickDay('2026-11-15');
        expect(input.value).toBe('2026-11-15');
        expect(changes).toBe(1);
        expect((document.querySelector('.sok-datepicker') as HTMLElement).hidden).toBe(true);
        expect(input.hasAttribute('aria-expanded')).toBe(false);
    });

    it('datetime-local: to samo okno + pole godziny, wartość data+czas', () => {
        dtInput.value = '2026-11-10T09:45';
        const panel = openPanel(dtInput);
        const timeWrap = panel.querySelector('.sok-datepicker-time') as HTMLElement;
        const timeField = timeWrap.querySelector('input') as HTMLInputElement;
        expect(timeWrap.hidden).toBe(false);
        expect(timeField.value).toBe('09:45');
        clickDay('2026-11-15');
        expect(dtInput.value).toBe('2026-11-15T09:45');
    });

    it('pole date chowa wiersz godziny', () => {
        openPanel(dtInput);
        const panel = openPanel(input);
        expect((panel.querySelector('.sok-datepicker-time') as HTMLElement).hidden).toBe(true);
    });

    it('Escape zamyka panel i wraca focus na pole', () => {
        const panel = openPanel();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(panel.hidden).toBe(true);
        expect(document.activeElement).toBe(input);
    });

    it('„Wyczyść" zeruje pole i odświeża filtr', () => {
        input.value = '2026-11-15';
        let changes = 0;
        input.addEventListener('change', () => changes++);
        const panel = openPanel();
        (panel.querySelector('[data-act="clear"]') as HTMLElement).dispatchEvent(
            new MouseEvent('click', { bubbles: true })
        );
        expect(input.value).toBe('');
        expect(changes).toBe(1);
    });

    it('pole dodane po starcie (modal/partial) też dostaje kalendarz', async () => {
        const late = document.createElement('input');
        late.type = 'date';
        late.id = 'late-date';
        document.body.appendChild(late);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(late.readOnly).toBe(true);
        expect(late.getAttribute('data-sok-datepicker')).toBe('1');
    });
});

describe('kartoteka: pasek filtrów — układ i estetyka', () => {
    it('dwie linie: osie filtrowania osobno, wartości i akcje osobno', () => {
        expect(kartotekaHtml).toContain('<div class="ka-filter-row">');
        expect(kartotekaHtml).toContain('<div class="ka-filter-row ka-filter-row--secondary">');
        expect(responsive).toMatch(/\.ka-filter-row--secondary\s*\{[^}]*border-top:\s*1px solid/);
        expect(responsive).toMatch(/\.ka-filter-actions\s*\{[^}]*margin-left:\s*auto/);
    });

    it('przełącznik wstrzymanych i reset siedzą w akcjach, nie w grupie „Los"', () => {
        const actions = kartotekaHtml.slice(kartotekaHtml.indexOf('ka-filter-actions'));
        expect(actions.indexOf('ka-hide-paused-btn')).toBeGreaterThan(-1);
        expect(actions.indexOf('ka-clear-filters')).toBeGreaterThan(-1);
        expect(kartotekaHtml).not.toContain('divider-v');
    });

    it('separator grup to obramowanie grupy (nie znika przy zawijaniu)', () => {
        expect(responsive).toMatch(
            /\.kartoteka-filter-bar \.ka-filter-group \+ \.ka-filter-group\s*\{[^}]*border-left:\s*1px solid var\(--border\)/
        );
    });
});

describe('kalendarz: styl i zasięg (wszystkie moduły)', () => {
    it('ikona kalendarza to token motywu, natywny wskaźnik ukryty', () => {
        expect(base).toMatch(/--sok-calendar-icon:\s*url\("data:image\/svg\+xml/);
        expect(base.match(/--sok-calendar-icon:/g)?.length).toBe(2); // dark + light
        expect(utilities).toMatch(
            /input\[type='date'\],\s*input\[type='datetime-local'\]\s*\{[^}]*background-image:\s*var\(--sok-calendar-icon\) !important/
        );
        expect(utilities).toMatch(
            /input\[type='datetime-local'\]::-webkit-calendar-picker-indicator\s*\{[^}]*display:\s*none/
        );
    });

    it('popover: 320px, tokeny motywu, bez gołych kolorów', () => {
        const block = responsive.slice(
            responsive.indexOf('.sok-datepicker {'),
            responsive.indexOf('.sok-datepicker-head')
        );
        expect(block).toMatch(/width:\s*320px/);
        expect(block).toMatch(/background:\s*var\(--bg-card\)/);
        expect(block).toMatch(/box-shadow:\s*var\(--shadow-lg\)/);
        expect(responsive).not.toMatch(/\.sok-datepicker[^{]*\{[^}]*#[0-9a-fA-F]{3,8}/);
    });

    it('popover pozostaje nad modalem, który otworzył pole daty', () => {
        const block = responsive.slice(
            responsive.indexOf('.sok-datepicker {'),
            responsive.indexOf('.sok-datepicker[hidden]')
        );
        expect(block).toMatch(/z-index:\s*calc\(var\(--z-overlay\)\s*\+\s*1\)/);
    });

    it('skrypt dołączony do wszystkich stron z polem daty', () => {
        ['kartoteka.html', 'studnie.html', 'rury.html', 'zlecenia.html', 'index.html'].forEach(
            (page) => {
                expect(read(`public/${page}`)).toContain('js/shared/datePicker.js?v=');
            }
        );
    });
});
