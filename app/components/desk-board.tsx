/**
 * 机の上ボードの背景（チケット13。DESIGN §5「机の上ボード」）。
 *
 * 実装の判断：
 * - 木目は DESIGN §5 が許す「軽量テクスチャ画像1枚」方式。コード描画の縦線では
 *   木に見えなかった（実機フィードバック）ため、scripts/gen-wood-tile.mjs で生成した
 *   縦シームレスなタイル（512x1024・板の継ぎ目と年輪入り）を敷く
 * - 木目（DeskGrain）は年輪が見えるので、スクロールに追随しないと「写真だけが滑る」
 *   違和感が出る。ScrollView の中（コンテンツ直下）に置き、RN 標準 Image の
 *   resizeMode="repeat" でコンテンツ全高にタイルさせる（メモリはタイル1枚ぶんだけ）
 * - pointerEvents="none"：チケット14のドラッグ・15のタップを絶対に遮らない
 * - 「机の縁」（外周の内側シャドウ・木枠）は当初 DESIGN §5 どおり実装したが、
 *   実機確認で「枠が何なのか分からない」と判断され削除した（2026-08-12 ユーザー判断。
 *   DESIGN §5 も同日更新済み。閲覧Web＝チケット21でも縁は作らないこと）
 */
import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/tokens';

/**
 * 木目レイヤー。ScrollView コンテンツの最初の子として置く（絶対配置で全高を覆う）。
 * タイルの地色は colors.deskWood を焼き込み済みなので、届かない領域（バウンス等）は
 * DeskBoard の背景色と自然につながる
 */
export function DeskGrain() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        resizeMode="repeat"
        source={require('@/assets/images/wood-tile.png')}
        style={styles.grain}
      />
    </View>
  );
}

export function DeskBoard({ children }: { children: ReactNode }) {
  return <View style={styles.board}>{children}</View>;
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.deskWood,
    flex: 1,
  },
  grain: {
    flex: 1,
  },
});
