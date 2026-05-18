// src/screens/SettingsScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Appearance, Alert } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { getCurrentUserId, pairWithCode } from '../../services';

const SettingsScreen = () => {
  const colorScheme = Appearance.getColorScheme() || 'light';
  const isDark = colorScheme === 'dark';
  const userId = getCurrentUserId();

  const handlePair = async () => {
    Alert.prompt(
      '輸入配對碼',
      '請輸入對方的 6 位配對碼',
      async (code) => {
        if (code) {
          try {
            await pairWithCode(code);
            Alert.alert('配對成功 💕', '已與對方成功配對！');
          } catch (error) {
            Alert.alert('配對失敗', error.message);
          }
        }
      }
    );
  };

  return (
    <View style={[styles.container, isDark && styles.darkContainer]}>
      <Animated.Text 
        entering={FadeIn}
        style={[styles.title, isDark && styles.darkText]}
      >
        設定 ⚙️
      </Animated.Text>

      <View style={styles.card}>
        <Text style={[styles.label, isDark && styles.darkText]}>使用者 ID</Text>
        <Text style={[styles.value, isDark && styles.darkText]} selectable>
          {userId || '未登入'}
        </Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={handlePair}>
        <Text style={styles.buttonText}>🔗 輸入配對碼</Text>
      </TouchableOpacity>

      <Text style={[styles.note, isDark && styles.darkText]}>
        版本 1.1.0 • 優化後版本
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  darkContainer: {
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 30,
    color: '#1e2937',
  },
  darkText: {
    color: '#f1f5f9',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  label: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#c026d3',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  note: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 13,
    color: '#94a3b8',
  },
});

export default SettingsScreen;