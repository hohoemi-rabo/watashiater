/**
 * 全画面共通の背景。「背景は常に sky-top → sky-bottom の縦グラデーション」（DESIGN.md §3）。
 * 画面はこのコンポーネントをルートに置き、中身（ScrollView 等）は children で渡す。
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/tokens';

export function SkyBackground({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={[colors.skyTop, colors.skyBottom]} style={styles.gradient}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});
