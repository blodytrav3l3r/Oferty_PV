import * as fs from 'fs';

const CSS_FILES = [
    'public/css/style.css',
    'public/css/studnie.css',
    'public/css/zlecenia.css',
    'public/css/index.css'
];

// Słowa, które mogą wystąpić w komentarzach technicznych (parametry JSDoc, nazwy klas CSS, wartości)
const ALLOWED_WORDS: Record<string, string[]> = {
    'public/css/style.css': [
        'Toast',
        'flex',
        'layout',
        'inline',
        'Linear',
        'admin',
        'menu',
        'Basic',
        'slide',
        'fade',
        'spin',
        'pulse',
        'none',
        'auto',
        'sticky',
        'scroll'
    ],
    'public/css/studnie.css': [
        'flex',
        'layout',
        'inline',
        'Toast',
        'Menu',
        'admin',
        'slide',
        'none',
        'auto',
        'scroll',
        'primary'
    ],
    'public/css/zlecenia.css': ['Toast', 'flex', 'none', 'auto'],
    'public/css/index.css': [
        'Toast',
        'flex',
        'admin',
        'inline',
        'none',
        'auto',
        'scroll',
        'slide',
        'pulse',
        'primary'
    ]
};

// Tylko słowa, które jednoznacznie wskazują na nietłumaczony komentarz angielski.
// Pomijamy terminy techniczne (flex, grid, layout, inline, toast, modal, scroll, badge, tooltip, wizard)
// które są standardowo używane w polskim piśmiennictwie technicznym.
const ENGLISH_WORDS = [
    'Header',
    'Navigation',
    'Button',
    'Input',
    'Search',
    'Footer',
    'Wrapper',
    'Section',
    'Container',
    'Filter',
    'Tab',
    'Responsive',
    'Breakpoint',
    'Hover',
    'Focus',
    'Active',
    'Loader',
    'Spinner',
    'Shimmer',
    'Placeholder',
    'Catalog',
    'Compact',
    'Left',
    'Right',
    'Center',
    'Border',
    'Shadow',
    'Gradient',
    'Delete',
    'Save',
    'Info',
    'Error',
    'Warning',
    'Success',
    'Danger',
    'Light',
    'Dark',
    'Fixed',
    'Hidden',
    'Visible',
    'Block'
];

describe('Komentarze po polsku — CSS', () => {
    test.each(CSS_FILES)('%s nie ma angielskich komentarzy', (filename: string) => {
        const content = fs.readFileSync(filename, 'utf-8');
        const comments = content.match(/\/\*[\s\S]*?\*\//g) || [];
        const allowed = ALLOWED_WORDS[filename] || [];
        const failures: string[] = [];

        for (const comment of comments) {
            for (const word of ENGLISH_WORDS) {
                if (allowed.includes(word)) continue;
                const regex = new RegExp(`(?<![a-zA-Z])\\b${word}\\b(?![a-zA-Z])`);
                if (regex.test(comment)) {
                    failures.push(
                        `Znaleziono "${word}" w komentarzu: "${comment.trim().substring(0, 80)}..."`
                    );
                }
            }
        }

        expect(failures).toEqual([]);
    });
});
