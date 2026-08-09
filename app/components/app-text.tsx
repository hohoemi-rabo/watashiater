/**
 * トークン準拠のテキスト。フォント・サイズ・行間・色をすべて tokens から引く。
 * variant は DESIGN.md §4 のサイズ表に対応：
 *   screenTitle … 画面タイトル 24 / Zen Maru Gothic Bold
 *   cardTitle   … カードタイトル 18 / Zen Maru Gothic Bold
 *   body        … 本文 16 / Noto Sans JP Regular（行間1.7）
 *   bodyMedium  … 本文 16 / Noto Sans JP Medium
 *   caption     … 補助 13 / text-soft
 *   story       … じぶん史ページ専用 18 / Shippori Mincho（行間2.0）
 */
import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts, fontSizes, lineHeights } from '@/constants/tokens';

type Variant = 'screenTitle' | 'cardTitle' | 'body' | 'bodyMedium' | 'caption' | 'story';

type AppTextProps = TextProps & {
  variant?: Variant;
};

export function AppText({ variant = 'body', style, ...rest }: AppTextProps) {
  return <Text style={[styles[variant], style]} {...rest} />;
}

// RN の lineHeight は絶対値なので、tokens の倍率 × fontSize で算出する
const styles = StyleSheet.create({
  screenTitle: {
    color: colors.stageNavy,
    fontFamily: fonts.heading,
    fontSize: fontSizes.screenTitle,
  },
  cardTitle: {
    color: colors.stageNavy,
    fontFamily: fonts.heading,
    fontSize: fontSizes.cardTitle,
  },
  body: {
    color: colors.stageNavy,
    fontFamily: fonts.body,
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
  },
  bodyMedium: {
    color: colors.stageNavy,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
  },
  caption: {
    color: colors.textSoft,
    fontFamily: fonts.body,
    fontSize: fontSizes.caption,
  },
  story: {
    color: colors.stageNavy,
    fontFamily: fonts.story,
    fontSize: fontSizes.storyBody,
    lineHeight: fontSizes.storyBody * lineHeights.story,
  },
});
