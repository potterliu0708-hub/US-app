// App.js - 最終優化版（支援 Dark Mode + 現代 UI）
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Navigation } from './src/navigation/TabNavigator';
import { signInAnonymously } from './services';

export default function App() {
  const [ready, setReady] = useState(false);
  const colorScheme = Appearance.getColorScheme() || 'light';

  useEffect(() => {
    signInAnonymously()
      .then(() => setReady(true))
      .catch(console.error);
  }, []);

  if (!ready) {
    return (
      <View style={[styles.splash, colorScheme === 'dark' && styles.darkBg]}>
        <ActivityIndicator size="large" color="#c026d3" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Navigation colorScheme={colorScheme} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  darkBg: {
    backgroundColor: '#0f172a',
  },
});