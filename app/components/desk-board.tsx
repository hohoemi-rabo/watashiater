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

/** 縁の帯（濃い枠）と内側シャドウの寸法・濃さ（stageNavy の透過＝影と同じ色相で統一） */
const RIM_WIDTH = 6;
const RIM_COLOR = `${colors.stageNavy}4D`; // α≈0.30
const EDGE_WIDTH = 26;
const EDGE_COLOR_FROM = `${colors.stageNavy}33`; // α≈0.20
const EDGE_COLOR_TO = `${colors.stageNavy}00`;

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

      {/* 机の縁（前面・ビューポート固定）：濃い帯＋内側へ薄れるシャドウの額縁 */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
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
        <View style={[styles.rim, styles.rimTop]} />
        <View style={[styles.rim, styles.rimBottom]} />
        <View style={[styles.rimSide, styles.rimLeft]} />
        <View style={[styles.rimSide, styles.rimRight]} />
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
    left: 0,
    position: 'absolute',
    right: 0,
  },
  edgeBottom: {
    bottom: 0,
  },
  edgeLeft: {
    left: 0,
  },
  edgeRight: {
    right: 0,
  },
  edgeSide: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: EDGE_WIDTH,
  },
  edgeTop: {
    top: 0,
  },
  rim: {
    backgroundColor: RIM_COLOR,
    height: RIM_WIDTH,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  rimBottom: {
    bottom: 0,
  },
  rimLeft: {
    left: 0,
  },
  rimRight: {
    right: 0,
  },
  rimSide: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: RIM_WIDTH,
  },
  rimTop: {
    top: 0,
  },
});
