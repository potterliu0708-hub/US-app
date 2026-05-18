// src/components/PhotoCard.js
import React from 'react';
import { View, Image, StyleSheet, Text, TouchableOpacity, Appearance } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
import * as Haptics from 'react-native-haptic-feedback';
import FastImage from 'react-native-fast-image';

const PhotoCard = ({ photo, onDoubleTap }) => {
  const scale = useSharedValue(1);
  const colorScheme = Appearance.getColorScheme() || 'light';
  const isDark = colorScheme === 'dark';

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleDoubleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    scale.value = withSequence(
      withSpring(1.8, { damping: 10 }),
      withSpring(1, { damping: 15 })
    );
    
    onDoubleTap();
  };

  return (
    <Animated.View 
      style={[styles.card, isDark && styles.darkCard]}
      entering={Animated.FadeInUp}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={handleDoubleTap}>
        <FastImage
          source={{ uri: photo.url }}
          style={styles.image}
          resizeMode={FastImage.resizeMode.cover}
        />
        
        {/* 玻璃擬真愛心浮層 */}
        <Animated.View style={[styles.heartContainer, heartStyle]}>
          <Text style={styles.heart}>❤️</Text>
        </Animated.View>
      </TouchableOpacity>

      <View style={styles.info}>
        <Text style={[styles.likeCount, isDark && styles.darkText]}>
          {photo.likes || 0} 人喜歡
        </Text>
        {photo.comment && (
          <Text style={[styles.comment, isDark && styles.darkText]} numberOfLines={2}>
            💬 {photo.comment}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  darkCard: {
    backgroundColor: '#1e2937',
    shadowOpacity: 0.3,
  },
  image: {
    width: '100%',
    height: 480,
  },
  heartContainer: {
    position: 'absolute',
    top: '45%',
    left: '45%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    fontSize: 80,
    opacity: 0.95,
  },
  info: {
    padding: 16,
  },
  likeCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e2937',
    marginBottom: 6,
  },
  comment: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
  },
  darkText: {
    color: '#f1f5f9',
  },
});

export default PhotoCard;