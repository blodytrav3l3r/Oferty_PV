/*
 * tests/scripts/deployCore.test.ts
 * Testy rdzenia deploy/rollback (scripts/deploy-core.cjs).
 *
 * Pokrycie: walidacja tagu, target, kolejność kroków per środowisko,
 * fail-fast, dobór backupu do rollback, health check, bind mount w
 * docker-compose.yml.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// @ts-expect-error js-yaml nie ma deklaracji typow w projekcie
import yaml from 'js-yaml';
// @ts-expect-error deploy-core.cjs nie ma deklaracji typow
import core from '../../scripts/deploy-core.cjs';

const ROOT = path.resolve(__dirname, '..', '..');

describe('deploy-core', () => {
    describe('validateTag', () => {
        it('przyjmuje poprawny tag vX.Y.Z', () => {
            expect(core.validateTag('v1.16.0')).toBe('v1.16.0');
            expect(core.validateTag('v10.0.1')).toBe('v10.0.1');
        });

        it('odrzuca niepoprawne tagi', () => {
            for (const bad of [
                '1.16.0',
                'v1.16',
                'main',
                'v1.16.0-beta',
                '',
                undefined,
                null,
                42
            ]) {
                expect(() => core.validateTag(bad)).toThrow(/Niepoprawny tag/);
            }
        });
    });

    describe('resolveTarget', () => {
        it('przyjmuje dozwolone targety', () => {
            for (const t of ['windows', 'linux', 'docker']) {
                expect(core.resolveTarget(t)).toBe(t);
            }
        });

        it('odrzuca nieznany target', () => {
            expect(() => core.resolveTarget('kubernetes')).toThrow(/Nieznany target/);
            expect(() => core.resolveTarget(undefined)).toThrow(/Nieznany target/);
        });
    });

    describe('resolveSteps', () => {
        it('kolejnosc krokow: backup -> checkout -> ci -> generate -> migrate -> build -> wersja -> start -> health', () => {
            for (const t of ['windows', 'linux', 'docker']) {
                const names = core.resolveSteps(t, 'v1.16.0').map((s: any) => s.name);
                expect(names[0]).toMatch(/Backup/);
                expect(names).toContain('Migracja schematu (addytywna)');
                expect(names).toContain('Kontrola spojnosci wersji');
                expect(names[names.length - 1]).toMatch(/health/i);
            }
        });

        it('linux ma krok kopiowania klienta Prisma do dist', () => {
            const steps = core.resolveSteps('linux', 'v1.16.0');
            expect(steps.some((s: any) => /Kopiowanie klienta Prisma/.test(s.name))).toBe(true);
        });

        it('windows i docker NIE maja kroku kopiowania klienta Prisma', () => {
            for (const t of ['windows', 'docker']) {
                const steps = core.resolveSteps(t, 'v1.16.0');
                expect(steps.some((s: any) => /Kopiowanie klienta Prisma/.test(s.name))).toBe(
                    false
                );
            }
        });

        it('tag jest wstawiany do komend checkout', () => {
            for (const t of ['windows', 'linux', 'docker']) {
                const steps = core.resolveSteps(t, 'v1.16.0');
                expect(steps.some((s: any) => s.cmd.includes('git checkout v1.16.0'))).toBe(true);
            }
        });

        it('komenda start zalezy od targetu', () => {
            const startOf = (t: string) =>
                core.resolveSteps(t, 'v1.16.0').find((s: any) => /Uruchomienie/.test(s.name)).cmd;
            expect(startOf('windows')).toBe('start "" start.bat --prod');
            expect(startOf('linux')).toBe('pm2 restart sok-oferty');
            expect(startOf('docker')).toBe('docker compose up -d --build');
        });

        it('wszystkie targety koncza sie weryfikacja health', () => {
            for (const t of ['windows', 'linux', 'docker']) {
                const steps = core.resolveSteps(t, 'v1.16.0');
                expect(steps[steps.length - 1].cmd).toMatch(/deploy:check/);
            }
        });
    });

    describe('rollbackSteps', () => {
        it('przywraca baze, wraca na poprzedni tag, buduje i startuje', () => {
            const steps = core.rollbackSteps(
                'linux',
                'v1.15.1',
                '/data/backups/backup_2026-08-01_1.sqlite'
            );
            const names = steps.map((s: any) => s.name);
            expect(names[0]).toMatch(/Przywrocenie bazy/);
            expect(names).toContain('Powrot na tag v1.15.1');
            expect(names[names.length - 1]).toMatch(/health/i);
        });

        it('restore uruchamia z flaga --yes', () => {
            const steps = core.rollbackSteps('windows', 'v1.15.1', '/data/backups/x.sqlite');
            expect(steps[0].cmd).toContain('npm run restore "/data/backups/x.sqlite" -- --yes');
        });

        it('waliduje poprzedni tag', () => {
            expect(() => core.rollbackSteps('linux', 'main', '/tmp/x.sqlite')).toThrow(
                /Niepoprawny tag/
            );
        });
    });

    describe('runSequential', () => {
        it('wykonuje wszystkie kroki po kolei', async () => {
            const steps = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
            const called: string[] = [];
            await core.runSequential(steps, (s: any) => {
                called.push(s.name);
                return true;
            });
            expect(called).toEqual(['a', 'b', 'c']);
        });

        it('fail-fast: nie wykonuje kolejnych krokow po nieudanym', async () => {
            const steps = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
            const called: string[] = [];
            const runFn = async (s: any) => {
                called.push(s.name);
                return s.name !== 'b';
            };
            await expect(core.runSequential(steps, runFn)).rejects.toThrow('Krok nieudany: b');
            expect(called).toEqual(['a', 'b']);
        });
    });

    describe('planRollback', () => {
        it('wybiera najnowszy backup', () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-backup-'));
            try {
                for (const f of [
                    'backup_2026-08-01_1000.sqlite',
                    'backup_2026-08-10_2000.sqlite',
                    'not-a-backup.txt'
                ]) {
                    fs.writeFileSync(path.join(dir, f), 'x');
                }
                const picked = core.planRollback(dir);
                expect(path.basename(picked)).toBe('backup_2026-08-10_2000.sqlite');
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });

        it('rzuca blad gdy brak backupow', () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sok-nobackup-'));
            try {
                expect(() => core.planRollback(dir)).toThrow(/Brak backup/);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        });
    });

    describe('checkHealth', () => {
        it('zwraca true gdy status 200', async () => {
            const fetchFn = async () => ({ status: 200 });
            expect(
                await core.checkHealth('http://x/health', { fetchFn, retries: 1, intervalMs: 1 })
            ).toBe(true);
        });

        it('zwraca false gdy ciagle 500', async () => {
            const fetchFn = async () => ({ status: 500 });
            expect(
                await core.checkHealth('http://x/health', { fetchFn, retries: 2, intervalMs: 1 })
            ).toBe(false);
        });

        it('zwraca false gdy fetch rzuca', async () => {
            const fetchFn = async () => {
                throw new Error('refused');
            };
            expect(
                await core.checkHealth('http://x/health', { fetchFn, retries: 2, intervalMs: 1 })
            ).toBe(false);
        });

        it('zwraca false gdy odpowiedz sie nie pojawia (timeout)', async () => {
            const fetchFn = () => new Promise(() => {});
            expect(
                await core.checkHealth('http://x/health', {
                    fetchFn,
                    retries: 1,
                    intervalMs: 1,
                    timeoutMs: 20
                })
            ).toBe(false);
        });
    });

    describe('docker-compose.yml (bind mount)', () => {
        it('uzywa bind mount ./data:/var/data zamiast named volume', () => {
            const text = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
            const doc: any = yaml.load(text);
            const volumes = doc.services.app.volumes;
            expect(volumes).toContain('./data:/var/data');
            expect(
                volumes.some(
                    (v: any) => typeof v === 'string' && v.includes(':') && !v.startsWith('./')
                )
            ).toBe(false);
            expect(doc.volumes).toBeUndefined();
        });
    });
});
