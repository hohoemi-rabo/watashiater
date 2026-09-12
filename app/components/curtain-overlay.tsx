/**
 * 緞帳オーバーレイ（チケット12。チケット29で「布の緞帳」に作り直し）。
 * **朱色の緞帳そのもの**を出すのはアプリ内でここだけ（DESIGN.md §7 自分史）。
 * ギャラリーの拡大表示（photo-lightbox.tsx）はチケット30 で同じひだの幕を使うようになったが、
 * あちらは金の縁も飾り幕も無い軽い版＝共有するのは lib/pleats.ts の色と座標だけ。
 *
 * 実装の判断：
 * - Reanimated の CSS アニメ（保存スタンプと同じ流儀）には完了コールバックが無いため、
 *   フェーズ進行（closing → closed → opening → なし）は親が CLOSE/OPEN の定数で setTimeout する
 * - 各フェーズの「終わりの姿」を base style にし、from キーフレームからそこへ滑らせる。
 *   アニメ終了後も最終位置が base として残るので、タイマーの誤差に依存しない。
 *   ただし **animationFillMode: 'backwards' が必須**：既定の 'none' はアニメ登録
 *   （componentDidMount＝描画の後）までの1フレームを base＝終わりの姿で描くため、
 *   全面を覆う幕がその1フレームだけ出てパッと光る（チケット23の実機で確認）
 * - 布に見せる3点（チケット29。クローズドテストの声）：
 *   1) ひだ＝横方向グラデの縦縞（lib/pleats.ts）。View を本数ぶん並べない
 *   2) 束ね縮み＝外側の端を原点にした translateX + scaleX。ひだが詰まって「束ねられた」に見える
 *   3) 飾り幕（バランス）＋金の縁・房。矩形でない形なので react-native-svg（prompt-card と同じ判断）
 * - reduced-motion 時はスライドせず「閉じた緞帳」を静的に出すだけ（親が閉幕待ちを 0ms にする）
 */
import { LinearGradient } from 'expo-linear-gradient';
import { Fragment } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { colors, spacing } from '@/constants/tokens';
import { PLEAT_SHADOW, buildPleatStops, curtainGather } from '@/lib/pleats';

export type CurtainPhase = 'closing' | 'closed' | 'opening';

/** 閉幕の所要時間（チケット29で 900→1000ms。重い布らしく。生成待ちなので大きくは延ばさない） */
export const CURTAIN_CLOSE_MS = 1000;
/**
 * 開幕の所要時間（チケット29で 1200→2000ms）。
 * 閲覧Web の開幕（DESIGN §6.1・1.2秒）とは**意図的に別**：あちらは訪問者を待たせない演出、
 * こちらは生成の見せ場なので重い緞帳としてゆっくり開く（2026-09-08 テストの声）
 */
export const CURTAIN_OPEN_MS = 2000;

// --- 見た目の調整つまみ（実機で触るのはここだけ） ---
/** 開き切ったときの幕の幅（元の何倍まで束ねるか） */
const GATHER_SCALE = 0.5;
/** 片側のひだ本数。半幅 200dp で1本 33dp ＝布の畳み目として読める細さ */
const FOLDS_PER_PANEL = 6;
/** 幕の内側（中央側）の金ライン */
const GOLD_EDGE_WIDTH = 3;
/** 飾り幕の平らな部分の高さ */
const VALANCE_HEIGHT = 38;
/** 飾り幕の弧の数（画面幅ぜんぶで）。細かく割ると波打つ帯にしか見えないので、大きく4つ垂らす */
const VALANCE_SCALLOPS = 4;
/** 弧の垂れ下がり。浅いと「弧」と読めないので深く取る */
const SCALLOP_DEPTH = 34;
/** 房の長さ */
const FRINGE_LENGTH = 10;
/** 房の先の玉 */
const FRINGE_DOT_R = 2;
/** 飾り幕が幕に落とす影の下げ幅。これが無いと飾り幕と幕の縞が地続きに見える */
const VALANCE_SHADOW_DROP = 7;
/** 同じく影の太さ */
const VALANCE_SHADOW_WIDTH = 8;
/** 飾り幕が開幕の終盤で消えるまで */
const VALANCE_FADE_MS = 600;

