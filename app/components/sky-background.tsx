/**
 * 全画面共通の背景。「背景は常に sky-top → sky-mid(60%) → sky-bottom の縦グラデーション」
 * （DESIGN.md §3。チケット28で3色化）。
 * 画面はこのコンポーネントをルートに置き、中身（ScrollView 等）は children で渡す。
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/tokens';

/**
 * 空グラデの指定値。SafeArea を自前で扱う画面（story の幕演出）が同じ空を敷くための export。
 * ここ以外にグラデの生値を書かない（DESIGN §3 の一元管理）
 */
export const SKY_GRADIENT = {
  colors: [colors.skyTop, colors.skyMid, colors.skyBottom],
  locations: [0, 0.6, 1],
} as const;

export function SkyBackground({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={SKY_GRADIENT.colors}
      locations={SKY_GRADIENT.locations}
      style={styles.gradient}>
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
