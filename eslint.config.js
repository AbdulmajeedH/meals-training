const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    // supabase/ is Deno, not React Native — it has its own runtime and globals.
    ignores: ['dist/*', 'drizzle/*', 'node_modules/*', '.expo/*', 'supabase/*'],
  },
  {
    // Reanimated's public API is assignment to `sharedValue.value`, which the
    // React Compiler's immutability rule reads as mutating a React value. The
    // writes here are all inside gesture handlers and effects, never in render.
    files: ['src/components/**/*.tsx', 'app/**/*.tsx'],
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
];
