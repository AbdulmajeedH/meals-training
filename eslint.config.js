const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['dist/*', 'drizzle/*', 'node_modules/*', '.expo/*'],
  },
];
