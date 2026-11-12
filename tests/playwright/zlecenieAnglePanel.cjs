'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');
const { chromeLaunchOptions } = require('./throttleHelper.cjs');

const TEMPLATE = fs.readFileSync(
    path.join(__dirname, '../../public/templates/zlecenie.html'),
    'utf8'
);
const TARGET_HEIGHT_PX = (57 * 96) / 25.4;
const renderer = { window: {}, ensureDisplayIndices() {} };
vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../../public/js/spa/zleceniaHelpers.js'), 'utf8'),
    renderer
);

function graphicForAngles(angles) {
    return renderer.window.generateSvgFromPO({
        przejscia: angles.map((angle, index) => ({
            angle,
            displayIndex: index,
            flowType: index === 0 ? 'wylot' : 'wlot',
            productCategory: 'K2KAN ID',
            productDn: '300'
        }))
    });
}

function renderPage(graphic, objectName = 'Stadion miejski Opole') {
    return TEMPLATE.replace('{{GRAFIKA_KATOW}}', graphic).replace(
        /\{\{([\w_]+)\}\}/g,
        (_, key) =>
            ({
                PRINT_TOKENS: ':root { --black: #000; --white: #fff; }',
                OBIEKT: objectName,
                ADRES: '46-200 Kluczbork, Polska'
            })[key] || ''
    );
}

async function measurePanel(page, html) {
    await page.setContent(html);
    return page
        .locator('.grafika-cell')
        .first()
        .evaluate((cell) => {
            const panel = cell.getBoundingClientRect();
            const graphic = cell.querySelector('svg')?.getBoundingClientRect();
            return {
                width: panel.width,
                height: panel.height,
                graphicFits:
                    !graphic ||
                    (graphic.left >= panel.left - 1 &&
                        graphic.right <= panel.right + 1 &&
                        graphic.top >= panel.top - 1 &&
                        graphic.bottom <= panel.bottom + 1)
            };
        });
}

async function main() {
    const browser = await chromium.launch(chromeLaunchOptions({ headless: true }));
    try {
        const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
        await page.emulateMedia({ media: 'print' });
        const graphics = ['', graphicForAngles([0, 168]), graphicForAngles([0, 75, 168, 270])];
        const sizes = [];
        for (const graphic of graphics) {
            const size = await measurePanel(page, renderPage(graphic));
            assert.ok(size.graphicFits, 'schemat musi zmieścić się w polu');
            assert.ok(Math.abs(size.height - TARGET_HEIGHT_PX) < 3, 'wysokość pola ≈ 57 mm');
            assert.ok(Math.abs(size.width - (66 * 96) / 25.4) < 3, 'szerokość pola ≈ 66 mm');
            sizes.push(size.height);
        }
        assert.ok(Math.max(...sizes) - Math.min(...sizes) < 1, 'pole ma stałą wysokość');

        const longName = 'Bardzo długi opis obiektu '.repeat(55);
        const longSize = await measurePanel(page, renderPage(graphics[1], longName));
        assert.ok(longSize.height > TARGET_HEIGHT_PX, 'długi tekst może powiększyć blok');
        assert.equal(
            await page
                .locator('.grafika-cell')
                .locator('xpath=preceding-sibling::td[1]')
                .textContent(),
            longName
        );

        const rendered = renderPage(graphics[2]);
        const pageStart = rendered.indexOf('<div class="page">');
        const pageEnd = rendered.lastIndexOf('</body>');
        assert.ok(pageStart >= 0 && pageEnd > pageStart, 'szablon zawiera stronę wydruku');
        const pageBlock = rendered.slice(pageStart, pageEnd).trim();
        await page.setContent(rendered.replace(pageBlock, pageBlock + pageBlock));
        const batchHeights = await page
            .locator('.grafika-cell')
            .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().height));
        assert.equal(batchHeights.length, 2);
        assert.ok(batchHeights.every((height) => Math.abs(height - TARGET_HEIGHT_PX) < 3));
        process.stdout.write('Pole kątów: stały rozmiar pojedynczo i zbiorczo\n');
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
});
