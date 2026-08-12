/**
 * 写真ライトボックス（チケット15「写真が語る」。REQUIREMENTS §3.4② / DESIGN §7）。
 * 写真タップで拡大表示し、録音があれば本人の声を自動再生する（体験の核3）。
 *
 * 実装の判断：
 * - 背景は DIMMED_SKY＝skyTop 85% + stageNavy 15% の混色。DESIGN §7「空色を少し濃くする」・
 *   §11-4「黒背景・夜の劇場化禁止」。app-card.tsx の PAPER_TINT と同じトークン由来混色方式
 * - 閉じる＝即アンマウント（退場アニメなし）。CSS アニメには完了コールバックが無く
 *   （curtain-overlay.tsx の判断記録）、「閉じたら音声が即止まる」が完了条件そのもの。
 *   useAudioPlayer はアンマウントで自動 release＝停止する
 * - 録音がある写真に本文テキストは併記しない（仕様の文字どおり「拡大＋音声」。
 *   録音なしの写真だけテキストエピソードを出す。ユーザー決定＝docs/15 メモ）
 * - audio mode は自動再生の直前に設定する。設定しないと再生が受話口から小さく鳴る
 *   （recording-box.tsx の教訓）。録音モードには入れないので後始末は不要
 * - 読み込み失敗は10秒タイムアウトで検知（SDK 54 の AudioStatus に error フィールドが無い）。
 *   「もういちどよみこむ」→ 親の refetch → 新しい署名URLが props で流れ込み source が差し替わる。
 *   読み込みが初めて成功した時点で1回だけ自動再生する（リトライ成功後も含む＝聞きたくて押している）
 */
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { Pause, Play, RotateCcw, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { POLAROID_FRAME } from '@/components/board-polaroid';
import { MitayoButton } from '@/components/mitayo-button';
import { SecondaryButton } from '@/components/secondary-button';
import { colors, shadows, spacing } from '@/constants/tokens';

/** skyTop(#A8DCF0) 85% + stageNavy(#2B3A55) 15% の混色（DESIGN §7「空色を少し濃くする」） */
export const DIMMED_SKY = '#95C4D9';
/** 開くアニメの所要（DESIGN §8 の基準 200ms） */
const OPEN_MS = 200;
/** 音声読み込みの見切り（AudioStatus に error が無いための代替検知） */
const LOAD_TIMEOUT_MS = 10000;

const LOAD_ERROR_MESSAGE =
  '声をよみこめませんでした。電波のよいところで、もういちどためしてください。';

type PhotoLightboxProps = {
  uri: string | undefined;
  /** expo-image のディスクキャッシュキー（photo.r2_key。ボードと同じ絵が即出る） */
  cacheKey: string;
  caption: string;
  /** 本文エピソード（'' あり。録音なしのときだけ表示する） */
  bodyText: string;
  hasRecording: boolean;
  recordingUrl: string | undefined;
  onClose: () => void;
  /** 音声よみこみ失敗 → 親の refetch（署名URLの取り直し） */
  onRetry: () => void;
  /** 家族の閲覧時だけ渡す「みたよ」（チケット16）。書き手側は渡さない＝表示しない */
  reaction?: { reacted: boolean; onReact: () => void };
  /** オフライン（チケット19）。声はオンライン前提なので、赤いエラーではなく案内を出す */
  offline?: boolean;
};

export function PhotoLightbox({
  uri,
  cacheKey,
  caption,
  bodyText,
  hasRecording,
  recordingUrl,
  onClose,
  onRetry,
  reaction,
  offline,
}: PhotoLightboxProps) {
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const player = useAudioPlayer(recordingUrl ? { uri: recordingUrl } : null);
  const status = useAudioPlayerStatus(player);

  const [timedOut, setTimedOut] = useState(false);
  const autoPlayedRef = useRef(false);

  // リトライで新しい署名URLが届いたら、前回のタイムアウト表示を解いて読み込みからやり直す
  useEffect(() => {
    setTimedOut(false);
  }, [recordingUrl]);

  // 読み込みの見切りタイマー（成功すれば isLoaded が立って解除される）
  useEffect(() => {
    if (!hasRecording || recordingUrl === undefined || status.isLoaded) {
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hasRecording, recordingUrl, status.isLoaded]);

  // 自動再生：読み込みが初めて成功した時点で1回だけ。audio mode を先に整える
  // （render 中に player インスタンスのプロパティは読まない＝reactCompiler 規約）
  useEffect(() => {
    if (!status.isLoaded || autoPlayedRef.current) {
      return;
    }
    autoPlayedRef.current = true;
    void (async () => {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });
      player.play();
    })();
  }, [status.isLoaded, player]);

  const handleToggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    player.play();
  };

  const handleReplay = () => {
    void (async () => {
      await player.seekTo(0);
      player.play();
    })();
  };

  // didJustFinish は一瞬で消えるので、末尾で止まっている状態も「終了」として持続検知する
  const finished =
    status.didJustFinish ||
    (status.isLoaded &&
      !status.playing &&
      status.duration > 0 &&
      status.currentTime >= status.duration - 0.1);
  const loadFailed = hasRecording && (recordingUrl === undefined || (timedOut && !status.isLoaded));
  const loadingAudio = hasRecording && !loadFailed && !status.isLoaded;

  // 拡大ポラロイドの幅：横は余白を引いた全幅、縦はコントロール＋とじるが必ず入る上限
  const polaroidWidth = Math.min(width - spacing.xl * 2, height * 0.45);

  const fadeIn = !reduceMotion
    ? {
        animationName: { from: { opacity: 0 } },
        animationDuration: `${OPEN_MS}ms`,
        animationTimingFunction: 'ease-out' as const,
      }
    : null;
  const scaleIn = !reduceMotion
    ? {
        animationName: { from: { transform: [{ scale: 0.95 }] } },
        animationDuration: `${OPEN_MS}ms`,
        animationTimingFunction: 'ease-out' as const,
      }
    : null;

  return (
    <Animated.View style={[styles.overlay, fadeIn]}>
      {/* 背面タップでも閉じる（補助経路。主経路は最下部の「とじる」） */}
      <Pressable
        accessibilityLabel="とじる"
        accessibilityRole="button"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
      {/* box-none：すき間のタップは背面 Pressable へ通す */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl, paddingTop: insets.top + spacing.xl },
          scaleIn,
        ]}>
        <View pointerEvents="box-none" style={styles.body}>
          <View style={[styles.polaroid, { width: polaroidWidth }]}>
            <Image
              accessibilityLabel={`「${caption}」の写真（拡大）`}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri, cacheKey }}
              style={styles.photo}
              transition={150}
            />
            <View style={styles.captionBand}>
              <AppText numberOfLines={2} style={styles.caption} variant="cardTitle">
                {caption}
              </AppText>
            </View>
          </View>

          {hasRecording ? (
            <View style={styles.controls}>
              {offline ? (
                // オフラインは「失敗」ではないので赤くしない（チケット19。DESIGN §3）
                <AppCard style={styles.errorCard}>
                  <AppText>声は つながると 聞けます。</AppText>
                </AppCard>
              ) : loadFailed ? (
                <AppCard style={styles.errorCard}>
                  <AppText style={styles.errorText}>{LOAD_ERROR_MESSAGE}</AppText>
                  <SecondaryButton icon={RotateCcw} label="もういちどよみこむ" onPress={onRetry} />
                </AppCard>
              ) : loadingAudio ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.stageNavy} size="large" />
                  <AppText style={styles.loadingText} variant="caption">
                    声をじゅんびしています…
                  </AppText>
                </View>
              ) : (
                <>
                  {!finished ? (
                    <SecondaryButton
                      icon={status.playing ? Pause : Play}
                      label={status.playing ? '一時停止' : 'つづきを聞く'}
                      onPress={handleToggle}
                    />
                  ) : null}
                  <SecondaryButton icon={RotateCcw} label="もういちど聞く" onPress={handleReplay} />
                </>
              )}
            </View>
          ) : bodyText.trim() !== '' ? (
            <AppCard style={styles.textCard}>
              <ScrollView>
                <AppText>{bodyText}</AppText>
              </ScrollView>
            </AppCard>
          ) : null}
        </View>

        {reaction ? (
          <MitayoButton reacted={reaction.reacted} onPress={reaction.onReact} />
        ) : null}
        <SecondaryButton icon={X} label="とじる" onPress={onClose} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xxl,
    justifyContent: 'center',
    width: '100%',
  },
  caption: {
    textAlign: 'center',
  },
  captionBand: {
    justifyContent: 'center',
    minHeight: POLAROID_FRAME.bottom,
    paddingVertical: spacing.sm,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    gap: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  controls: {
    alignSelf: 'stretch',
    gap: spacing.md,
  },
  errorCard: {
    gap: spacing.md,
  },
  errorText: {
    color: colors.errorRed,
  },
  loading: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.stageNavy,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DIMMED_SKY,
    zIndex: 10,
  },
  photo: {
    aspectRatio: 1,
    backgroundColor: colors.skyBottom,
    width: '100%',
  },
  polaroid: {
    backgroundColor: colors.cardWhite,
    paddingHorizontal: POLAROID_FRAME.side,
    paddingTop: POLAROID_FRAME.top,
    ...shadows.lifted,
  },
  textCard: {
    alignSelf: 'stretch',
    flexShrink: 1,
  },
});
