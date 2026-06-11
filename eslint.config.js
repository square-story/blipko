const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');

module.exports = tseslint.config(
    {
        // web/ is a separate project with its own eslint config (cd web && pnpm lint);
        // *.cjs are CommonJS scripts that legitimately use require().
        ignores: ['dist/', '.seed-build/', 'node_modules/', 'eslint.config.js', 'web/', '**/*.cjs', 'coverage/', 'playwright-report/'],
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
            'no-console': 'off',
            'no-debugger': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
);
