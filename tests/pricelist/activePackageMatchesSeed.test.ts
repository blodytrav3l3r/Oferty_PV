/**
 * Pakiet instalacyjny (`data/pricelists/active-pricelists.json`) musi nieść
 * dokładnie tę samą treść co `data/seed_*.json` — inaczej świeża instalacja
 * dostaje cennik inny niż widzi aplikacja.
 */
import path from 'node:path';
import {
    ACTIVE_PACKAGE_TYPES,
    packageVersionSha,
    readActivePackage
} from '../../src/services/pricelist/package';
import { diffPackageRows, seedPackageRows } from '../../src/services/pricelist/drift';

const PACKAGE_PATH = path.join(
    __dirname,
    '..',
    '..',
    'data',
    'pricelists',
    'active-pricelists.json'
);

describe('pakiet aktywnych cenników', () => {
    const artifact = readActivePackage(PACKAGE_PATH);

    it.each(ACTIVE_PACKAGE_TYPES)('%s: treść zgodna z seedem', (type) => {
        const diffs = diffPackageRows(type, seedPackageRows(type), artifact.items[type]);
        expect(diffs.slice(0, 10)).toEqual([]);
        expect(diffs).toHaveLength(0);
    });

    it.each(ACTIVE_PACKAGE_TYPES)('%s: sha256 wersji zgadza się z wierszami', (type) => {
        const version = artifact.versions[type];
        expect(packageVersionSha(type, version.id, artifact.items[type])).toBe(version.sha256);
    });

    it.each(ACTIVE_PACKAGE_TYPES)('%s: liczności zgodne z wierszami', (type) => {
        for (const [key, expected] of Object.entries(artifact.items[type])) {
            expect(artifact.counts[`${type}.${key}`]).toBe((expected as unknown[]).length);
        }
    });

    it('pakiet świeżej instalacji ma poprawne pasma cen wszystkich kinet', () => {
        const rows = artifact.items.studnie.pricelist_item_studnie as Array<
            Record<string, unknown>
        >;
        const kinety = rows.filter((row) => row.componentType === 'kineta');

        expect(kinety.length).toBeGreaterThan(0);
        for (const kineta of kinety) {
            const hasUsableBand = [1, 2, 3].some((number) => {
                const min = kineta[`hMin${number}`];
                const max = kineta[`hMax${number}`];
                const price = kineta[`cena${number}`];
                return (
                    typeof min === 'number' &&
                    typeof max === 'number' &&
                    typeof price === 'number' &&
                    min <= max
                );
            });
            expect(hasUsableBand).toBe(true);
        }
    });
});
