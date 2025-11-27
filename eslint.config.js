const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');

module.exports = tseslint.config(
    {
        ignores: ['dist/', 'node_modules/', 'eslint.config.js'],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.es2021,
            },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/ban-ts-comment': 'warn',
            'no-undef': 'off', // TypeScript handles this
        },
    },
);
