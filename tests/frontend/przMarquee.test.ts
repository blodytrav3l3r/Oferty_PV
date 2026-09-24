/**
 * @jest-environment jsdom
 */
// @ts-nocheck -- runtime transitionRenderer.js w jsdom, celowy brak typow
/* ===== PRZ MARQUEE (auto-loop) =====
 * przMarqueeScan wykrywa .prz-col-header z overflow i dokleja animację
 * ping-pong (infinite, bez hover); bez overflow brak animacji;
 * prefers-reduced-motion → brak animacji (zostaje title);
 * resize via _mqRescanAll (stop czyści data-mq + klasę).
 * Metryki layoutu mockowane (jsdom nie liczy).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '../..');
const RENDERER_JS = fs.readFileSync(
    path.join(ROOT, 'public/js/studnie/transitionRenderer.js'),
    'utf8'
);

function loadOnce() {
    if (!window.przMarqueeScan) window.eval(RENDERER_JS);
    return {
        start: window.przMarqueeStart,
        stop: window.przMarqueeStop,
        scan: window.przMarqueeScan
    };
}

function mockMetrics(header, inner, clientWidth, scrollWidth) {
    Object.defineProperty(header, 'clientWidth', { value: clientWidth, configurable: true });
    Object.defineProperty(inner, 'scrollWidth', { value: scrollWidth, configurable: true });
}

describe('przMarquee auto-loop', () => {
    let mq;

    beforeAll(() => {
        mq = loadOnce();
    });

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('scan: ucięty nagłówek dostaje wrap + animację + markę data-mq', () => {
        document.body.innerHTML =
            '<div class="prz-col"><div class="prz-col-header" title="Spadek w kinecie [mm]">Spadek kin. [%]</div></div>';
        const header = document.querySelector('.prz-col-header');
        // jsdom: brak layoutu → start oznacza marką, animacji brak (shift 0)
        expect(mq.start(header)).toBe(false);
        expect(header.dataset.mq).toBe('1');
        expect(header.querySelector('.prz-marquee')).not.toBeNull();
        expect(header.textContent).toBe('Spadek kin. [%]');
    });

    test('nadmiar → animacja infinite z wyliczonym shiftem i desynchrą', () => {
        document.body.innerHTML =
            '<div class="prz-col"><div class="prz-col-header">Spadek kin. [%]</div></div>';
        const header = document.querySelector('.prz-col-header');
        mq.start(header);
        const inner = header.querySelector('.prz-marquee');
        mockMetrics(header, inner, 40, 130);
        mq.stop(header);
        expect(mq.start(header, 3)).toBe(true);
        expect(inner.classList.contains('prz-marquee--anim')).toBe(true);
        expect(inner.style.getPropertyValue('--mq-shift')).toBe('90px');
        expect(inner.style.getPropertyValue('--mq-dur')).toBe('3s');
        expect(inner.style.getPropertyValue('--mq-delay')).toBe('-2.1s');
    });

    test('scan przetwarza tylko nieoznaczone (data-mq), zwraca liczbę animowanych', () => {
        document.body.innerHTML =
            '<div class="prz-col"><div class="prz-col-header">Kąt</div></div>' +
            '<div class="prz-col"><div class="prz-col-header">Wysokość [mm]</div></div>';
        const headers = Array.from(document.querySelectorAll('.prz-col-header'));
        // mock nadmiaru tylko dla drugiego — wrap najpierw przez start
        headers.forEach((h) => mq.start(h));
        const inner = headers[1].querySelector('.prz-marquee');
        mockMetrics(headers[0], headers[0].querySelector('.prz-marquee'), 60, 30);
        mockMetrics(headers[1], inner, 40, 140);
        headers.forEach((h) => mq.stop(h));
        expect(mq.scan(document.body)).toBe(1);
        expect(headers[0].querySelector('.prz-marquee--anim')).toBeNull();
        expect(inner.classList.contains('prz-marquee--anim')).toBe(true);
        // powtórny scan nic nie robi (wszystkie oznaczone)
        expect(mq.scan(document.body)).toBe(0);
    });

    test('stop czyści markę i klasę (ścieżka resize)', () => {
        document.body.innerHTML =
            '<div class="prz-col"><div class="prz-col-header">Gony</div></div>';
        const header = document.querySelector('.prz-col-header');
        mq.start(header);
        const inner = header.querySelector('.prz-marquee');
        mockMetrics(header, inner, 40, 100);
        mq.stop(header);
        mq.start(header);
        expect(inner.classList.contains('prz-marquee--anim')).toBe(true);
        mq.stop(header);
        expect(header.dataset.mq).toBeUndefined();
        expect(inner.classList.contains('prz-marquee--anim')).toBe(false);
    });

    test('prefers-reduced-motion → brak animacji (marka tak, by nie skanować w kółko)', () => {
        window.matchMedia = () => ({ matches: true });
        document.body.innerHTML =
            '<div class="prz-col"><div class="prz-col-header">Spadek mufy [%]</div></div>';
        expect(mq.scan(document.body)).toBe(0);
        delete window.matchMedia;
    });

    test('null nie rzuca', () => {
        expect(() => mq.start(null)).not.toThrow();
        expect(() => mq.stop(null)).not.toThrow();
        expect(() => mq.scan(null)).not.toThrow();
    });
});
