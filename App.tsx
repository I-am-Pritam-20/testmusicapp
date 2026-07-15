import React from 'react';
import {StatusBar, StyleSheet, useColorScheme, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {NavigationContainer} from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import PlayerOverlay from './src/screens/PlayerOverlay';
import {PlaybackQueueProvider} from './src/context/PlaybackQueueContext';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    // Required by react-native-gesture-handler — without this wrapper,
    // its gesture handlers (used in ModalSheet/QueueSheet/MenuSheet)
    // silently fail to recognize touches at all.
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <PlaybackQueueProvider>
          <View style={styles.container}>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
            {/* Sibling of the navigator, not a screen inside it — stays
                visible and in sync across every tab. */}
            <PlayerOverlay />
          </View>
        </PlaybackQueueProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
