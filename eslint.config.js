import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

const TS_FILES = ['**/*.{ts,mts,cts}'];
const TYPE_AWARE_FILES = [...TS_FILES, '**/*.vue'];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'content/**',
      'docs/**',
      'public/**',
      'patches/**',
      'perf/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: [...TYPE_AWARE_FILES, '**/*.{js,mjs,cjs}'],
  },
  tseslint.configs.recommended.map((config) => ({
    ...config,
    files: TYPE_AWARE_FILES,
  })),
  pluginVue.configs['flat/recommended'],
  {
    files: TYPE_AWARE_FILES,
    languageOptions: {
      parserOptions: {
        // `.vue` files are parsed by vue-eslint-parser, which hands
        // `<script lang="ts">` blocks to typescript-eslint.
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      // TypeScript already reports undefined names; unused bindings are
      // reported once, by the TypeScript-aware variant below.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      // High-signal type-aware rules: warnings until the existing backlog is
      // cleared, so `npm run lint` stays green and non-blocking.
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { fixStyle: 'inline-type-imports' },
      ],
    },
  },
  prettier,
);
