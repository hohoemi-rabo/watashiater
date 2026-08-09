/**
 * 浮いている白カード（DESIGN.md §2 原則1「すべてのカードは浮いている」・§5）。
 * 「白カードには 1px の極薄ハイライト（上辺）を入れ、紙のエッジを感じさせる。
 * ベタの白矩形にしない」（§5 質感）を、
 *   1) カード地を cardWhite からごくわずかに skyBottom 側へ寄せた紙色にし、
 *   2) 上辺に 1px の純白（cardWhite）ラインを重ねる
 * ことで実装する。紙色はトークンの混色（cardWhite 85% + skyBottom 15%）で、
 * 生値ではなくトークン由来（DESIGN.md §12 の判断記録）。
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, shadows, spacing } from '@/constants/tokens';

/** cardWhite(#FFFFFF) 85% + skyBottom(#FDF6E8) 15% の混色。演目札（prompt-card）と共有 */
export const PAPER_TINT = '#FFFEFC';

type AppCardProps = {
  children: ReactNode;
  /** 影の段階（DESIGN.md §5 の3段階以外を発明しない） */
  shadow?: keyof typeof shadows;
  style?: StyleProp<ViewStyle>;
};

export function AppCard({ children, shadow = 'rest', style }: AppCardProps) {
  return (
    <View style={[styles.card, shadows[shadow], style]}>
      <View style={styles.topHighlight} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PAPER_TINT,
    borderRadius: radii.card,
    overflow: 'visible',
    padding: spacing.xl,
  },
  topHighlight: {
    backgroundColor: colors.cardWhite,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
