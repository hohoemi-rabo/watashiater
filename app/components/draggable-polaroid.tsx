/**
 * ならべかえ用のドラッグラッパー（チケット14）。BoardPolaroid の中身には触らない。
 *
 * 位置の設計（ちらつきゼロの要）：
 * - 見た目の位置 = 基準位置（props の baseLeft/baseTop ＝自動整列 or DB保存値）+ offset 共有値
 * - ドロップは onFinalize ワークレット内で translation を offset に畳み込む
 *   （同一フレームで tx→ox に移すので、React の再描画を待たず跳ね戻りが起きない）
 * - 基準 props が変わる（refetch 着地）と offset を 0 に戻す。保存成功後は
 *   「新基準 == 旧基準 + offset」なので見た目は動かない
 * - 保存失敗・「もとにもどす」は revertSignal のインクリメントで offset を 0 へ滑らせ、
 *   真実（DB）の位置へ帰す
 *
 * ジェスチャー：
 * - 長押し（220ms）で持ち上げ。待機中に指が動くと Pan は fail して ScrollView が普通に勝つ。
 *   活性化すると RNGH がネイティブタッチを取り消す（GestureHandlerRootView が必須）
 * - ドラッグ中の最前面は zIndex（ドラッグ中のみ）。兄弟の並べ替えをジェスチャー中に
 *   行わない（GestureDetector の再アタッチを避ける）。静止時は「描画順=重なり」を維持
 * - 回転はドラッグで変えない（2本指回転はシニアの書き手には難しいので採用しない）
 * - React Compiler 対応：共有値は .get()/.set()、コールバックには 'worklet' を明示
 */
import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BoardPolaroid } from '@/components/board-polaroid';

const LONG_PRESS_MS = 220;
/** 持ち上がりの微拡大（DESIGN §8 で許可された「ドラッグの浮き上がり」の一部） */
const LIFT_SCALE = 1.03;
const LIFT_MS = 150;
/** はみ出しの戻り・失敗時の帰還の所要（DESIGN §8 の基準 200ms） */
const SETTLE_MS = 200;

type DraggablePolaroidProps = {
  photoId: string;
  uri: string | undefined;
  cacheKey: string;
  caption: string;
  hasRecording: boolean;
  /** 基準位置（px）。effective ではなく resolveBoardPlacements の結果を渡すこと */
  baseLeft: number;
  baseTop: number;
  width: number;
  height: number;
  rotation: number;
  /** クランプ境界（px） */
  boardWidth: number;
  boardHeight: number;
  rearrange: boolean;
  dragging: boolean;
  /** インクリメントされたら offset を 0 へ戻す（保存失敗・もとにもどす） */
  revertSignal: number;
  onLift: (photoId: string) => void;
  onDrop: (photoId: string, left: number, top: number) => void;
};

export const DraggablePolaroid = memo(function DraggablePolaroid({
  photoId,
  uri,
  cacheKey,
  caption,
  hasRecording,
  baseLeft,
  baseTop,
  width,
  height,
  rotation,
  boardWidth,
  boardHeight,
  rearrange,
  dragging,
  revertSignal,
  onLift,
  onDrop,
}: DraggablePolaroidProps) {
  const reduceMotion = useReducedMotion();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const scale = useSharedValue(1);
  const active = useSharedValue(false);

  // 基準位置が変わった（refetch 着地・画面幅変更）ら offset をリセット
  useEffect(() => {
    tx.set(0);
    ty.set(0);
    ox.set(0);
    oy.set(0);
  }, [baseLeft, baseTop, tx, ty, ox, oy]);

  // 保存失敗・もとにもどす：真実（DB）の位置へ滑って帰る
  useEffect(() => {
    if (revertSignal === 0) {
      return;
    }
    tx.set(0);
    ty.set(0);
    ox.set(reduceMotion ? 0 : withTiming(0, { duration: SETTLE_MS }));
    oy.set(reduceMotion ? 0 : withTiming(0, { duration: SETTLE_MS }));
  }, [revertSignal, reduceMotion, tx, ty, ox, oy]);

  const pan = Gesture.Pan()
    .enabled(rearrange)
    .activateAfterLongPress(LONG_PRESS_MS)
    .maxPointers(1)
    .onStart(() => {
      'worklet';
      active.set(true);
      scale.set(reduceMotion ? LIFT_SCALE : withTiming(LIFT_SCALE, { duration: LIFT_MS }));
      runOnJS(onLift)(photoId);
    })
    .onUpdate((event) => {
      'worklet';
      tx.set(event.translationX);
      ty.set(event.translationY);
    })
    .onFinalize(() => {
      'worklet';
      // 長押し前に fail したときは何もしない
      if (!active.get()) {
        return;
      }
      active.set(false);
      scale.set(reduceMotion ? 1 : withTiming(1, { duration: LIFT_MS }));
      // 平行移動を offset に畳み込む（同一フレーム＝ちらつきゼロ）
      const rawLeft = baseLeft + ox.get() + tx.get();
      const rawTop = baseTop + oy.get() + ty.get();
      ox.set(rawLeft - baseLeft);
      oy.set(rawTop - baseTop);
      tx.set(0);
      ty.set(0);
      // はみ出した分だけボード内へ滑って戻す
      const left = Math.min(Math.max(rawLeft, 0), boardWidth - width);
      const top = Math.min(Math.max(rawTop, 0), boardHeight - height);
      if (left !== rawLeft) {
        ox.set(reduceMotion ? left - baseLeft : withTiming(left - baseLeft, { duration: SETTLE_MS }));
      }
      if (top !== rawTop) {
        oy.set(reduceMotion ? top - baseTop : withTiming(top - baseTop, { duration: SETTLE_MS }));
      }
      runOnJS(onDrop)(photoId, left, top);
    });

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        { translateX: tx.get() + ox.get() },
        { translateY: ty.get() + oy.get() },
        { scale: scale.get() },
        // transform は animated 側の配列が丸ごと適用されるため回転もここに含める
        { rotate: `${rotation}deg` },
      ],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.wrapper,
          { height, left: baseLeft, top: baseTop, width },
          // 最前面はドラッグ中だけ（静止時は「描画順=重なり」の規約を守る）
          dragging ? styles.dragging : null,
          animatedStyle,
        ]}>
        <BoardPolaroid
          cacheKey={cacheKey}
          caption={caption}
          hasRecording={hasRecording}
          left={0}
          lifted={dragging}
          rotation={0}
          top={0}
          uri={uri}
          width={width}
        />
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  dragging: {
    zIndex: 1,
  },
  wrapper: {
    position: 'absolute',
  },
});
