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
            testEnvironment: 'node',
            roots: ['<rootDir>/tests/frontend'],
            testMatch: ['**/*.test.ts'],
            moduleFileExtensions: ['ts', 'js', 'json']
        }
    ]
};

export default config;
