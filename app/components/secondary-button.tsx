/**
 * 補助ボタン。白カード面＋stage-navy 文字＋**同色の2px枠**。押下挙動は主役ボタンと同じ（DESIGN.md §5）。
 * destructive は削除系の操作にだけ使う（errorRed の文字と枠。curtainRed とは区別＝DESIGN §3）。
 *
 * 枠がある理由（2026-09-12 実機でユーザー指摘）：ボタンの地（cardWhite #FFFFFF）と
 * AppCard の地（PAPER_TINT #FFF9FC）はほぼ同じ色で、カードの上に置くと影だけが頼りになり
 * 「押せるもの」に見えなかった。文字と同じ色の枠を回して、どの地の上でもボタンと分かるようにする。
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
        // 枠は文字と同じ色（destructive なら赤枠・赤文字でそろう）
        { borderColor: color },
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
    borderWidth: 2,
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
