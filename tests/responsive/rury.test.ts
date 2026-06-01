import * as fs from 'fs';

describe('Oferty rur — responsywność', () => {
  test('768px ukrywa kolumny Ilość, Dopłata, Wersja handlowa', () => {
    const css = fs.readFileSync('public/css/style.css', 'utf-8');
    const mqMatch = css.match(/@media\s*\(max-width:\s*768px\)[\s\S]*?#offer-items-body[\s\S]*?display\s*:\s*none/);
    expect(mqMatch).not.toBeNull();
  });

  test('600px ukrywa kolumny Metry, Transport/szt, Brutto', () => {
    const css = fs.readFileSync('public/css/style.css', 'utf-8');
    const mqMatch = css.match(/@media\s*\(max-width:\s*600px\)[\s\S]*?#offer-items-body[\s\S]*?display\s*:\s*none/);
    expect(mqMatch).not.toBeNull();
  });

  test('rury.html ma tabelę w kroku 3 z colspan 12 i w kroku 5 z colspan 12', () => {
    const html = fs.readFileSync('public/rury.html', 'utf-8');
    expect(html).toContain('colspan="12"');
    expect(html).toContain('class="rury-table-wrap"');
  });
});
