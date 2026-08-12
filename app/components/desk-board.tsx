/**
 * 机の上ボードの背景と縁（チケット13。DESIGN §5「机の上ボード」）。
 *
 * 実装の判断：
 * - 木目は DESIGN §5 が許す「軽量テクスチャ画像1枚」方式。コード描画の縦線では
 *   木に見えなかった（実機フィードバック）ため、scripts/gen-wood-tile.mjs で生成した
 *   縦シームレスなタイル（512x1024・板の継ぎ目と年輪入り）を敷く
 * - 木目（DeskGrain）は年輪が見えるので、スクロールに追随しないと「写真だけが滑る」
 *   違和感が出る。ScrollView の中（コンテンツ直下）に置き、RN 標準 Image の
 *   resizeMode="repeat" でコンテンツ全高にタイルさせる（メモリはタイル1枚ぶんだけ）
 * - 机の縁（DeskBoard 側）は「机を覗く額縁」なのでビューポート固定のまま。
 *   RN に内側シャドウは無いので「濃い縁の帯＋内向きに薄れるグラデ」で作る
 * - どちらも pointerEvents="none"：チケット14のドラッグ・15のタップを絶対に遮らない
 */
import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/tokens';

/** deskWood を明暗させた派生色を作る（生値を増やさず単一ソースを保つ。木目タイルと同じ考え方） */
function shade(hex: string, factor: number): string {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((value >> shift) & 0xff) * factor)));
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * 机の縁：半透明の影だけでは木肌の上で見えない（実機フィードバック）ため、
 * 不透明の濃い木枠＋面取りのハイライト1本＋内側へ薄れる影、の3層で「木の額縁」にする。
 * 8dp では細くて枠と認識されなかった（実機フィードバック2回目）ので、
 * はっきり「机の縁」と分かる太さにし、影も stageNavy ではなく木の暗色にして馴染ませる
 */
const RIM_WIDTH = 14;
const RIM_COLOR = shade(colors.deskWood, 0.45); // 濃い枠木
const RIM_HIGHLIGHT_WIDTH = 2;
const RIM_HIGHLIGHT_COLOR = shade(colors.deskWood, 1.25); // 面取りに当たる光
const EDGE_INSET = RIM_WIDTH + RIM_HIGHLIGHT_WIDTH;
const EDGE_WIDTH = 28;
const EDGE_COLOR_FROM = `${shade(colors.deskWood, 0.35)}59`; // 木の暗色 α≈0.35
const EDGE_COLOR_TO = `${shade(colors.deskWood, 0.35)}00`;

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
  return (
    <View style={styles.board}>
      {children}

      {/* 机の縁（前面・ビューポート固定）：濃い木枠＋面取りの光＋内側へ薄れる影 */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.rim} />
        <View style={styles.rimHighlight} />
        <LinearGradient
          colors={[EDGE_COLOR_FROM, EDGE_COLOR_TO]}
          style={[styles.edge, styles.edgeTop]}
        />
        <LinearGradient
          colors={[EDGE_COLOR_TO, EDGE_COLOR_FROM]}
          style={[styles.edge, styles.edgeBottom]}
        />
        <LinearGradient
          colors={[EDGE_COLOR_FROM, EDGE_COLOR_TO]}
          end={{ x: 1, y: 0 }}
          start={{ x: 0, y: 0 }}
          style={[styles.edgeSide, styles.edgeLeft]}
        />
        <LinearGradient
          colors={[EDGE_COLOR_TO, EDGE_COLOR_FROM]}
          end={{ x: 1, y: 0 }}
          start={{ x: 0, y: 0 }}
          style={[styles.edgeSide, styles.edgeRight]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.deskWood,
    flex: 1,
  },
  grain: {
    flex: 1,
  },
  edge: {
    height: EDGE_WIDTH,
    left: EDGE_INSET,
    position: 'absolute',
    right: EDGE_INSET,
  },
  edgeBottom: {
    bottom: EDGE_INSET,
  },
  edgeLeft: {
    left: EDGE_INSET,
  },
  edgeRight: {
    right: EDGE_INSET,
  },
  edgeSide: {
    bottom: EDGE_INSET,
    position: 'absolute',
    top: EDGE_INSET,
    width: EDGE_WIDTH,
  },
  edgeTop: {
    top: EDGE_INSET,
  },
  // 枠は border で4辺と角をまとめて描く（辺ごとの View を並べるより単純で角も綺麗）
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderColor: RIM_COLOR,
    borderWidth: RIM_WIDTH,
  },
  rimHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderColor: RIM_HIGHLIGHT_COLOR,
    borderWidth: RIM_HIGHLIGHT_WIDTH,
    margin: RIM_WIDTH,
  },
});
