/**
 * 演目札カード（DESIGN.md §6.2。ワタシアターの顔のひとつ）。
 * 劇場のチケット半券のメタファー：左端に半券のミシン目（点線）と上下の半円切り欠き。
 * 未回答は白地、回答済みは切り欠き部に spot-yellow の「済」スタンプ。
 * （回答済み札の写真サムネイルは photos ができるチケット09で追加する）
 *
 * 形は react-native-svg の Path で描く。切り欠きは透過で、背景の空グラデが本当に透ける。
 * 影の実装判断（DESIGN §12 記録）：SVG は形が矩形でないため elevation が使えず、
 * RN の boxShadow（新アーキテクチャで Android/iOS 両対応）をトークンの影から導出して使う。
 * 切り欠き部分だけ影が直線のまま通るが、半径9px なので許容した。
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { PAPER_TINT } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { colors, fonts, radii, shadows, spacing } from '@/constants/tokens';

/** 半券部（ミシン目までの幅） */
const STUB_WIDTH = 64;
/** 切り欠き半円の半径 */
const NOTCH_RADIUS = 9;

/** #RRGGBB を rgba() 文字列へ（トークンの色を透過つきで使うため） */
function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** トークンの影定義（iOS 形式）を RN の boxShadow 配列へ変換する */
function toBoxShadow(shadow: (typeof shadows)[keyof typeof shadows]) {
  const { shadowColor, shadowOffset, shadowRadius, shadowOpacity } = shadow;
  return [
    {
      offsetX: shadowOffset.width,
      offsetY: shadowOffset.height,
      blurRadius: shadowRadius,
      color: hexToRgba(shadowColor, shadowOpacity),
    },
  ];
}

/** 角丸矩形＋ミシン目位置の上下に半円切り欠き、のチケット形 Path */
function ticketPath(w: number, h: number) {
  const r = radii.card;
  const s = STUB_WIDTH;
  const n = NOTCH_RADIUS;
  return [
    `M ${r} 0`,
    `L ${s - n} 0`,
    `A ${n} ${n} 0 0 0 ${s + n} 0`, // 上の切り欠き（下向きの半円）
    `L ${w - r} 0`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `L ${w} ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `L ${s + n} ${h}`,
    `A ${n} ${n} 0 0 0 ${s - n} ${h}`, // 下の切り欠き（上向きの半円）
    `L ${r} ${h}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ');
}

type PromptCardProps = {
  title: string;
  answered: boolean;
  /** 回答済みのとき本文の先頭を1行だけ見せる */
  preview?: string;
  onPress: () => void;
};

export function PromptCard({ title, answered, preview, onPress }: PromptCardProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) {
      setSize({ w: width, h: height });
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`お題：${title}${answered ? '（かいとうずみ）' : ''}`}
      onPress={onPress}
      onLayout={handleLayout}
      style={({ pressed }) => [
        styles.card,
        { boxShadow: toBoxShadow(pressed ? shadows.rest : shadows.raised) },
        pressed && styles.pressed,
      ]}>
      {size ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Path d={ticketPath(size.w, size.h)} fill={PAPER_TINT} />
          <Line
            x1={STUB_WIDTH}
            y1={NOTCH_RADIUS + spacing.xs}
            x2={STUB_WIDTH}
            y2={size.h - NOTCH_RADIUS - spacing.xs}
            stroke={colors.textSoft}
            strokeWidth={1}
            strokeDasharray="3 5"
            opacity={0.6}
          />
        </Svg>
      ) : null}

      <View style={styles.stub}>
        {answered ? (
          <View style={styles.stamp}>
            <AppText style={styles.stampText}>済</AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <AppText variant="cardTitle">{title}</AppText>
        {answered && preview ? (
          <AppText variant="caption" numberOfLines={1}>
            {preview}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 88,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  stub: {
    alignItems: 'center',
    justifyContent: 'center',
    width: STUB_WIDTH,
  },
  stamp: {
    alignItems: 'center',
    borderColor: colors.spotYellow,
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    // スタンプらしいわずかな傾き（DESIGN §2「完全な水平垂直を疑う」）
    transform: [{ rotate: '-8deg' }],
    width: 44,
  },
  stampText: {
    color: colors.spotYellow,
    fontFamily: fonts.heading,
    fontSize: 20,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
});
