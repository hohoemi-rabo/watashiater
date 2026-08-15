/**
 * アプリのロゴ表記（DESIGN.md §4 / REQUIREMENTS.md §1.1）。
 *
 * 「ワタシ」と「シアター」は "シ" で重なる合成語なので、その一字だけを幕の朱色にして
 * 由来を見せる。文字そのものは変えないので読みは崩れない（読み手が60〜80代であること、
 * ストア掲載名が「ワタシアター」であることから、ひらがな混ぜの表記は採らない）。
 * 下段の欧文は要件書が認めている「ロゴ装飾としての英字」。字間を大きく開けて、
 * 劇場のプログラムのような佇まいにする。
 */
import { StyleSheet, View, type ViewProps } from 'react-native';

import { AppText } from '@/components/app-text';
import { colors, fonts } from '@/constants/tokens';

export function AppLogo({ style, ...rest }: ViewProps) {
  return (
    <View
      accessibilityRole="header"
      // 読み上げは分割した文字ではなく1語として渡す
      accessibilityLabel="ワタシアター"
      style={[styles.wrapper, style]}
      {...rest}>
      <AppText variant="screenTitle" style={styles.wordmark}>
        ワタ<AppText variant="screenTitle" style={styles.pivot}>シ</AppText>アター
      </AppText>
      <AppText style={styles.subline}>WATASHI THEATER</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 2,
  },
  wordmark: {
    color: colors.stageNavy,
    textAlign: 'center',
  },
  /** 「ワタシ」と「シアター」が重なる一字 */
  pivot: {
    color: colors.curtainRed,
  },
  subline: {
    color: colors.stageNavy,
    fontFamily: fonts.heading,
    // 本文の最小サイズ規定（DESIGN §4「14px未満を本文に使わない」）はロゴ装飾には
    // かからない。読ませる文字ではなく、字間で佇まいを作るための要素
    fontSize: 10,
    letterSpacing: 3.4,
    opacity: 0.72,
    // letterSpacing は字の右側に入るため、中央揃えが1文字ぶん左へずれる。その分を戻す
    paddingLeft: 3.4,
    textAlign: 'center',
  },
});
