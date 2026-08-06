//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      // Build output and generated sources: not in any tsconfig project, and
      // not ours to fix.
      '**/.output/**',
      '**/.nitro/**',
      '**/.tanstack/**',
      '**/dist/**',
      'target/**',
      '**/routeTree.gen.ts',
    ],
  },
]
