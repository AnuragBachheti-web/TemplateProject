import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    // Node-context scripts: the extraction pipeline and the project's own build config files.
    // Plain recommended JS rules + Node globals (process, __dirname's absence covered by import.meta
    // in these files, etc.) — none of the React-specific setup below applies here.
    files: ['extraction/**/*.js', '*.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    // eslint-plugin-react-hooks still ships its "recommended-latest" config in the legacy
    // eslintrc shape (plugins: ["react-hooks"]), which flat config's `extends` rejects — so its
    // plugin registration and rules are pulled in by hand instead of via `extends`.
    //
    // `flat.recommended` is what teaches core no-unused-vars that a component referenced only as
    // `<Foo />` counts as used (react/jsx-uses-vars) — without it, every component import is
    // flagged as unused. `flat['jsx-runtime']` follows it to turn back off the two rules
    // (react-in-jsx-scope, jsx-uses-react) that assume the old React-must-be-in-scope transform,
    // which React 19's automatic runtime doesn't need.
    extends: [
      js.configs.recommended,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactRefresh.configs.vite,
    ],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      // Plain JS/JSX project, no prop-types (or any other schema library) — don't require it.
      'react/prop-types': 'off',
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
  },
])
