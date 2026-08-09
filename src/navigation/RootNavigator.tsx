import React, {useState} from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from '@react-native-vector-icons/material-design-icons';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import LibraryScreen from '../screens/LibraryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AlbumDetailScreen from '../screens/AlbumDetailScreen';
import ArtistDetailScreen from '../screens/ArtistDetailScreen';
import PlaylistDetailScreen from '../screens/PlaylistDetailScreen';
import LikedSongsScreen from '../screens/LikedSongsScreen';
import DeviceSongsScreen from '../screens/DeviceSongsScreen';
import FollowedArtistsScreen from '../screens/FollowedArtistsScreen';
import DownloadsScreen from '../screens/DownloadsScreen';
import OfflineHomeScreen from '../screens/OfflineHomeScreen';
import PillTabBar from '../components/PillTabBar';
import {useNetworkStatus} from '../components/NetworkStatusProvider';

export type RootStackParamList = {
  Tabs: undefined;
  AlbumDetail: {id: string};
  ArtistDetail: {id: string};
  PlaylistDetail: {id?: string; link?: string; localPlaylistId?: string};
  LikedSongs: undefined;
  DeviceSongs: undefined;
  FollowedArtists: undefined;
  Downloads: undefined;
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Library: undefined;
  Settings: undefined;
};

export const TAB_BAR_HEIGHT = 68;

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs(): React.JSX.Element {
  const {viewMode} = useNetworkStatus();
  const [resetKeys, setResetKeys] = useState({home: 0, library: 0, settings: 0});

  const resetOnDirectPress = (tab: keyof typeof resetKeys) => ({
    tabPress: () => {
      setResetKeys(prev => ({...prev, [tab]: prev[tab] + 1}));
    },
  });

  return (
    <Tab.Navigator
      tabBar={props => <PillTabBar {...props} />}
      screenOptions={{headerShown: false}}>
      <Tab.Screen
        name="Home"
        listeners={resetOnDirectPress('home')}
        options={{title: 'Home', tabBarIcon: ({color, size}) => <Icon name="home" color={color} size={size} />}}>
        {() => (viewMode === 'offline' ? <OfflineHomeScreen key={resetKeys.home} /> : <HomeScreen key={resetKeys.home} />)}
      </Tab.Screen>
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{title: 'Search', tabBarIcon: ({color, size}) => <Icon name="magnify" color={color} size={size} />}}
      />
      <Tab.Screen
        name="Library"
        listeners={resetOnDirectPress('library')}
        options={{
          title: 'Library',
          tabBarIcon: ({color, size}) => <Icon name="music-box-multiple" color={color} size={size} />,
        }}>
        {() => <LibraryScreen key={resetKeys.library} />}
      </Tab.Screen>
      <Tab.Screen
        name="Settings"
        listeners={resetOnDirectPress('settings')}
        options={{title: 'Settings', tabBarIcon: ({color, size}) => <Icon name="cog" color={color} size={size} />}}>
        {() => <SettingsScreen key={resetKeys.settings} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function RootNavigator(): React.JSX.Element {
  const [hasLeftTabs, setHasLeftTabs] = useState(false);

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen
        name="Tabs"
        component={Tabs}
        options={{headerShown: false}}
        listeners={({navigation}) => ({
          focus: () => {
            if (hasLeftTabs) {
              setHasLeftTabs(false);
              navigation.navigate('Tabs', {screen: 'Home'} as never);
            }
          },
          blur: () => setHasLeftTabs(true),
        })}
      />
      <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} options={{title: 'Album'}} />
      <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} options={{title: 'Artist'}} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} options={{title: 'Playlist'}} />
      <Stack.Screen name="LikedSongs" component={LikedSongsScreen} options={{title: 'Liked Songs'}} />
      <Stack.Screen name="DeviceSongs" component={DeviceSongsScreen} options={{title: 'On This Device'}} />
      <Stack.Screen name="FollowedArtists" component={FollowedArtistsScreen} options={{title: 'Followed Artists'}} />
      <Stack.Screen name="Downloads" component={DownloadsScreen} options={{title: 'Downloaded'}} />
    </Stack.Navigator>
  );
}