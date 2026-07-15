import React from 'react';
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

export type RootStackParamList = {
  Tabs: undefined;
  AlbumDetail: {id: string};
  ArtistDetail: {id: string};
  PlaylistDetail: {id?: string; link?: string; localPlaylistId?: string};
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Library: undefined;
  Settings: undefined;
};

// Estimate of React Navigation's default bottom tab bar height on Android —
// PlayerOverlay (a sibling of NavigationContainer, not nested inside the
// tab tree) can't use useBottomTabBarHeight(), so the mini player's offset
// above it is an approximation. Adjust if it doesn't match on-device.
export const TAB_BAR_HEIGHT = 60;

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {backgroundColor: '#0d0d0d', borderTopColor: '#222', height: TAB_BAR_HEIGHT},
        tabBarActiveTintColor: '#1db954',
        tabBarInactiveTintColor: '#ffffff80',
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{tabBarIcon: ({color, size}) => <Icon name="home" color={color} size={size} />}}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{tabBarIcon: ({color, size}) => <Icon name="magnify" color={color} size={size} />}}
      />
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{tabBarIcon: ({color, size}) => <Icon name="music-box-multiple" color={color} size={size} />}}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{tabBarIcon: ({color, size}) => <Icon name="cog" color={color} size={size} />}}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{headerStyle: {backgroundColor: '#0d0d0d'}, headerTintColor: '#fff'}}>
      <Stack.Screen name="Tabs" component={Tabs} options={{headerShown: false}} />
      <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} options={{title: 'Album'}} />
      <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} options={{title: 'Artist'}} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} options={{title: 'Playlist'}} />
    </Stack.Navigator>
  );
}
