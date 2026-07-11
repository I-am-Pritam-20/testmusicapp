import React from 'react';
import {StatusBar, StyleSheet, useColorScheme, View} from 'react-native';
import {SafeAreaProvider,} from 'react-native-safe-area-context';
import PlayerScreen from './src/screens/PlayerScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <PlayerScreen />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000'
  },
});

export default App;