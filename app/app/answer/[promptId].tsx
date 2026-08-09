/**
 * 回答画面（チケット06：テキスト回答の作成・編集）。
 * promptId は '1'〜'10'（固定お題）または 'free'（自由お題・1枠のみ）。
 *
 * 保存のきまり：
 * - 既存回答あり → id で UPDATE／なし → INSERT
 *   （upsert は使わない：自由お題の unique が部分インデックスで onConflict 指定できない）
 * - 本文を空にして保存 → 行を DELETE（済スタンプ・進捗が戻る。空の「済」を作らない）。
 *   ただし写真・録音（チケット09/10）がぶら下がっていたら CASCADE で消えてしまうため、
 *   付属物の有無を確認し、あれば行を残して本文だけ空にする
 * - 保存成功の判定・遷移は保存処理の戻り値で行う（チケット04の教訓：state を読まない）
 *
 * 音声入力の切替ボタンはチケット10まで無効表示。写真枠はポラロイド型の空枠のみ（チケット09）。
 */
import { usePreventRemove } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Check, Keyboard, Mic } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { PrimaryButton } from '@/components/primary-button';
import { SkyBackground } from '@/components/sky-background';
import { TAP_TARGET_MIN, colors, fonts, fontSizes, radii, shadows, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { usePrompts } from '@/lib/use-prompts';

const SAVE_ERROR_MESSAGE =
  'ほぞんできませんでした。インターネットに つながっているか たしかめて、もういちど ためしてください。';
/** スタンプを見せてから戻るまでの時間（表示250ms＋余韻） */
const STAMP_DWELL_MS = 950;
const CUSTOM_TITLE_MAX = 30;

type SaveResult = { ok: boolean; message?: string };

export default function AnswerScreen() {
  const { promptId } = useLocalSearchParams<{ promptId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const reduceMotion = useReducedMotion();
  const { subject } = useAuth();
  const { items, freeAnswer, loading, error, refetch } = usePrompts();

  const isFree = promptId === 'free';
  const fixedItem = items.find(({ prompt }) => String(prompt.id) === promptId);
  const existingAnswer = isFree ? freeAnswer : (fixedItem?.answer ?? null);
  const title = isFree ? 'じぶんのお題' : fixedItem?.prompt.title;

  const [bodyText, setBodyText] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showStamp, setShowStamp] = useState(false);

  const initialBodyRef = useRef('');
  const initialTitleRef = useRef('');
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // プレフィルは読み込み完了時に一度だけ（編集中の再取得で入力を上書きしない）
  useEffect(() => {
    if (loading || initialized) {
      return;
    }
    const body = existingAnswer?.body_text ?? '';
    const freeTitle = existingAnswer?.custom_title ?? '';
    initialBodyRef.current = body;
    initialTitleRef.current = freeTitle;
    setBodyText(body);
    setCustomTitle(freeTitle);
    setInitialized(true);
  }, [loading, initialized, existingAnswer]);

  useEffect(() => {
    return () => {
      if (backTimerRef.current) {
        clearTimeout(backTimerRef.current);
      }
    };
  }, []);

  const dirty =
    initialized &&
    !showStamp &&
    (bodyText !== initialBodyRef.current || (isFree && customTitle !== initialTitleRef.current));

  // 書きかけ保護：未保存の変更があるときだけ「もどる」を差し止めて確認する
  usePreventRemove(dirty, ({ data }) => {
    Alert.alert('かきかけの ぶんしょうが ほぞんされていません', 'もどると きえてしまいます。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: 'ほぞんしないで もどる',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const trimmedBody = bodyText.trim();
  const trimmedTitle = customTitle.trim();
  // 新規で本文が空なら保存するものが無い。自由お題の新規はタイトルも必要
  const canSave =
    !busy &&
    initialized &&
    (existingAnswer !== null || trimmedBody.length > 0) &&
    (!isFree || trimmedTitle.length > 0 || (existingAnswer !== null && trimmedBody.length === 0));

  const saveAnswer = async (): Promise<SaveResult> => {
    if (!subject) {
      return { ok: false, message: SAVE_ERROR_MESSAGE };
    }

    // 本文を空にした場合：付属物（写真・録音）が無ければ行ごと削除、あれば本文だけ空に
    if (existingAnswer && trimmedBody.length === 0) {
      const [photosResult, recordingsResult] = await Promise.all([
        supabase
          .from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('answer_id', existingAnswer.id),
        supabase
          .from('recordings')
          .select('id', { count: 'exact', head: true })
          .eq('answer_id', existingAnswer.id),
      ]);
      // 件数確認に失敗したときは消さない側に倒す（写真・録音の巻き添え削除を防ぐ）
      const attachmentCount =
        photosResult.error || recordingsResult.error
          ? 1
          : (photosResult.count ?? 0) + (recordingsResult.count ?? 0);

      if (attachmentCount === 0) {
        const { error: deleteError } = await supabase
          .from('answers')
          .delete()
          .eq('id', existingAnswer.id);
        return deleteError ? { ok: false, message: SAVE_ERROR_MESSAGE } : { ok: true };
      }
      const { error: updateError } = await supabase
        .from('answers')
        .update({ body_text: '' })
        .eq('id', existingAnswer.id);
      return updateError ? { ok: false, message: SAVE_ERROR_MESSAGE } : { ok: true };
    }

    if (existingAnswer) {
      const { error: updateError } = await supabase
        .from('answers')
        .update({
          body_text: trimmedBody,
          ...(isFree ? { custom_title: trimmedTitle } : {}),
        })
        .eq('id', existingAnswer.id);
      return updateError ? { ok: false, message: SAVE_ERROR_MESSAGE } : { ok: true };
    }

    const { error: insertError } = await supabase.from('answers').insert({
      subject_id: subject.id,
      prompt_id: isFree ? null : Number(promptId),
      custom_title: isFree ? trimmedTitle : null,
      body_text: trimmedBody,
    });
    return insertError ? { ok: false, message: SAVE_ERROR_MESSAGE } : { ok: true };
  };

  const handleSave = async () => {
    setBusy(true);
    setSaveError(null);
    const result = await saveAnswer();
    if (!result.ok) {
      setBusy(false);
      setSaveError(result.message ?? SAVE_ERROR_MESSAGE);
      return;
    }
    // 保存済み＝もう差分は無いので、書きかけ保護を解いてからスタンプ→もどる
    initialBodyRef.current = trimmedBody.length === 0 ? '' : trimmedBody;
    initialTitleRef.current = trimmedTitle;
    setBodyText(initialBodyRef.current);
    setCustomTitle(initialTitleRef.current);
    void refetch();
    setShowStamp(true);
    setBusy(false);
    backTimerRef.current = setTimeout(() => router.back(), STAMP_DWELL_MS);
  };

  // お題の読み込み自体に失敗（通信など）：入力させる前にリトライへ誘導する
  if (!loading && error) {
    return (
      <SkyBackground>
        <View style={styles.content}>
          <BackButton />
          <AppCard style={styles.gapCard}>
            <AppText variant="cardTitle">よみこめませんでした</AppText>
            <AppText>{error}</AppText>
            <PrimaryButton label="もういちど よみこむ" onPress={() => void refetch()} />
          </AppCard>
        </View>
      </SkyBackground>
    );
  }

  if (!loading && !isFree && !fixedItem) {
    return (
      <SkyBackground>
        <View style={styles.content}>
          <BackButton />
          <AppCard style={styles.gapCard}>
            <AppText variant="cardTitle">このお題は 見つかりませんでした</AppText>
            <AppText>「もどる」から お題の いちらんへ おもどりください。</AppText>
          </AppCard>
        </View>
      </SkyBackground>
    );
  }

  return (
    <SkyBackground>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton />

        {loading ? (
          <ActivityIndicator color={colors.curtainRed} size="large" />
        ) : (
          <>
            {/* お題タイトルは舞台の題字のように大きく（DESIGN §7） */}
            <AppText variant="screenTitle" style={styles.title}>
              {isFree && trimmedTitle ? trimmedTitle : title}
            </AppText>

            {/* テキスト⇄音声の大きな2ボタン。音声はチケット10まで準備中 */}
            <View style={styles.modeRow}>
              <View style={[styles.modeButton, styles.modeButtonActive]}>
                <Keyboard color={colors.cardWhite} size={22} strokeWidth={2} />
                <AppText variant="bodyMedium" style={styles.modeLabelActive}>
                  じぶんで かく
                </AppText>
              </View>
              <View style={[styles.modeButton, styles.modeButtonDisabled]}>
                <Mic color={colors.textSoft} size={22} strokeWidth={2} />
                <View>
                  <AppText variant="bodyMedium" style={styles.modeLabelDisabled}>
                    こえで はなす
                  </AppText>
                  <AppText variant="caption">じゅんびちゅう</AppText>
                </View>
              </View>
            </View>

            {isFree ? (
              <AppCard style={styles.gapCard}>
                <AppText variant="cardTitle">お題の なまえ</AppText>
                <TextInput
                  accessibilityLabel="お題のなまえ"
                  value={customTitle}
                  onChangeText={setCustomTitle}
                  placeholder="れい：わたしの たからもの"
                  placeholderTextColor={colors.textSoft}
                  maxLength={CUSTOM_TITLE_MAX}
                  style={styles.titleInput}
                />
              </AppCard>
            ) : null}

            <AppCard style={styles.gapCard}>
              <AppText variant="cardTitle">おはなしを どうぞ</AppText>
              <TextInput
                accessibilityLabel="回答の本文"
                value={bodyText}
                onChangeText={setBodyText}
                placeholder="おもいだしたことを じゆうに かいてください"
                placeholderTextColor={colors.textSoft}
                multiline
                textAlignVertical="top"
                style={styles.bodyInput}
              />
            </AppCard>

            {/* ポラロイド型の空枠（「ここに写真がのります」が形で分かる。機能はチケット09） */}
            <View style={styles.polaroid}>
              <View style={styles.polaroidInner}>
                <AppText variant="caption" style={styles.polaroidText}>
                  ここに 写真が のります{'\n'}（もうすこし あとで つかえます）
                </AppText>
              </View>
            </View>
          </>
        )}
        </ScrollView>

        {/* 保存はスクロールの外の固定フッターに置き、キーボードが出ても（adjustResize で）
            その真上に浮くようにする。キーボードを閉じずに1タップで保存できる（実機フィードバック反映） */}
        {!loading ? (
          <View style={styles.footer}>
            {saveError ? <AppText style={styles.footerError}>{saveError}</AppText> : null}
            <PrimaryButton
              icon={Check}
              label={busy ? 'ほぞんしています…' : 'ほぞんする'}
              onPress={() => void handleSave()}
              disabled={!canSave}
            />
          </View>
        ) : null}
      </View>

      {/* 保存成功のスタンプ（DESIGN §8。reduced-motion 時はアニメなしで表示のみ） */}
      {showStamp ? (
        <View pointerEvents="none" style={styles.stampOverlay}>
          <Animated.View
            style={[
              styles.stamp,
              !reduceMotion && {
                animationName: {
                  '0%': { opacity: 0, transform: [{ scale: 1.6 }, { rotate: '-8deg' }] },
                  '100%': { opacity: 1, transform: [{ scale: 1 }, { rotate: '-8deg' }] },
                },
                animationDuration: '250ms',
                animationTimingFunction: 'ease-out',
              },
            ]}>
            <AppText variant="cardTitle" style={styles.stampText}>
              ほぞん{'\n'}しました
            </AppText>
          </Animated.View>
        </View>
      ) : null}
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  footer: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  footerError: {
    color: colors.errorRed,
  },
  title: {
    textAlign: 'center',
  },
  gapCard: {
    gap: spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: radii.button,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: TAP_TARGET_MIN,
    // 文字がボタンの縁に触れないよう左右にゆとりを持たせる（実機フィードバック反映）
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  modeButtonActive: {
    backgroundColor: colors.stageNavy,
    ...shadows.raised,
  },
  modeButtonDisabled: {
    backgroundColor: colors.cardWhite,
    opacity: 0.6,
    ...shadows.rest,
  },
  modeLabelActive: {
    color: colors.cardWhite,
  },
  modeLabelDisabled: {
    color: colors.textSoft,
  },
  titleInput: {
    borderColor: colors.textSoft,
    borderRadius: radii.button,
    borderWidth: 1,
    color: colors.stageNavy,
    fontFamily: fonts.body,
    fontSize: fontSizes.cardTitle,
    minHeight: TAP_TARGET_MIN,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bodyInput: {
    borderColor: colors.textSoft,
    borderRadius: radii.button,
    borderWidth: 1,
    color: colors.stageNavy,
    fontFamily: fonts.body,
    fontSize: fontSizes.body,
    // lineHeight は指定しない：Android はカーソルが行の高さいっぱいに描かれるため、
    // 1.7倍にすると文字よりカーソルが大きく見えて戸惑わせる（実機フィードバック反映）。
    // 読み物としての行間1.7は表示側（一覧プレビュー・じぶん史）で使う
    minHeight: 200,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  // ポラロイドの白フチ：左右上8・下28（DESIGN §5）。±3°以内の傾きで「置いてある」感
  polaroid: {
    alignSelf: 'center',
    backgroundColor: colors.cardWhite,
    paddingBottom: 28,
    paddingHorizontal: 8,
    paddingTop: 8,
    transform: [{ rotate: '-2deg' }],
    width: '70%',
    ...shadows.rest,
  },
  polaroidInner: {
    alignItems: 'center',
    aspectRatio: 1,
    borderColor: colors.textSoft,
    borderRadius: 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  polaroidText: {
    textAlign: 'center',
  },
  errorTitle: {
    color: colors.errorRed,
  },
  stampOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stamp: {
    alignItems: 'center',
    backgroundColor: colors.cardWhite,
    borderColor: colors.spotYellow,
    borderRadius: 70,
    borderWidth: 4,
    height: 140,
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
    width: 140,
    ...shadows.lifted,
  },
  stampText: {
    color: colors.spotYellow,
    textAlign: 'center',
  },
});
