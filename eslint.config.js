import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Architecture boundaries (see CLAUDE.md):
//   domain  -> nothing app-level (no React, no diagram library)
//   layout  -> domain only
//   only canvas/ may import @xyflow/react
const noUi = [
  { name: 'react', message: 'domain/ and layout/ are plain TypeScript.' },
  { name: 'react-dom', message: 'domain/ and layout/ are plain TypeScript.' },
  { name: '@xyflow/react', message: 'Only src/canvas may import the diagram library.' },
  { name: 'zustand', message: 'domain/ and layout/ do not know about state.' },
];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', '.venv-study', 'study-out'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: { ...globals.node } } },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: noUi,
        patterns: [{ group: ['**/layout/**', '**/state/**', '**/canvas/**', '**/symbols/**', '**/pages/**', '**/shell/**'], message: 'domain/ imports nothing from the app.' }],
      }],
    },
  },
  {
    files: ['src/layout/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: noUi,
        patterns: [{ group: ['**/state/**', '**/canvas/**', '**/symbols/**', '**/pages/**', '**/shell/**'], message: 'layout/ may import domain/ only.' }],
      }],
    },
  },
  {
    files: ['src/{state,symbols,pages,shell,dev}/**/*.{ts,tsx}', 'src/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: '@xyflow/react', message: 'Only src/canvas may import the diagram library.' }] }],
    },
  },
);
