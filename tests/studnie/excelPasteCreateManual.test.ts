// Kontrakt: studnie utworzone przez wklejanie (paste-create, surplus spoza
// tabeli) startują w MANUAL — _finishPaste nie odpala na nich solvera
// (toAuto pomija autoSelect === false). createNewWell stawia autoSelect=true,
// więc blok paste-create musi jawnie przestawić flagi przed wells.push.
import fs from 'fs';
import path from 'path';

const readStudnie = (f: string) =>
    fs.readFileSync(path.join(__dirname, '../../public/js/studnie/' + f), 'utf8');

describe('excel paste-create: wklejone studnie domyślnie MANUAL', () => {
    const src = readStudnie('excelCopyPaste.js');
    // Blok surplus (auto-tworzenie brakujących studni przy wklejaniu).
    const surplusPos = src.indexOf('const surplus = lines.slice(availableRows)');
    expect(surplusPos).toBeGreaterThan(-1);

    const block = src.slice(surplusPos, src.indexOf('availableRows = Math.max', surplusPos));
    expect(block).toContain('well.autoSelect = false');
    expect(block).toContain("well.configSource = 'MANUAL'");
    expect(block).toContain('well.autoLocked = true');

    it('flagi MANUAL stawiane przed wells.push (kolejność)', () => {
        const manualPos = block.indexOf('well.autoSelect = false');
        const pushPos = block.indexOf('wells.push(well)');
        expect(manualPos).toBeGreaterThan(-1);
        expect(pushPos).toBeGreaterThan(manualPos);
    });
});
