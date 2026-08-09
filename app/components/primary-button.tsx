/**
 * 主役ボタン。curtain-red は「各画面で最も重要なアクション1つにだけ使う」（DESIGN.md §3）。
 * タップ時はわずかに沈む：scale 0.98 ＋ 影を rest へ（§5「押した感」）。
 */
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { TAP_TARGET_MIN, colors, radii, shadows, spacing } from '@/constants/tokens';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, icon: Icon, disabled }: PrimaryButtonProps) {
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
      {Icon ? <Icon color={colors.cardWhite} size={22} strokeWidth={2} /> : null}
      <AppText variant="cardTitle" style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.curtainRed,
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
