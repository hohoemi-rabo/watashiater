/**
 * 進捗ドット（DESIGN.md §6.2「座席が埋まるように点灯するドット10個」）。
 * 回答済みの席が spot-yellow に点灯する。エラー・警告の意味では使わない。
 */
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/constants/tokens';

const DOT_SIZE = 16;

export function ProgressDots({ total, filled }: { total: number; filled: number }) {
  return (
    <View accessibilityLabel={`${total}このうち ${filled}こ かいとうずみ`} style={styles.row}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.dot, index < filled ? styles.dotFilled : styles.dotEmpty]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dot: {
    borderRadius: DOT_SIZE / 2,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
  dotFilled: {
    backgroundColor: colors.spotYellow,
  },
  dotEmpty: {
    backgroundColor: colors.cardWhite,
    borderColor: colors.textSoft,
    borderWidth: 1,
    opacity: 0.7,
  },
});
