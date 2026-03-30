import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import vitest from '@vitest/eslint-plugin';

export default defineConfig([
    ...tseslint.configs.recommended,
    eslintPluginUnicorn.configs['recommended'],
    vitest.configs.recommended,
    {
        files: ['src/**/*.{js,ts}'],
        ignores: ['dist/**/*', 'node_modules/**/*', '*.cjs'],
        plugins: {
            'simple-import-sort': simpleImportSort,
            vitest,
        },
        rules: {
            'simple-import-sort/imports': 'error',
            'simple-import-sort/exports': 'error',
            'unicorn/better-regex': 'warn',
            'unicorn/no-process-exit': 'off',
            'unicorn/no-array-reduce': 'off',
            'unicorn/prevent-abbreviations': 'off',
            'unicorn/filename-case': ['warn'],
            '@typescript-eslint/no-explicit-any': 'warn',
            'unicorn/prefer-top-level-await': 'warn',
            '@typescript-eslint/no-unused-vars': 'warn',
            'vitest/no-conditional-expect': 'warn',
            'vitest/expect-expect': 'warn',
        },
    },
]);
