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

  test('rury.html ma tabelę z dynamic colgroup (buildRuryColgroup)', () => {
    const html = fs.readFileSync('public/rury.html', 'utf-8');
    const hasOfferItemsBody = html.includes('id="offer-items-body"');
    const hasOrderItemsBody = html.includes('id="order-items-body"');
    const hasColgroup = html.includes('id="rury-colgroup"') || /<colgroup/.test(html);
    expect(hasOfferItemsBody).toBe(true);
    expect(hasOrderItemsBody).toBe(true);
    expect(hasColgroup).toBe(true);
  });
});
