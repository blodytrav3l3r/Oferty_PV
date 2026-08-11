import { applyBrandTokens, injectAppNameScript } from '../src/utils/brandHtml';

describe('applyBrandTokens', () => {
    it('podmienia token nazwy aplikacji', () => {
        expect(applyBrandTokens('<title>{{APP_NAME}} — Generator Ofert</title>')).toBe(
            '<title>S.O.K. — Generator Ofert</title>'
        );
    });

    it('podmienia token podtytułu', () => {
        expect(applyBrandTokens('<div class="subtitle">{{APP_SUBTITLE}}</div>')).toBe(
            '<div class="subtitle">System Ofert i Kalkulacji</div>'
        );
    });

    it('podmienia oba tokeny w jednym dokumencie', () => {
        const html =
            '<html><title>{{APP_NAME}} — X</title>' +
            '<img alt="{{APP_NAME}}" aria-label="{{APP_NAME}} — {{APP_SUBTITLE}}" />' +
            '<div>{{APP_SUBTITLE}}</div></html>';
        const out = applyBrandTokens(html);
        expect(out).not.toContain('{{APP_NAME}}');
        expect(out).not.toContain('{{APP_SUBTITLE}}');
        expect(out).toContain('aria-label="S.O.K. — System Ofert i Kalkulacji"');
    });

    it('nie zmienia HTML bez tokenów', () => {
        const html = '<html><head></head><body></body></html>';
        expect(applyBrandTokens(html)).toBe(html);
    });
});

describe('injectAppNameScript', () => {
    it('wstrzykuje window.APP_NAME przed </head>', () => {
        const out = injectAppNameScript('<html><head><title>t</title></head><body></body></html>');
        expect(out).toContain('window.APP_NAME="S.O.K."');
        expect(out.indexOf('window.APP_NAME')).toBeLessThan(out.indexOf('</head>'));
    });

    it('dokleja skrypt na początku gdy brak </head>', () => {
        const out = injectAppNameScript('<html><body></body></html>');
        expect(out.startsWith('<script>window.APP_NAME=')).toBe(true);
    });
});

describe('injectAppNameScript/applyBrandTokens — bezpieczeństwo przy niestandardowej nazwie', () => {
    function withEnvName(
        name: string,
        run: (inject: typeof injectAppNameScript, tokens: typeof applyBrandTokens) => void
    ): void {
        const prev = process.env.APP_NAME;
        process.env.APP_NAME = name;
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const mod = require('../src/utils/brandHtml');
            run(mod.injectAppNameScript, mod.applyBrandTokens);
        });
        if (prev === undefined) delete process.env.APP_NAME;
        else process.env.APP_NAME = prev;
    }

    it('nazwa z `</script>` nie przerywa wstrzykniętego skryptu', () => {
        const payload = '</script><script>alert(1)</script>';
        withEnvName(payload, (inject) => {
            const out = inject('<html><head></head><body></body></html>');
            expect(out).not.toContain(payload);
            expect(out).toContain('\\u003c/script');
        });
    });

    it('escapuje nazwę w kontekście atrybutu (XSS przez cudzysłów)', () => {
        withEnvName('X" onmouseover="alert(1)', (_inject, tokens) => {
            const out = tokens('<img alt="{{APP_NAME}}" />');
            expect(out).not.toContain('" onmouseover=');
            expect(out).toContain('&quot;');
        });
    });
});
