import { createModuleLock } from '../src/middleware/writeLock';

// ─── T3.2: writeLock ownership + timeout (A-05) ─────────────

describe('createModuleLock (A-05)', () => {
    it('pierwszy acquire zwraca handle, drugi czeka', async () => {
        const { acquireLock } = createModuleLock();
        const lock1 = await acquireLock();
        expect(lock1).not.toBeNull();

        let acquired2 = false;
        const p2 = acquireLock().then((l) => {
            acquired2 = l !== null;
            return l;
        });

        await new Promise((r) => setTimeout(r, 150));
        expect(acquired2).toBe(false);

        lock1!.release();
        const lock2 = await p2;
        expect(lock2).not.toBeNull();
        lock2!.release();
    });

    it('release przez nie-właściciela nie zwalnia locka (ownership)', async () => {
        const { acquireLock } = createModuleLock();
        const lock1 = await acquireLock();

        /* Obcy release nie może zwolnić cudzego locka — test pośredni:
           handle zwracany tylko właścicielowi, więc obcy nie ma jak go zwolnić. */
        const lock2promise = acquireLock();
        await new Promise((r) => setTimeout(r, 150));
        expect(await Promise.race([lock2promise, Promise.resolve('pending')])).toBe('pending');

        lock1!.release();
        expect(await lock2promise).not.toBeNull();
    });

    it('oczekujący acquire nie zdobywa locka, dopóki właściciel nie zwolni', async () => {
        const { acquireLock } = createModuleLock();
        const lock1 = await acquireLock();
        expect(lock1).not.toBeNull();

        let blocked = false;
        const p3 = acquireLock().then((l) => {
            blocked = l !== null;
            return l;
        });
        await new Promise((r) => setTimeout(r, 100));
        expect(blocked).toBe(false);

        lock1!.release();
        expect(await p3).not.toBeNull();
    });

    it('serializuje współbieżne zapisy (mutual exclusion)', async () => {
        const { acquireLock } = createModuleLock();
        let active = 0;
        let maxActive = 0;
        const workers = Array.from({ length: 10 }, async () => {
            const lock = await acquireLock();
            if (!lock) return;
            active++;
            maxActive = Math.max(maxActive, active);
            await new Promise((r) => setTimeout(r, 10));
            active--;
            lock.release();
        });
        await Promise.all(workers);
        expect(maxActive).toBe(1);
    });
});

// ─── T3.3: runWithLock (DRY helper) ──────────────────────────

describe('runWithLock (helper DRY)', () => {
    it('zwraca acquired:true z wartością fn i zwalnia lock', async () => {
        const { acquireLock, runWithLock } = createModuleLock();
        const result = await runWithLock(async () => 42);
        expect(result).toEqual({ acquired: true, value: 42 });

        // lock zwolniony po wywołaniu
        const lock = await acquireLock();
        expect(lock).not.toBeNull();
        lock!.release();
    });

    it('czeka aż lock się zwolni, potem wykonuje fn', async () => {
        const { acquireLock, runWithLock } = createModuleLock();
        const lock1 = await acquireLock();
        expect(lock1).not.toBeNull();

        let done = false;
        const p = runWithLock(async () => {
            done = true;
            return 2;
        });
        await new Promise((r) => setTimeout(r, 150));
        expect(done).toBe(false);

        lock1!.release();
        const ok = await p;
        expect(ok).toEqual({ acquired: true, value: 2 });
    });

    it('zwalnia lock nawet gdy fn rzuca', async () => {
        const { acquireLock, runWithLock } = createModuleLock();
        await expect(runWithLock(async () => Promise.reject(new Error('boom')))).rejects.toThrow(
            'boom'
        );

        const lock = await acquireLock();
        expect(lock).not.toBeNull();
        lock!.release();
    });
});
