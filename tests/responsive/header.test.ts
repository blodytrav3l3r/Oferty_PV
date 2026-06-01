import * as fs from 'fs';

describe('Nagłówek — responsywność', () => {
  test('media query 700px ukrywa .nav-tile-text', () => {
    const css = fs.readFileSync('public/css/style.css', 'utf-8');
    const mqMatch = css.match(/@media\s*\(max-width:\s*700px\)[\s\S]*?nav-tile-text[\s\S]*?display\s*:\s*none/);
    expect(mqMatch).not.toBeNull();
  });

  test('media query 700px ukrywa logo span', () => {
    const css = fs.readFileSync('public/css/style.css', 'utf-8');
    const mqMatch = css.match(/@media\s*\(max-width:\s*700px\)[\s\S]*?\.logo\s*span[\s\S]*?display\s*:\s*none/);
    expect(mqMatch).not.toBeNull();
  });

  test('media query 700px ustawia .header-inner na flex-wrap wrap', () => {
    const css = fs.readFileSync('public/css/style.css', 'utf-8');
    const mqMatch = css.match(/@media\s*\(max-width:\s*700px\)[\s\S]*?\.header-inner[\s\S]*?flex-wrap\s*:\s*wrap/);
    expect(mqMatch).not.toBeNull();
  });
});
