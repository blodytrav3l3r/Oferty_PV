import fs from 'fs';
import path from 'path';

/**
 * Regresja release: `standard-version` czyta hook `postbump` z `package.json`
 * (`standard-version.scripts`), a nie z `.versionrc.json`. Bez `git add -u`
 * commit `--commit-all` obejmował tylko `bumpFiles` + `CHANGELOG.md`, a pliki
 * propagacji (`?v=`, docs, `.bat`) zostawały w worktree już po commicie i tagu.
 */
const ROOT = path.join(__dirname, '../..');

function readJson(rel: string): any {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

describe('release: hook postbump', () => {
    test('postbump propaguje wersję i stageuje zmiany przed commitem', () => {
        const postbump = readJson('package.json')['standard-version']?.scripts?.postbump;
        expect(typeof postbump).toBe('string');
        expect(postbump).toContain('npm run version:propagate');
        expect(postbump).toMatch(/git add -u/);
    });

    test('.versionrc.json nie duplikuje scripts (jedno źródło: package.json)', () => {
        expect(readJson('.versionrc.json').scripts).toBeUndefined();
    });
});
