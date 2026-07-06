import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/middleware/csrf.ts'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageProvider: 'v8',
    verbose: true,
    testTimeout: 10000,
    setupFiles: ['<rootDir>/tests/jestSetupEnv.ts'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
};

export default config;
