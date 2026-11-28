import fs from 'fs';
import path from 'path';
import vm from 'vm';

const SOURCE = path.join(__dirname, '../../public/js/studnie/wellUIHelpers.js');

describe('AI status placement on well cards', () => {
    test('renders the status after well details so it sits at the card bottom', () => {
        const context: Record<string, unknown> = {
            escapeHtml: (value: string) => value,
            escapeHtmlAttr: (value: string) => value,
            fmtInt: (value: number) => String(value),
            window: null
        };
        context.window = context;
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(SOURCE, 'utf8'), context, { filename: SOURCE });

        const html = (context._wellBuildCardHtml as (...args: unknown[]) => string)(
            {
                id: 'well-1',
                name: 'Studnia 1',
                config: [],
                przejscia: [],
                rzednaWlazu: 5,
                rzednaDna: 1
            },
            0,
            null,
            0,
            { price: 100, weight: 100, height: 4000 }
        );

        expect(html.indexOf('data-ai-well-status')).toBeGreaterThan(
            html.indexOf('well-list-elevations')
        );
    });
});
