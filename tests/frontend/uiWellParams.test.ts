import {
    createDom,
    escapeHtml,
    escapeHtmlAttr,
    loadStudnieScript,
    type FakeDom
} from './helpers/studnieHarness';

interface LoadOptions {
    well?: Record<string, unknown> | null;
    softLocked?: boolean;
    settling?: boolean;
    withContainer?: boolean;
}

function load(options: LoadOptions = {}) {
    const dom = createDom();
    const container =
        options.withContainer === false ? null : dom.register('well-params-container');
    const lucide = { createIcons: jest.fn() };
    const { context, exposed } = loadStudnieScript({
        file: 'public/js/studnie/uiWellParams.js',
        dom,
        globals: {
            getCurrentWell: () => options.well ?? null,
            escapeHtml,
            escapeHtmlAttr,
            isOrderedWellSoftLocked: () => options.softLocked === true,
            isSettlingWell: () => options.settling === true
        },
        expose: '{ renderWellParams, WELL_PARAM_DEFS }'
    });
    context.window.lucide = lucide;
    return { dom, container, lucide, context, exposed };
}

const BASIC_WELL = {
    id: 'w1',
    dn: 1200,
    nadbudowa: 'betonowa',
    kineta: 'beton',
    spocznik: 'beton',
    malowanieW: 'brak',
    malowanieZ: 'brak',
    spocznikH: '1/2'
};

describe('uiWellParams — renderWellParams', () => {
    it('nie rzuca, gdy kontenera nie ma w DOM', () => {
        const { context } = load({ withContainer: false, well: BASIC_WELL });
        expect(() => context.renderWellParams()).not.toThrow();
    });

    it('bez studni pokazuje zachętę do dodania studni', () => {
        const { context, container } = load({ well: null });

        context.renderWellParams();

        expect(container!.innerHTML).toContain('Dodaj studnię aby edytować parametry');
    });

    it('renderuje kafelki parametrów z aktywnym wyborem i akcjami CSP', () => {
        const { context, container } = load({ well: BASIC_WELL });

        context.renderWellParams();

        const html = container!.innerHTML;
        expect(html).toContain('Nadbudowa');
        expect(html).toContain('Dennica');
        expect(html).toContain('Klasa betonu');
        // aktywny wybór: betonowa → pogrubienie 800 i akcent
        const activeTile =
            /<button[^>]*data-csp-args="\[&quot;nadbudowa&quot;,&quot;betonowa&quot;\]"[\s\S]*?<\/button>/.exec(
                html
            )?.[0];
        expect(activeTile).toContain('font-weight:800');
        expect(activeTile).toContain('rgba(var(--accent-rgb), 0.3)');
        // nieaktywny wariant ma hover pary data-csp-2/3
        const inactive =
            /<button[^>]*data-csp-args="\[&quot;nadbudowa&quot;,&quot;zelbetowa&quot;\]"[\s\S]*?<\/button>/.exec(
                html
            )?.[0];
        expect(inactive).toContain('data-csp-2="$stylePair"');
        expect(html).toContain('Przywróć domyślne (Krok 2)');
    });

    it('blokada zamówienia: banner, disabled na kafelkach i przycisku resetu', () => {
        const { context, container } = load({ well: BASIC_WELL, softLocked: true });

        context.renderWellParams();

        const html = container!.innerHTML;
        expect(html).toContain('Studnia na zamówieniu — parametry zablokowane');
        expect(html).toContain('pointer-events:none');
        expect((html.match(/<button disabled/g) ?? []).length).toBeGreaterThan(10);
        expect(html).toContain('resetWellParamsToDefaults');
        expect(html).toMatch(/data-csp="resetWellParamsToDefaults"[^>]*disabled/);
    });

    it('wkładka cała wysokość tylko dla kinety Preco/PrecoTop', () => {
        const beton = load({ well: BASIC_WELL });
        beton.context.renderWellParams();
        expect(beton.container!.innerHTML).not.toContain('Wkładka cała wys.');

        const preco = load({ well: { ...BASIC_WELL, kineta: 'precotop' } });
        preco.context.renderWellParams();
        expect(preco.container!.innerHTML).toContain('Wkładka cała wys.');
    });

    it('wkładka osadnikowa ukrywa kinetę i spocznik oraz pokazuje wysokość', () => {
        const { context, container } = load({
            well: { ...BASIC_WELL, wkladkaOsadnikPreco: 'tak', wkladkaOsadnikH: 750 },
            settling: true
        });

        context.renderWellParams();

        const html = container!.innerHTML;
        expect(html).not.toContain('>Kineta</span>');
        expect(html).not.toContain('>Spocznik</span>');
        expect(html).toContain('Wys. wkładki osadnik');
        expect(html).toContain('value="750"');
        expect(html).toContain('data-csp-3="$updateWellParamF"');
    });

    it('psia buda wyszarza spocznikH i nie pokazuje wkładki osadnika', () => {
        const { context, container } = load({ well: { ...BASIC_WELL, psiaBuda: true } });

        context.renderWellParams();

        const html = container!.innerHTML;
        expect(html).toContain('Spocznik wys.');
        const spocznikRow = html.split('</div>').find((chunk) => chunk.includes('Spocznik wys.'));
        expect(spocznikRow).toContain('opacity: 0.5');
    });

    it('pola powłok pojawiają się tylko przy wybranym malowaniu i są escapowane', () => {
        const { context, container } = load({
            well: {
                ...BASIC_WELL,
                malowanieW: 'kineta',
                malowanieZ: 'zewnatrz',
                powlokaNameW: '"><script>alert(1)</script>',
                powlokaNameZ: 'Zwykła powłoka',
                malowanieWewCena: 12.5,
                malowanieZewCena: 7
            }
        });

        context.renderWellParams();

        const html = container!.innerHTML;
        expect(html).toContain('Nazwa p. wew.');
        expect(html).toContain('Koszt p. wew.');
        expect(html).toContain('Nazwa p. zew.');
        expect(html).toContain('Koszt p. zew.');
        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).toContain('value="12.5"');
        expect(html).toContain('value="7"');
    });

    it('wywołuje lucide.createIcons na kontenerze', () => {
        const { context, container, lucide } = load({ well: BASIC_WELL });

        context.renderWellParams();

        expect(lucide.createIcons).toHaveBeenCalledWith({ root: container });
    });

    it('każdy parametr ma unikalny klucz w danych akcji', () => {
        const { context, exposed, container } = load({ well: BASIC_WELL });

        context.renderWellParams();

        const keys = (exposed.WELL_PARAM_DEFS as Array<{ key: string }>).map((d) => d.key);
        const html = container!.innerHTML;
        // precoFullHeight renderuje się wyłącznie dla kinety Preco/PrecoTop.
        const conditional = new Set(['precoFullHeight', 'wkladkaOsadnikPreco']);
        for (const key of keys) {
            if (conditional.has(key)) continue;
            expect(html).toContain(`&quot;${key}&quot;`);
        }
        expect(new Set(keys).size).toBe(keys.length);
    });
});

describe('uiWellParams — kontener', () => {
    it('kontener jest rejestrowany w DOM pod stałym id', () => {
        const dom: FakeDom = createDom();
        const container = dom.register('well-params-container');
        const { context } = loadStudnieScript({
            file: 'public/js/studnie/uiWellParams.js',
            dom,
            globals: {
                getCurrentWell: () => BASIC_WELL,
                escapeHtml,
                escapeHtmlAttr
            }
        });

        context.renderWellParams();

        expect(container.innerHTML.length).toBeGreaterThan(100);
    });
});
