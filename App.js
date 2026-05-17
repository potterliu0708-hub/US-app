// App.js
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged, signInAnonymously, setupBackgroundHandler } from './services';
import { usePhotos, usePairing, useNotifications, Navigation } from './ui';

// Must run before any component mount
setupBackgroundHandler();

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(async user => {
      if (!user) await signInAnonymously();
      setReady(true);
    });
    return unsub;
  }, []);

  const photos        = usePhotos('我');
  const pairing       = usePairing();
  const notifications = useNotifications();

  if (!ready || photos.loading) {
    return (
      <View style={s.splash}>
        <ActivityIndicator size="large" color="#007aff"/>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex:1 }}>
      <SafeAreaProvider>
        <Navigation
          photosHook={photos}
          pairing={pairing}
          notifications={notifications}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  splash: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#f2f2f7' },
});
