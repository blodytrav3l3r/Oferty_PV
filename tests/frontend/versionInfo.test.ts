/** @jest-environment node */

describe('version build metadata', () => {
    const environmentKeys = [
        'APP_COMMIT_SHA',
        'APP_GIT_BRANCH',
        'RENDER_GIT_COMMIT',
        'RENDER_GIT_BRANCH'
    ] as const;
    const originalEnvironment = new Map(environmentKeys.map((key) => [key, process.env[key]]));

    beforeEach(() => {
        jest.resetModules();
        for (const key of environmentKeys) delete process.env[key];
    });

    afterEach(() => {
        jest.dontMock('child_process');
        jest.resetModules();
        for (const key of environmentKeys) {
            const value = originalEnvironment.get(key);
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    async function loadVersion() {
        let version: ReturnType<typeof import('../../src/version').getVersion> | undefined;
        await jest.isolateModulesAsync(async () => {
            const module = await import('../../src/version');
            version = module.getVersion();
        });
        return version;
    }

    it('uses a validated APP_COMMIT_SHA without requiring .git in the runtime image', async () => {
        const commit = 'a'.repeat(40);
        process.env.APP_COMMIT_SHA = commit;
        process.env.APP_GIT_BRANCH = 'main';
        const gitCommand = jest.fn(() => {
            throw new Error('git metadata unavailable');
        });
        jest.doMock('child_process', () => ({ execSync: gitCommand }));

        const version = await loadVersion();

        expect(version?.commitHash).toBe(commit);
        expect(version?.branch).toBe('main');
        expect(gitCommand).not.toHaveBeenCalled();
    });

    it('uses Render commit metadata and rejects malformed values', async () => {
        process.env.APP_COMMIT_SHA = 'not-a-commit';
        process.env.APP_GIT_BRANCH = 'stale-branch';
        process.env.RENDER_GIT_COMMIT = 'b'.repeat(40);
        process.env.RENDER_GIT_BRANCH = 'main';

        const version = await loadVersion();

        expect(version?.commitHash).toBe('b'.repeat(40));
        expect(version?.branch).toBe('main');
    });

    it('falls back to the local Git checkout when no valid build metadata exists', async () => {
        process.env.APP_COMMIT_SHA = 'short';
        const gitCommand = jest
            .fn()
            .mockReturnValueOnce(`${'c'.repeat(40)}\n`)
            .mockReturnValueOnce('main\n');
        jest.doMock('child_process', () => ({ execSync: gitCommand }));

        const version = await loadVersion();

        expect(version?.commitHash).toBe('c'.repeat(40));
        expect(version?.branch).toBe('main');
        expect(gitCommand).toHaveBeenCalledTimes(2);
    });
});
