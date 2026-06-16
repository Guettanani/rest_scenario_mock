module.exports = {
  root: true,
  ignorePatterns: ['dist/', 'node_modules/', 'src-tauri/target/'],
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  plugins: ['react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
  },
  overrides: [
    {
      files: ['src/**/__tests__/**/*.[jt]s?(x)', 'src/**/*.test.[jt]s?(x)', 'src/**/*.spec.[jt]s?(x)'],
      env: {
        jest: true,
      },
      rules: {
        'no-unused-vars': 'off',
      },
    },
  ],
}