const PANEL_PLEATS = buildPleatStops(FOLDS_PER_PANEL);
// 飾り幕は幕の3倍の密度で寄せる。幕と同じ間隔にすると縞が地続きになり、
// 別布が手前に掛かっているように見えない（プレビューで確認）
const VALANCE_PLEATS = buildPleatStops(FOLDS_PER_PANEL * 3);

/** 弧の最下点（二次ベジェの中点＝制御点の半分ぶんだけ下がる） */
const SCALLOP_BOTTOM = VALANCE_HEIGHT + SCALLOP_DEPTH / 2;
/** SVG の高さ。房の先と影の下端のどちらが下に来ても切れないよう、下端に1px 余らせる */
const VALANCE_TOTAL_HEIGHT =
  Math.max(
    SCALLOP_BOTTOM + FRINGE_LENGTH + FRINGE_DOT_R,
    SCALLOP_BOTTOM + VALANCE_SHADOW_DROP + VALANCE_SHADOW_WIDTH / 2,
  ) + 1;

/**
 * 弧の連なり（右端から左端へ）。二次ベジェで描く＝SVG 円弧のフラグの向きを取り違えない。
 * dropY は影用に同じ形を下へずらすため
 */
function scallopEdge(width: number, dropY = 0): string {
  const span = width / VALANCE_SCALLOPS;
  const segments: string[] = [];
  for (let i = VALANCE_SCALLOPS - 1; i >= 0; i -= 1) {
    const controlX = (i + 0.5) * span;
    segments.push(
      `Q ${controlX} ${VALANCE_HEIGHT + SCALLOP_DEPTH + dropY} ${i * span} ${VALANCE_HEIGHT + dropY}`,
    );
  }
  return segments.join(' ');
}

