/**
 * Stub pakietu `puppeteer` dla Jesta.
 *
 * Puppeteer >= 25 jest ESM-only (`type: module`, `export *`) i nie przechodzi
 * przez transform Jesta, a `src/services/pdf/pdfEngine.ts` importuje go na
 * najwyzszym poziomie. Bez tego mapowania kazdy suite, ktory importuje trase
 * eksportu (posrednio pdfEngine), konczy sie "Unexpected token 'export'".
 *
 * Testy, ktore naprawde renderuja PDF, i tak podmieniaja ten modul przez
 * `jest.mock('puppeteer', factory)` — fabryka ma pierwszenstwo.
 */
module.exports = {
    __esModule: true,
    default: {
        executablePath: async () => process.env.PUPPETEER_EXECUTABLE_PATH || '/nonexistent/chrome',
        launch: async () => {
            throw new Error('puppeteer jest zastubowany w testach (tests/mocks/puppeteer.stub.js)');
        }
    }
};
