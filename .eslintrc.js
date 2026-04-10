module.exports = {
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  plugins: ['node'],
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  parserOptions: {
    ecmaVersion: 2021
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'node/no-deprecated-api': 'warn',
    'semi': ['error', 'always'],
    'quotes': ['error', 'single', { avoidEscape: true }]
  },
  ignorePatterns: ['node_modules/', 'public/', 'data/', '*.sqlite']
}
