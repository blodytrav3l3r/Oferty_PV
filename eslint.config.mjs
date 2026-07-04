import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
    { ignores: ['node_modules/', 'data/', '*.sqlite', 'public/data/'] },
    eslint.configs.recommended,
    ...tseslint.configs.recommended.map((c) => ({
        files: ['**/*.ts'],
        ...c
    })),
    {
        files: ['src/**/*.{js,ts}', 'server.ts', 'scripts/**/*.{js,ts}', 'tests/**/*.{js,ts}'],
        languageOptions: {
            parser: tseslint.parser,
            globals: {
                ...globals.node,
                ...globals.jest
            }
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ],
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',
            semi: ['error', 'always'],
            quotes: ['error', 'single', { avoidEscape: true }],
            'no-empty': 'off',
            'prefer-const': 'off'
        }
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        },
        rules: {
            'no-unused-vars': 'off',
            'no-console': 'off',
            semi: ['error', 'always'],
            quotes: ['error', 'single', { avoidEscape: true }],
            'no-empty': 'off',
            'prefer-const': 'off'
        }
    },
    {
        files: ['public/js/**/*.{js,ts}'],
        languageOptions: {
            parser: tseslint.parser,
            globals: {
                ...globals.browser,
                lucide: 'readonly',
                html2pdf: 'readonly',
                jspdf: 'readonly',
                Papa: 'readonly',
                Chart: 'readonly',
                bootstrap: 'readonly',
                Prism: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_'
                }
            ],
            '@typescript-eslint/no-unused-expressions': 'off',
            'no-empty': 'off',
            'no-undef': 'off',
            'no-global-assign': 'off',
            semi: ['error', 'always'],
            quotes: ['error', 'single', { avoidEscape: true }],
            'prefer-const': 'warn',
            'no-console': 'off'
        }
    },
    eslintConfigPrettier
);
