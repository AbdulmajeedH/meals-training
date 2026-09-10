module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Turns drizzle's generated `.sql` migration files into string imports.
      // Pairs with the `sql` sourceExt in metro.config.js.
      ['inline-import', { extensions: ['.sql'] }],
      // Reanimated 4 ships its worklet transform in react-native-worklets.
      // It must stay last in the plugin list.
      'react-native-worklets/plugin',
    ],
  };
};
