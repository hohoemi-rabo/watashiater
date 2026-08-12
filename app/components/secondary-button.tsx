/**
 * 補助ボタン。白カード面＋stage-navy 文字。押下挙動は主役ボタンと同じ（DESIGN.md §5）。
 * destructive は削除系の操作にだけ使う（errorRed 文字。curtainRed とは区別＝DESIGN §3）。
 */
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { TAP_TARGET_MIN, colors, radii, shadows, spacing } from '@/constants/tokens';

type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  /** 削除系（アカウント削除など）。ラベルとアイコンを errorRed にする */
  destructive?: boolean;
};

export function SecondaryButton({
  label,
  onPress,
  icon: Icon,
  disabled,
  destructive,
}: SecondaryButtonProps) {
  const color = destructive ? colors.errorRed : colors.stageNavy;
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
      {Icon ? <Icon color={color} size={22} strokeWidth={2} /> : null}
      <AppText variant="cardTitle" style={{ color }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.cardWhite,
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
});
