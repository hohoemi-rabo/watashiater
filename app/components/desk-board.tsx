/**
 * 机の上ボードの背景と縁（チケット13。DESIGN §5「机の上ボード」）。
 * deskWood の全面に、ごく薄い木目と「机の縁」の内側シャドウを重ねる。
 *
 * 実装の判断：
 * - 木目は「縦線のみ」のビューポート固定 SVG。縦線は縦スクロールで見た目が変わらないため、
 *   コンテンツに載せて全高（最大 ~6,600px）ぶんのレイヤーを持つ必要がない（メモリ節約）
 * - 内側シャドウは RN に無いので、4辺に置いた LinearGradient（stageNavy α0.15 → 0）で擬似する。
 *   縁は「机を覗く額縁」なのでスクロールに追随させず、SafeArea の外＝画面全体を囲む
 * - どちらも pointerEvents="none"：チケット14のドラッグ・15のタップを絶対に遮らない
 */
import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { colors } from '@/constants/tokens';

/** 縁の内側シャドウの太さと濃さ（stageNavy ベース。影3段の値とは別の「質感」扱い） */
const EDGE_WIDTH = 20;
const EDGE_COLOR_FROM = `${colors.stageNavy}26`; // α≈0.15
const EDGE_COLOR_TO = `${colors.stageNavy}00`;

/** 板の継ぎ目（濃いめ）と木目（薄め）の x 位置（幅比）と不透明度 */
const SEAMS = [0.25, 0.5, 0.75];
const GRAINS = [0.09, 0.18, 0.37, 0.62, 0.83, 0.93];
const SEAM_OPACITY = 0.06;
const GRAIN_OPACITY = 0.03;

export function DeskBoard({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  return (
    <View style={styles.board}>
      {/* 木目（背面・固定） */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg height={height} width={width}>
          {SEAMS.map((x) => (
            <Line
              key={`seam-${x}`}
              stroke={colors.stageNavy}
              strokeOpacity={SEAM_OPACITY}
              strokeWidth={1.5}
              x1={x * width}
              x2={x * width}
              y1={0}
              y2={height}
            />
          ))}
          {GRAINS.map((x) => (
            <Line
              key={`grain-${x}`}
              stroke={colors.stageNavy}
              strokeOpacity={GRAIN_OPACITY}
              strokeWidth={1}
              x1={x * width}
              x2={x * width}
              y1={0}
              y2={height}
            />
          ))}
        </Svg>
      </View>

      {children}

      {/* 机の縁（前面・固定）：4辺の内側シャドウ */}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.deskWood,
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
});
