// src/screens/AlbumScreen.js
import React from 'react';
import { View, Text, StyleSheet, Appearance, FlatList } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import FastImage from 'react-native-fast-image';

const AlbumScreen = () => {
  const colorScheme = Appearance.getColorScheme() || 'light';
  const isDark = colorScheme === 'dark';

  // 暫時使用靜態資料，後續可接 usePhotos 或獨立 Hook
  const albumPhotos = []; // 未來可擴充為個人相簿

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <Animated.Text 
        entering={FadeIn}
        style={[styles.title, isDark && styles.darkText]}
      >
        我們的回憶相簿 📸
      </Animated.Text>

      <FlatList
        data={albumPhotos}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.photoItem}>
            <FastImage source={{ uri: item.url }} style={styles.thumbnail} />
          </View>
        )}
        numColumns={3}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, isDark && styles.darkText]}>
            尚未有回憶照片\n一起上傳第一張吧 💕
          </Text>
        }
      />
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
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 20,
    color: '#1e2937',
  },
  darkText: {
    color: '#f1f5f9',
  },
  list: {
    padding: 8,
  },
  photoItem: {
    flex: 1/3,
    padding: 4,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
  },
  empty: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
  },
});

export default AlbumScreen;