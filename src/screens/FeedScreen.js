// src/screens/FeedScreen.js
import React from 'react';
import { View, StyleSheet, FlatList, Text, Appearance } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'react-native-haptic-feedback';
import PhotoCard from '../components/PhotoCard';
import { usePhotos } from '../hooks/usePhotos';

const FeedScreen = () => {
  const colorScheme = Appearance.getColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const { photos, loading, toggleLike } = usePhotos();

  const handleDoubleTap = (photoKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleLike(photoKey);
  };

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <Animated.Text 
        entering={FadeIn}
        style={[styles.title, isDark && styles.darkText]}
      >
        今日我們的故事 💕
      </Animated.Text>

      {loading ? (
        <Text style={styles.loading}>載入中...</Text>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <PhotoCard 
              photo={item} 
              onDoubleTap={() => handleDoubleTap(item.key)} 
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  darkContainer: {
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 20,
    color: '#1e2937',
  },
  darkText: {
    color: '#f1f5f9',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  loading: {
    flex: 1,
    textAlign: 'center',
    marginTop: 100,
    fontSize: 18,
    color: '#64748b',
  },
});

export default FeedScreen;