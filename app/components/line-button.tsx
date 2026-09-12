/**
 * LINE へ送るボタン（チケット32）。寸法・影・押下挙動は PrimaryButton と同じで、地色だけ lineGreen。
 *
 * PrimaryButton に色の prop を足さずに別部品にしているのは、curtain-red の
 * 「各画面で最も重要なアクション1つにだけ使う」という規約（DESIGN.md §3）を薄めないため。
 * スタイルが重複するのは承知のうえで、主役ボタン＝赤という対応を崩さない側を選んだ。
 *
 * LINE のロゴ画像は使わない（商標ガイドラインの制約を持ち込まない）。緑地に白文字と
 * 汎用の吹き出しアイコンで「LINE へ送る」と分かるようにする。
 */
import { MessageCircle } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { TAP_TARGET_MIN, colors, radii, shadows, spacing } from '@/constants/tokens';

type LineButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function LineButton({ label, onPress, disabled }: LineButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <MessageCircle color={colors.cardWhite} size={22} strokeWidth={2} />
      <AppText variant="cardTitle" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.lineGreen,
    borderRadius: radii.button,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: TAP_TARGET_MIN,
    minWidth: TAP_TARGET_MIN,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    ...shadows.raised,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    ...shadows.rest,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.cardWhite,
  },
});
