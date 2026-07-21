import React from 'react';
import {StatusBar} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import PlayerOverlay from './src/screens/PlayerOverlay';
import {PlaybackQueueProvider} from './src/context/PlaybackQueueContext';
import {AppearanceProvider, useAppearanceTokens} from './src/context/AppearanceContext';
import {AppAlertProvider} from './src/components/AppAlertProvider';
import {AppToastProvider} from './src/components/AppToastProvider';
import {NetworkStatusProvider} from './src/components/NetworkStatusProvider';

/** Reads the current appearance tokens to pick a matching status bar
 *  style — has to live below AppearanceProvider to read them. */
function ThemedStatusBar(): React.JSX.Element {
  const tokens = useAppearanceTokens();
  return (
    <StatusBar
      barStyle={tokens.isDark ? 'light-content' : 'dark-content'}
      backgroundColor={tokens.topBarBg}
    />
  );
}

/**
 * Root composition. Provider order matters here and is load-bearing:
 *  - PlaybackQueueProvider is outermost of the app providers because
 *    AppearanceProvider reads the current track from it (for the
 *    artwork-derived appearance modes).
 *  - AppearanceProvider comes next because AppToastProvider (and most
 *    screens) read its tokens.
 *  - AppToastProvider comes before NetworkStatusProvider because the
 *    latter shows toasts through it (the "You're offline" / "You're
 *    back online" flow).
 *  - RootNavigator and PlayerOverlay are siblings under the same
 *    NavigationContainer — PlayerOverlay is a persistent overlay, not a
 *    stack screen, so it stays mounted and in sync across every tab.
 */
export default function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <PlaybackQueueProvider>
          <AppearanceProvider>
            <AppAlertProvider>
              <AppToastProvider>
                <NetworkStatusProvider>
                  <ThemedStatusBar />
                  <NavigationContainer>
                    <RootNavigator />
                    <PlayerOverlay />
                  </NavigationContainer>
                </NetworkStatusProvider>
              </AppToastProvider>
            </AppAlertProvider>
          </AppearanceProvider>
        </PlaybackQueueProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
