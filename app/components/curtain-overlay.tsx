/**
 * 緞帳オーバーレイ（チケット12）。幕演出をアプリ内で使ってよい唯一の場面（DESIGN.md §7 じぶん史）。
 *
 * 実装の判断：
 * - Reanimated の CSS アニメ（保存スタンプと同じ流儀）には完了コールバックが無いため、
 *   フェーズ進行（closing → closed → opening → なし）は親が CLOSE/OPEN の定数で setTimeout する
 * - 各フェーズの「終わりの姿」を base style にし、from キーフレームからそこへ滑らせる。
 *   アニメ終了後も最終位置が base として残るので、fill-mode やタイマーの誤差に依存しない
 * - translateX はピクセル値（画面半幅）。キーフレーム内の % 指定は公式例に無く挙動未保証
 * - reduced-motion 時はスライドせず「閉じた赤幕」を静的に出すだけ（親が閉幕待ちを 0ms にする）
 */
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { colors, spacing } from '@/constants/tokens';

export type CurtainPhase = 'closing' | 'closed' | 'opening';

/** 閉幕の所要時間 */
export const CURTAIN_CLOSE_MS = 900;
/** 開幕の所要時間（DESIGN §6.1 の Web 開幕 1.2 秒に合わせる） */
export const CURTAIN_OPEN_MS = 1200;

export function CurtainOverlay({ phase }: { phase: CurtainPhase }) {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  // 2枚の幕で全幅を覆う。切り上げ＋1px で中央に隙間を作らない
  const half = Math.ceil(width / 2) + 1;

  const panelStyle = (offscreenX: number) => {
    // 開幕中だけ「画面外」が終わりの姿。それ以外（閉幕中・閉幕済み）は「中央まで閉じた姿」
    const baseX = !reduceMotion && phase === 'opening' ? offscreenX : 0;
    const animation =
      reduceMotion || phase === 'closed'
        ? null
        : phase === 'closing'
          ? {
              animationName: { from: { transform: [{ translateX: offscreenX }] } },
              animationDuration: `${CURTAIN_CLOSE_MS}ms`,
              animationTimingFunction: 'ease-in-out' as const,
            }
          : {
              animationName: { from: { transform: [{ translateX: 0 }] } },
              animationDuration: `${CURTAIN_OPEN_MS}ms`,
              animationTimingFunction: 'ease-in-out' as const,
            };
    return [{ width: half, transform: [{ translateX: baseX }] }, animation];
  };

  return (
    // 開き始めたら下の画面に触れるようにする（幕はもう操作を遮らない）
    <View pointerEvents={phase === 'opening' ? 'none' : 'auto'} style={styles.overlay}>
      <Animated.View style={[styles.panel, styles.left, ...panelStyle(-half)]} />
      <Animated.View style={[styles.panel, styles.right, ...panelStyle(half)]} />
      {phase === 'closed' ? (
        <View pointerEvents="none" style={styles.center}>
          {/* 進行中表示（recording-box の uploading と同じ扱い。装飾ループではない） */}
          {!reduceMotion ? <ActivityIndicator color={colors.cardWhite} size="large" /> : null}
          <AppText variant="cardTitle" style={styles.label}>
            じゅんびちゅう…
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
    backgroundColor: colors.curtainRed,
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  right: {
    right: 0,
  },
});
