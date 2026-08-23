import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
    coverageProvider: 'v8',
    verbose: true,
    testTimeout: 10000,
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    projects: [
        {
            displayName: 'backend',
            preset: 'ts-jest',
            testEnvironment: 'node',
            roots: ['<rootDir>/tests'],
            testMatch: ['**/*.test.ts'],
            testPathIgnorePatterns: ['/frontend/']
        },
        {
            displayName: 'frontend',
            preset: 'ts-jest',
            testEnvironment: 'jsdom',
            roots: ['<rootDir>/tests/frontend'],
            testMatch: ['**/*.test.ts'],
            moduleFileExtensions: ['ts', 'js', 'json']
            // UWAGA: testy frontend ładują public/js przez vm.runInContext —
            // kod evalmachine NIE jest instrumentowany (v8/istanbul), więc
            // coverage % dla public/js jest niemierzalny. Testy działają jako
            // guard behawioralny (18 tests). Realny % wymagałby babel-plugin-istanbul
            // na public/js lub migracji ESM (osobny temat).
        }
    ]
};

export default config;
