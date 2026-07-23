export function createModuleLock() {
    let writeLock = false;
    const WRITE_TIMEOUT = 30000;

    function acquireLock(): Promise<boolean> {
        return new Promise((resolve) => {
            const check = () => {
                if (!writeLock) {
                    writeLock = true;
                    resolve(true);
                    return;
                }
                setTimeout(check, 100);
            };
            check();
            setTimeout(() => resolve(false), WRITE_TIMEOUT);
        });
    }

    function releaseLock() {
        writeLock = false;
    }

    return { acquireLock, releaseLock };
}
