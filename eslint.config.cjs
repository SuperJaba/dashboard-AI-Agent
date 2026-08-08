module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly'
      }
    },
    // React plugin removed to avoid missing dependency; add if needed.
    rules: {
      indent: ['error', 2, { SwitchCase: 1 }],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      // TypeScript rules removed to avoid missing plugin dependency.
    },
    settings: {
      react: { version: 'detect' }
    }
  }
];
