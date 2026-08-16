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

    return { acquireLock };
}
