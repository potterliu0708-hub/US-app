// src/navigation/TabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Appearance } from 'react-native';
import FeedScreen from '../screens/FeedScreen';
import AlbumScreen from '../screens/AlbumScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export const Navigation = ({ colorScheme }) => {
  const isDark = colorScheme === 'dark';

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            borderTopColor: isDark ? '#334155' : '#e2e8f0',
            height: 60,
          },
          tabBarActiveTintColor: '#c026d3',
          tabBarInactiveTintColor: isDark ? '#94a3b8' : '#64748b',
          headerStyle: {
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
          },
          headerTintColor: isDark ? '#f1f5f9' : '#0f172a',
        }}
      >
        <Tab.Screen 
          name="Feed" 
          component={FeedScreen} 
          options={{ title: '今日故事' }} 
        />
        <Tab.Screen 
          name="Album" 
          component={AlbumScreen} 
          options={{ title: '回憶相簿' }} 
        />
        <Tab.Screen 
          name="Settings" 
          component={SettingsScreen} 
          options={{ title: '設定' }} 
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};