/**
 * 写真ライトボックス（チケット15「写真が語る」。REQUIREMENTS §3.4② / DESIGN §7）。
 * 写真タップで拡大表示し、録音があれば本人の声を自動再生する（体験の核3）。
 *
 * 実装の判断：
 * - 背景は DIMMED_SKY＝skyTop 85% + stageNavy 15% の混色。DESIGN §7「背景色を少し濃くする」・
 *   §11-4「黒背景・夜の劇場化禁止」。app-card.tsx の PAPER_TINT と同じトークン由来混色方式
 * - 開き方は「幕が中央から左右へ広がり、その前で写真が上映される」（2026-08-15 ユーザー決定）。
 *   単なるフェードだと一瞬光るだけで劇場に見えなかった。**CSS アニメには animationFillMode:
 *   'backwards' を必ず付ける**：既定の 'none' はアニメ登録前の1フレームを「終わりの姿」で
 *   描くため、全面の幕がその1フレームだけ出て光る（実機で確認。curtain-overlay.tsx の
 *   「base style は終わりの姿」の流儀は、この点だけ補う必要がある）
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
 * - 拡大表示は写真を切り抜かず、実際の縦横比で全体を見せる（2026-08-15 ユーザー決定。
 *   正方形 cover だと縦写真の頭と足が切れる）。比率は onLoad で実画像から得るまで正方形で仮置き
 *   ＝タップ元のボード（正方形のまま維持）と同じ絵から滑らかに広がる。web/components/polaroid.tsx
 *   の lightbox variant と方針を一致させること
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

/** skyTop(#FFD6E8) 85% + stageNavy(#2B3A55) 15% の混色（DESIGN §7「背景色を少し濃くする」） */
export const DIMMED_SKY = '#DFBFD2';
/** 幕が中央から左右へ広がりきるまで。基準の 200ms より長め＝動きが「広がる」と読める最短 */
const CURTAIN_SPREAD_MS = 320;
/** 写真が現れるまでの待ち。幕が8割ほど開いたところで出す */
const CONTENT_DELAY_MS = 140;
/** 写真がすっと立ち上がる所要（DESIGN §8 の基準 200ms） */
const CONTENT_RISE_MS = 200;
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
  /** 写真の実比率（幅÷高さ）。onLoad まで null＝正方形で仮置き。photo.id を key に開き直すのでリセット不要 */
  const [photoRatio, setPhotoRatio] = useState<number | null>(null);
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

  // 拡大ポラロイドの寸法：写真の実比率を保ったまま「画面幅いっぱい」と
  // 「コントロール＋とじるが必ず入る高さ（画面の45%）」の両方に収める
  const ratio = photoRatio ?? 1;
  const maxPhotoWidth = width - spacing.xl * 2 - POLAROID_FRAME.side * 2;
  const maxPhotoHeight = height * 0.45;
  const photoWidth = Math.min(maxPhotoWidth, maxPhotoHeight * ratio);
  const polaroidWidth = photoWidth + POLAROID_FRAME.side * 2;

  // 幕が中央から左右へ広がって、その前で写真が上映される（DESIGN §7）。
  // animationFillMode: 'backwards' が要（既定の 'none' だと、アニメ登録前の1フレームだけ
  // 「終わりの姿」＝全面の幕がそのまま描かれ、パッと光って見える。実機で確認した不具合）
  const curtainOpen = !reduceMotion
    ? {
        animationName: { from: { transform: [{ scaleX: 0 }] } },
        animationDuration: `${CURTAIN_SPREAD_MS}ms`,
        animationTimingFunction: 'ease-out' as const,
        animationFillMode: 'backwards' as const,
      }
    : null;
  // 幕が広がりきるころに写真が現れる（同時だと幕の動きが読めない）
  const riseIn = !reduceMotion
    ? {
        animationName: { from: { opacity: 0, transform: [{ translateY: 12 }] } },
        animationDuration: `${CONTENT_RISE_MS}ms`,
        animationDelay: `${CONTENT_DELAY_MS}ms`,
        animationTimingFunction: 'ease-out' as const,
        animationFillMode: 'backwards' as const,
      }
    : null;

  return (
    <View style={styles.overlay}>
      {/* 幕。中央から左右へ広がる（transform の原点は既定で中央） */}
      <Animated.View pointerEvents="none" style={[styles.veil, curtainOpen]} />
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
          riseIn,
        ]}>
        <View pointerEvents="box-none" style={styles.body}>
          <View style={[styles.polaroid, { width: polaroidWidth }]}>
            <Image
              accessibilityLabel={`「${caption}」の写真（拡大）`}
              cachePolicy="memory-disk"
              contentFit="cover"
              source={{ uri, cacheKey }}
              style={[styles.photo, { aspectRatio: ratio }]}
              // フェードインさせない：同じ cacheKey の絵をボードで既に出しているので
              // キャッシュから即座に描ける。150ms かけると下地が透けて光って見えた
              transition={0}
              onLoad={(event) => {
                // 実画像の寸法で枠を写真の比率に合わせる（cover なので枠＝比率なら切れない）
                if (event.source.width > 0 && event.source.height > 0) {
                  setPhotoRatio(event.source.width / event.source.height);
                }
              }}
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
    </View>
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
    zIndex: 10,
  },
  photo: {
    // aspectRatio は写真の実比率を render 側でインライン指定する（切り抜き禁止）
    // 地はポラロイドの白フチと同色。読み込みの一瞬に別の色が覗くと光ったように見える
    backgroundColor: colors.cardWhite,
    width: '100%',
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DIMMED_SKY,
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
