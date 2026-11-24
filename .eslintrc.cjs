// npm run lint — ত্রুটি (undefined ভ্যারিয়েবল, হুকের নিয়ম ভাঙা) হলে ফেল; অব্যবহৃত ভ্যারিয়েবল শুধু সতর্কতা
module.exports = {
  root: true, env: { browser: true, es2022: true, node: false }, ignorePatterns: ['dist', 'tests', 'scripts', 'public'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['react', 'react-hooks'], settings: { react: { version: '18.3' } },
  extends: ['eslint:recommended', 'plugin:react/jsx-runtime'],
  rules: {
    'react/jsx-uses-vars': 'error', 'react/jsx-no-undef': 'error', 'no-undef': 'error', 'react-hooks/rules-of-hooks': 'error',
    'no-unused-vars': ['warn', { varsIgnorePattern: '^_', args: 'none', ignoreRestSiblings: true }],
    'no-empty': 'off', 'no-useless-escape': 'off',
  },
}
