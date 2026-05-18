module.exports = {
  root: true,
  env: { 
    browser: true, 
    es2021: true, 
    node: true 
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-native/all',
    'prettier'
  ],
  parserOptions: { 
    ecmaVersion: 'latest', 
    sourceType: 'module' 
  },
  plugins: ['react', 'react-native'],
  rules: {
    'react/prop-types': 'off',
    'react-native/no-inline-styles': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'warn',
    'react/react-in-jsx-scope': 'off'   // React 17+ 已不需要 import React
  },
  settings: { 
    react: { version: 'detect' } 
  }
};