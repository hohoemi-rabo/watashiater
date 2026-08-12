/**
 * みたよボタン（チケット16。DESIGN §8「拍手」）。
 * タップで手のひらアイコンが1回はじけ、spot-yellow の小さな紙吹雪が0.6秒舞う。
 * - 演出は家風どおり Reanimated の CSS キーフレーム。完了コールバックが無いので
 *   setTimeout でアンマウントする（curtain-overlay.tsx の判断記録と同じ）
 * - 粒子の飛び先は決定的な放射パターン（乱数を使わず見た目は十分ばらける。
 *   React Compiler 下で render 毎に値が変わる心配もない）
 * - reacted＝送信済みは押せない状態表示（アイコン塗りは「選択状態のみ」＝DESIGN §9）。
 *   みたよの取り消しは仕様に無い
 * - reduced-motion 時は演出を出さず状態だけ変える（DESIGN §8）
 */
import { Hand } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { TAP_TARGET_MIN, colors, radii, shadows, spacing } from '@/constants/tokens';

/** 紙吹雪の所要（DESIGN §8 指定の 0.6 秒）＋遅延ぶんの余韻でアンマウント */
const CONFETTI_MS = 600;
const BURST_TOTAL_MS = 700;
const ICON_POP_MS = 300;

/** 決定的な放射パターン（角度は等分＋半径・遅れ・大きさを周期でずらす） */
const PARTICLES = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * 2 * Math.PI;
  const radius = 44 + (i % 3) * 10;
  return {
    dx: Math.cos(angle) * radius,
    dy: Math.sin(angle) * radius,
    rotate: `${(i % 2 === 0 ? 1 : -1) * (90 + (i % 4) * 45)}deg`,
    delayMs: (i % 4) * 20,
    size: 6 + (i % 3),
  };
});

type MitayoButtonProps = {
  reacted: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function MitayoButton({ reacted, onPress, disabled }: MitayoButtonProps) {
  const reduceMotion = useReducedMotion();
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!burst) {
      return;
    }
    const timer = setTimeout(() => setBurst(false), BURST_TOTAL_MS);
    return () => clearTimeout(timer);
  }, [burst]);

  const handlePress = () => {
    if (!reduceMotion) {
      setBurst(true);
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: reacted }}
      disabled={disabled || reacted}
      onPress={handlePress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Animated.View
          style={
            burst
              ? {
                  animationName: {
                    '0%': { transform: [{ scale: 1 }] },
                    '40%': { transform: [{ scale: 1.35 }] },
                    '100%': { transform: [{ scale: 1 }] },
                  },
                  animationDuration: `${ICON_POP_MS}ms`,
                  animationTimingFunction: 'ease-out' as const,
                }
              : null
          }>
          <Hand
            color={reacted ? colors.spotYellow : colors.stageNavy}
            fill={reacted ? colors.spotYellow : 'none'}
            size={22}
            strokeWidth={2}
          />
        </Animated.View>
        {/* 紙吹雪：終わりの姿（飛び切って消えた状態）を base にし、from＝中央から飛ばす */}
        {burst
          ? PARTICLES.map((particle, index) => (
              <Animated.View
                key={index}
                pointerEvents="none"
                style={[
                  styles.particle,
                  {
                    height: particle.size,
                    width: particle.size,
                    opacity: 0,
                    transform: [
                      { translateX: particle.dx },
                      { translateY: particle.dy },
                      { rotate: particle.rotate },
                    ],
                    animationName: {
                      from: {
                        opacity: 1,
                        transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }],
                      },
                    },
                    animationDuration: `${CONFETTI_MS}ms`,
                    animationDelay: `${particle.delayMs}ms`,
                    animationTimingFunction: 'ease-out' as const,
                  },
                ]}
              />
            ))
          : null}
      </View>
      <AppText variant="cardTitle" style={styles.label}>
        {reacted ? 'みたよ しました' : 'みたよ'}
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
  iconWrap: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  label: {
    color: colors.stageNavy,
  },
  particle: {
    backgroundColor: colors.spotYellow,
    borderRadius: 2,
    position: 'absolute',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    ...shadows.rest,
  },
});
