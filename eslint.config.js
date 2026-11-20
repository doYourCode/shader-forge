import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

const TS_FILES = ['**/*.{ts,mts,cts}'];
const TYPE_AWARE_FILES = [...TS_FILES, '**/*.vue'];

/**
 * Layering rules. The dependency direction is `core` <- `services` <- UI, and
 * these rules turn the documented architecture into a build failure instead of
 * a convention. Only module aliases are checked: the `@/` specifier is the
 * project's import convention.
 */
const RETIRED_LIB = {
  group: ['@/lib/*'],
  message:
    'src/lib was folded into src/core/content and src/services/content. Import from there instead.',
};

const CORE_ONLY = {
  group: ['vue', 'vue-*', '@babylonjs/*', '@codemirror/*'],
  message:
    'src/core is framework-free: keep it plain TypeScript so it stays testable without a browser or renderer.',
};

const CORE_NO_OUTER = {
  group: [
    '@/services/*',
    '@/components/*',
    '@/composables/*',
    '@/views/*',
    '@/layouts/*',
  ],
  message: 'src/core must not depend on outer layers. Invert the dependency.',
};

const SERVICES_NO_UI = {
  group: ['@/components/*', '@/views/*', '@/layouts/*', '@/composables/*'],
  message: 'Services must not depend on UI layers.',
};

const UI_NO_ENGINES = {
  group: ['@babylonjs/*', '@codemirror/*', '@/services/babylon/*'],
  message:
    'UI must go through service ports (for example SceneManager/EditorManager), not an engine directly.',
};

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
      // Async correctness is blocking: an unhandled or misused promise in the
      // load/compile pipeline can silently drop a failure.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { fixStyle: 'inline-type-imports' },
      ],
    },
  },
  /**
   * Retired path, checked for every source file. Layer blocks below also list
   * it, because a later matching block replaces this rule wholesale.
   */
  {
    files: ['src/**/*.{ts,vue}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [RETIRED_LIB] },
      ],
    },
  },
  {
    files: ['src/core/**/*.{ts,vue}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [CORE_ONLY, CORE_NO_OUTER, RETIRED_LIB] },
      ],
    },
  },
  {
    files: ['src/services/**/*.{ts,vue}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [SERVICES_NO_UI, RETIRED_LIB] },
      ],
    },
  },
  {
    files: [
      'src/components/**/*.{ts,vue}',
      'src/views/**/*.{ts,vue}',
      'src/layouts/**/*.{ts,vue}',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: [UI_NO_ENGINES, RETIRED_LIB] },
      ],
    },
  },
  prettier,
);
