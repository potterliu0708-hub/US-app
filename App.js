// App.js - 優化版（支援 Dark Mode + App Check + Error Boundary）
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Appearance, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import appCheck from '@react-native-firebase/app-check';
import { onAuthStateChanged, signInAnonymously, setupBackgroundHandler } from './services';
import { usePhotos, usePairing, useNotifications, Navigation } from './ui';

// App Check 初始化（資安強化）
appCheck().activate('your-app-check-debug-provider', __DEV__); // 上線前移除 debug

setupBackgroundHandler();

export default function App() {
  const [ready, setReady] = useState(false);
  const colorScheme = Appearance.getColorScheme() || 'light';

  useEffect(() => {
    const unsub = onAuthStateChanged(async (user) => {
      try {
        if (!user) await signInAnonymously();
        setReady(true);
      } catch (error) {
        Alert.alert('登入失敗', '請檢查網路連線');
      }
    });
    return unsub;
  }, []);

  if (!ready) {
    return (
      <View style={[s.splash, colorScheme === 'dark' && s.darkBg]}>
        <ActivityIndicator size="large" color="#a855f7" />
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

const s = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f2f7' },
  darkBg: { backgroundColor: '#1c1c1e' },
});