function CurtainPanel({
  side,
  half,
  phase,
  reduceMotion,
}: {
  side: 'left' | 'right';
  half: number;
  phase: CurtainPhase;
  reduceMotion: boolean;
}) {
  // 閉じた姿と束ねた姿の2つだけ。座標と並び順の理屈は lib/pleats.ts のコメントに書いた
  const { origin, closed, gathered } = curtainGather(side, half, GATHER_SCALE);
  const base = !reduceMotion && phase === 'opening' ? gathered : closed;

  const animation =
    reduceMotion || phase === 'closed'
      ? null
      : {
          animationName: { from: { transform: phase === 'closing' ? gathered : closed } },
          animationDuration: `${phase === 'closing' ? CURTAIN_CLOSE_MS : CURTAIN_OPEN_MS}ms`,
          animationTimingFunction: 'ease-in-out' as const,
          animationFillMode: 'backwards' as const,
        };

  return (
    <Animated.View
      style={[
        styles.panel,
        side === 'left' ? styles.left : styles.right,
        { width: half, transformOrigin: origin, transform: base },
        animation,
      ]}>
      <LinearGradient
        colors={PANEL_PLEATS.colors}
        locations={PANEL_PLEATS.locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {/* 金の縁は幕の内側（中央側）だけ。幕と一緒に細くなるが、束ねられた布として自然なので補正しない */}
      <View style={[styles.goldEdge, side === 'left' ? styles.goldEdgeRight : styles.goldEdgeLeft]} />
    </Animated.View>
  );
}

function Valance({
  width,
  phase,
  reduceMotion,
}: {
  width: number;
  phase: CurtainPhase;
  reduceMotion: boolean;
}) {
  const edge = scallopEdge(width);
  const shadowEdge = scallopEdge(width, VALANCE_SHADOW_DROP);
  const span = width / VALANCE_SCALLOPS;
  const fringeTop = SCALLOP_BOTTOM;

  // 開幕の終盤で消える。本文の上に飾りを残さないため（overlay ごとアンマウントされるので後始末は不要）。
  // animationFillMode: 'backwards' が delay の間の「不透明」を保つ
  const fade =
    !reduceMotion && phase === 'opening'
      ? {
          animationName: { from: { opacity: 1 } },
          animationDuration: `${VALANCE_FADE_MS}ms`,
          animationDelay: `${CURTAIN_OPEN_MS - VALANCE_FADE_MS}ms`,
          animationTimingFunction: 'ease-in' as const,
          animationFillMode: 'backwards' as const,
        }
      : null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.valance,
        { opacity: !reduceMotion && phase === 'opening' ? 0 : 1 },
        fade,
      ]}>
      <Svg width={width} height={VALANCE_TOTAL_HEIGHT}>
        <Defs>
          <SvgGradient id="valancePleats" x1="0" y1="0" x2="1" y2="0">
            {VALANCE_PLEATS.colors.map((color, index) => (
              <Stop
                key={`${index}-${color}`}
                offset={VALANCE_PLEATS.locations[index]}
                stopColor={color}
              />
            ))}
          </SvgGradient>
        </Defs>
        {/* 飾り幕が幕に落とす影（手前に掛かっていることを示す）。幕本体より先に描く */}
        <Path
          d={`M ${width} ${VALANCE_HEIGHT + VALANCE_SHADOW_DROP} ${shadowEdge}`}
          fill="none"
          opacity={0.26}
          stroke={PLEAT_SHADOW}
          strokeWidth={VALANCE_SHADOW_WIDTH}
        />
        {/* 上は直線、下は弧の連なり */}
        <Path
          d={`M 0 0 L ${width} 0 L ${width} ${VALANCE_HEIGHT} ${edge} Z`}
          fill="url(#valancePleats)"
        />
        {/* 弧の縁だけをなぞる金のライン（控えめに） */}
        <Path
          d={`M ${width} ${VALANCE_HEIGHT} ${edge}`}
          fill="none"
          stroke={colors.curtainGold}
          strokeWidth={2}
        />
        {/* 房：弧の最下点から短く垂らす */}
        {Array.from({ length: VALANCE_SCALLOPS }, (_, index) => {
          const x = (index + 0.5) * span;
          return (
            <Fragment key={index}>
              <Line
                x1={x}
                y1={fringeTop}
                x2={x}
                y2={fringeTop + FRINGE_LENGTH}
                stroke={colors.curtainGold}
                strokeLinecap="round"
                strokeWidth={2}
              />
              <Circle
                cx={x}
                cy={fringeTop + FRINGE_LENGTH}
                r={FRINGE_DOT_R}
                fill={colors.curtainGold}
              />
            </Fragment>
          );
        })}
      </Svg>
    </Animated.View>
  );
}

export function CurtainOverlay({ phase }: { phase: CurtainPhase }) {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  // 2枚の幕で全幅を覆う。切り上げ＋1px で中央に隙間を作らない
  const half = Math.ceil(width / 2) + 1;

  return (
    // 開き始めたら下の画面に触れるようにする（幕はもう操作を遮らない）
    <View pointerEvents={phase === 'opening' ? 'none' : 'auto'} style={styles.overlay}>
      <CurtainPanel side="left" half={half} phase={phase} reduceMotion={reduceMotion} />
      <CurtainPanel side="right" half={half} phase={phase} reduceMotion={reduceMotion} />
      {/* 飾り幕は幕の手前（劇場の額縁なので常に前面）。画面上端なので中央のラベルとは重ならない */}
      <Valance width={width} phase={phase} reduceMotion={reduceMotion} />
      {phase === 'closed' ? (
        <View pointerEvents="none" style={styles.center}>
          {/* 進行中表示（recording-box の uploading と同じ扱い。装飾ループではない） */}
          {!reduceMotion ? <ActivityIndicator color={colors.cardWhite} size="large" /> : null}
          <AppText variant="cardTitle" style={styles.label}>
            準備中…
          </AppText>
          <AppText variant="caption" style={styles.caption}>
            できあがるまで30秒ほどかかります
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    color: colors.cardWhite,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
  },
  goldEdge: {
    backgroundColor: colors.curtainGold,
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: GOLD_EDGE_WIDTH,
  },
  goldEdgeLeft: {
    left: 0,
  },
  goldEdgeRight: {
    right: 0,
  },
  label: {
    color: colors.cardWhite,
  },
  left: {
    left: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  panel: {
    bottom: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  right: {
    right: 0,
  },
  valance: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
