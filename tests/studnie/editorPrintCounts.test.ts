/**
 * Licznik wydruków z edytora zlecenia (studnie).
 *
 * Wydruki z listy zleceń liczy zlecenia.js (recordPrint). Wydruki wykonane
 * bezpośrednio z edytora (printZlecenie/printEtykieta) muszą trafiać w ten sam
 * endpoint, inaczej kolumna „x” w kartotece pokazuje 0 mimo realnych wydruków.
 */

import * as fs from 'fs';
import * as path from 'path';

const PRINT_MANAGER = path.join(
    __dirname,
    '..',
    '..',
    'public',
    'js',
    'studnie',
    'printManager.js'
);
const ZLECENIA_MODAL = path.join(
    __dirname,
    '..',
    '..',
    'public',
    'js',
    'studnie',
    'orderZleceniaModal.js'
);

const printManager = fs.readFileSync(PRINT_MANAGER, 'utf-8');
const zleceniaModal = fs.readFileSync(ZLECENIA_MODAL, 'utf-8');

describe('licznik wydruków z edytora zlecenia', () => {
    it('wysyła POST na endpoint print-count', () => {
        expect(printManager).toContain('/print-count');
        expect(printManager).toMatch(/method:\s*'POST'/);
        expect(printManager).toContain('body: JSON.stringify({ kind })');
    });

    it('wydruk zlecenia z edytora dolicza kind=zlecenie', () => {
        expect(printManager).toMatch(
            /const orderId = await saveProductionOrder\(\);[\s\S]*?recordEditorPrint\(orderId, 'zlecenie'\)/
        );
    });

    it('wydruk etykiety z edytora dolicza kind=etykieta', () => {
        expect(printManager).toMatch(
            /const orderId = await saveProductionOrder\(\);[\s\S]*?recordEditorPrint\(orderId, 'etykieta'\)/
        );
    });

    it('liczy dopiero po potwierdzeniu [Drukuj] — Anuluj nie dolicza', () => {
        const zlecenieBlock = printManager.slice(
            printManager.indexOf('async function printZlecenie'),
            printManager.indexOf('function getPowlokaString')
        );
        const etykietaBlock = printManager.slice(
            printManager.indexOf('async function printEtykieta'),
            printManager.indexOf('// ===== GLOBAL EXPORTS =====')
        );
        for (const block of [zlecenieBlock, etykietaBlock]) {
            const confirmIdx = block.indexOf('confirmEditorPrint(');
            const guardIdx = block.indexOf('if (!ok) return;');
            const recordIdx = block.indexOf('recordEditorPrint(');
            expect(confirmIdx).toBeGreaterThan(-1);
            expect(guardIdx).toBeGreaterThan(confirmIdx);
            expect(recordIdx).toBeGreaterThan(guardIdx);
        }
    });

    it('saveProductionOrder zwraca id zapisanego zlecenia', () => {
        expect(zleceniaModal).toMatch(/showToast\([\s\S]*?'success'\);\s*return order\.id;/);
    });

    it('nieudany zapis blokuje wydruk (brak cichego wydruku bez licznika)', () => {
        for (const fn of ['async function printZlecenie', 'async function printEtykieta']) {
            const start = printManager.indexOf(fn);
            const block = printManager.slice(start, start + 400);
            expect(block).toMatch(
                /const orderId = await saveProductionOrder\(\);\s*if \(!orderId\) \{[\s\S]*?return;\s*\}/
            );
        }
    });

    it('konflikt wersji (409) pokazuje toast, nie tylko log', () => {
        const idx = printManager.indexOf('res.status === 409');
        expect(idx).toBeGreaterThan(-1);
        const block = printManager.slice(idx, idx + 300);
        expect(block).toContain('showToast(');
        expect(block).toContain("'error'");
    });
});
