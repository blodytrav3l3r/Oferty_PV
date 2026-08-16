export interface LockHandle {
    release(): void;
}

export function createModuleLock() {
    let ownerId: string | null = null;
    const WRITE_TIMEOUT = 30000;

    function acquireLock(): Promise<LockHandle | null> {
        return new Promise((resolve) => {
            let settled = false;
            const id = crypto.randomUUID();
            const timeout = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    resolve(null);
                }
            }, WRITE_TIMEOUT);
            const check = () => {
                if (settled) return;
                if (ownerId === null) {
                    ownerId = id;
                    settled = true;
                    clearTimeout(timeout);
                    resolve({
                        release() {
                            if (ownerId === id) ownerId = null;
                        }
                    });
                    return;
                }
                setTimeout(check, 100);
            };
            check();
        });
    }

    /**
     * DRY: opakowuje krytyczny fragment w module lock — zaciąga lock, woła fn,
     * zwalnia w finally. Zwraca { acquired: true, value } lub { acquired: false }
     * (lock zajęty / timeout). Uwalnia handler od try/finally i let lock.
     */
    async function runWithLock<T>(
        fn: () => Promise<T>
    ): Promise<{ acquired: true; value: T } | { acquired: false }> {
        const lock = await acquireLock();
        if (!lock) return { acquired: false };
        try {
            return { acquired: true, value: await fn() };
        } finally {
            lock.release();
        }
    }

    return { acquireLock, runWithLock };
}
