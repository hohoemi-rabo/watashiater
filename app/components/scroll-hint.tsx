/**
 * 「下にもあります」の案内（チケット33）。カードが1画面に収まらない画面で、
 * 下に続きがあることに気づかない生徒さんがいたため（クローズドテストの声）。
 *
 * 実装の判断：
 * - **ScrollView は各画面が持ち続ける**。ラッパー部品にすると既存画面の構造を書き換えることになるので、
 *   フック（判定と ref）と表示部品に分け、画面は ScrollView に props を渡すだけにする
 * - 判定に使う値（内容の高さ・表示領域の高さ・もうスクロールしたか）は state ではなく ref に持つ。
 *   スクロールのたびに再レンダーせず、`visible` が実際に変わるときだけ更新する
 * - **一度スクロールしたら、その画面にいる間は二度と出さない**。上に戻るたびに出し直すと、
 *   すでに気づいた人にはしつこいだけで、案内の役目（下に続きがあると教える）は済んでいる
 * - 動きは出現時の 200ms フェードだけ。矢印を揺らし続けない（DESIGN §8「装飾アニメの常時ループ禁止」）
 * - **セーフエリアは自分で足さない**：置き場所は SkyBackground の中＝既に
 *   `SafeAreaView edges={['top','bottom']}` の内側なので、ここで insets を足すと二重になり、
 *   ジェスチャーナビの端末で浮きすぎる。この部品は「画面のセーフエリアの内側に置く」前提
 */
import { ChevronDown } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { colors, radii, shadows, spacing } from '@/constants/tokens';

/** これだけ動いたら「気づいた」とみなして消す */
const SCROLLED_PAST = 40;
/** この差より小さければ「1画面に収まっている」＝案内を出さない */
const OVERFLOW_MIN = 8;
/** 押したときに進む量（表示領域に対する割合）。次のカードの頭が見える程度に留める */
const SCROLL_STEP_RATIO = 0.8;
/** 出現のフェード（DESIGN §8 の基準 200ms） */
const FADE_IN_MS = 200;

export function useScrollHint() {
  const [visible, setVisible] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const dismissed = useRef(false);

  const update = () => {
    const next =
      !dismissed.current && contentHeight.current > viewportHeight.current + OVERFLOW_MIN;
    setVisible((prev) => (prev === next ? prev : next));
  };

  const onLayout = (event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
    update();
  };

  // 読み込みで中身が伸びる画面があるので（share は最初 loading で短い）、後から出せるようにする
  const onContentSizeChange = (_width: number, height: number) => {
    contentHeight.current = height;
    update();
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (dismissed.current || event.nativeEvent.contentOffset.y < SCROLLED_PAST) {
      return;
    }
    dismissed.current = true;
    update();
  };

  const scrollDown = () => {
    scrollRef.current?.scrollTo({
      y: viewportHeight.current * SCROLL_STEP_RATIO,
      animated: true,
    });
  };

  return {
    visible,
    scrollRef,
    scrollViewProps: { onLayout, onContentSizeChange, onScroll, scrollEventThrottle: 16 },
    scrollDown,
  };
}

export function ScrollHint({ onPress }: { onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  const fadeIn = reduceMotion
    ? null
    : {
        animationName: { from: { opacity: 0 } },
        animationDuration: `${FADE_IN_MS}ms`,
        animationTimingFunction: 'ease-out' as const,
        animationFillMode: 'backwards' as const,
      };

  return (
    // box-none：錠剤の外側のタップは下の ScrollView へ通す
    <Animated.View pointerEvents="box-none" style={[styles.wrap, fadeIn]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="下にもあります"
        onPress={onPress}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
        <AppText variant="caption" style={styles.label}>
          下にもあります
        </AppText>
        <ChevronDown color={colors.stageNavy} size={20} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    bottom: spacing.xl,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  // 白い面はカードの上に重なると埋もれるので、文字と同じ色の枠で押せると示す（チケット32 の流儀）
  pill: {
    alignItems: 'center',
    backgroundColor: colors.cardWhite,
    borderColor: colors.stageNavy,
    borderRadius: radii.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadows.raised,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    ...shadows.rest,
  },
  label: {
    color: colors.stageNavy,
  },
});
