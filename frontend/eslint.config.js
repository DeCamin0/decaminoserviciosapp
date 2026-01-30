import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'old/**',
      'archive/**',
      'decamino-web/**',
      'dev-dist/**',
      'build/**',
      '.vite/**',
      'android/**',
      'ios/**',
      '*.config.js',
      '*.config.ts',
      'vite.config.js',
      'tailwind.config.js',
      'postcss.config.js',
      'capacitor.config.ts',
      'tsconfig*.json',
      'test-*.js',
      'test-*.jsx',
      'update-version.js',
      'proxy-server.js',
      'fix-syntax.js',
      'scripts/**',
      'docs/**',
      '*.md',
      'CHANGELOG.md',
      'README*.md',
      'RELEASE*.md',
      'REVIEWER*.md',
      'SECURITY*.md',
      'DEMO*.md',
      'DATA_SAFETY*.md',
      '.env*',
      'env.*.config',
      'package-proxy.json',
      '**/autoscript.js',
      'public/autoscript.js',
      'public/vendor/**',
      '.eslintcache',
      '.eslintignore'
    ]
  },
  
  // Base config
  js.configs.recommended,
  
  // Global settings
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        __APP_VERSION__: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off'
    }
  },
  
  // CuadrantesEmpleadoPage.jsx specific
  {
    files: ['src/pages/CuadrantesEmpleadoPage.jsx'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z]' }]
    }
  },
  
  // JS/JSX files (except CuadrantesEmpleadoPage)
  {
    files: ['**/*.js', '**/*.jsx'],
    ignores: ['src/pages/CuadrantesEmpleadoPage.jsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'no-unused-vars': 'warn',
      'no-console': 'off'
    }
  },
  
  // TS/TSX files
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-unused-vars': 'off',
      ...reactHooks.configs.recommended.rules
    }
  }
];
