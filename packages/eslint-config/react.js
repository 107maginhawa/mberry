import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import base from './base.js';

/** ESLint flat config for React + Vite (and any browser-targeting React project). */
export default tseslint.config(
  ...base,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      // Escalate to error for React apps — all as any must be explicitly justified
      '@typescript-eslint/no-explicit-any': 'error',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'warn',
      'react/no-unknown-property': ['warn', { ignore: ['cmdk-input-wrapper'] }],

      // Enforce @monobase/ui primitives — prevent raw HTML form elements
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: 'Use <Button> from @monobase/ui instead of raw <button>.',
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message: 'Use <Input> from @monobase/ui instead of raw <input>.',
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: 'Use <Select> from @monobase/ui instead of raw <select>.',
        },
        {
          selector: "JSXOpeningElement[name.name='textarea']",
          message: 'Use <Textarea> from @monobase/ui instead of raw <textarea>.',
        },
        {
          selector: "JSXOpeningElement[name.name='label']",
          message: 'Use <Label> from @monobase/ui instead of raw <label>.',
        },
      ],
    },
  },
  // Test files: relax no-explicit-any (vi.mock factories use any for prop type signatures)
  // This override must come AFTER the main config to take precedence.
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
