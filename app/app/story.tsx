/**
 * じぶん史（チケット12：生成・閲覧・編集・再生成）。
 * この画面だけ背景を生成りの紙質（story-paper）にし、本文を Shippori Mincho にする
 * （DESIGN.md §4「一冊の本」の空気）。幕演出（CurtainOverlay）を使ってよい唯一の場面（同 §7）。
 *
 * 生成のきまり：
 * - 回答カードの本文は書き換えない。生成されるのは独立した life_story 1本のみ（REQUIREMENTS §3.3）
 * - worker へ送るのは body_text が空でない回答だけ（写真・声だけの回答は対象外。docs/11 申し送り）
 * - 幕は「閉じる → じゅんびちゅう… → 開くと本文」。レート制限 429 は幕が閉じ切る前（<1秒）に
 *   返ることがあるため、開幕は必ず閉幕完了の Promise を await してから始める（state で判定しない）
 * - 生成成功後の保存失敗では本文を捨てない：生成は今日の1回分を消費済みなので、
 *   unsavedBody に保持して表示し、保存だけをやり直せるようにする
 * - 再生成の上書き確認ダイアログは edited_by_user のときだけ（REQUIREMENTS「編集後の再生成時は」）
 * - 保存成功の判定・遷移は保存処理の戻り値で行う（チケット04の教訓：state を読まない）
 */
import { usePreventRemove } from '@react-navigation/native';
import { useNavigation } from 'expo-router';
import { Check, Pencil, RotateCcw, ScrollText } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import {
  CURTAIN_CLOSE_MS,
  CURTAIN_OPEN_MS,
  CurtainOverlay,
  type CurtainPhase,
} from '@/components/curtain-overlay';
import { OfflineNote } from '@/components/offline-note';
import { PrimaryButton } from '@/components/primary-button';
import { SecondaryButton } from '@/components/secondary-button';
import { colors, fonts, fontSizes, radii, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';
import { buildLifeStoryAnswers, saveLifeStory, saveManualEdit } from '@/lib/life-story';
import { useIsOnline } from '@/lib/use-online';
import { useLifeStory } from '@/lib/use-life-story';
import { usePrompts } from '@/lib/use-prompts';
import { WorkerApiError, generateLifeStory } from '@/lib/worker-api';

const GENERATE_ERROR_MESSAGE = 'つくれませんでした。電波のよいところで、もういちどためしてください。';

function formatJaDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function StoryScreen() {
  const navigation = useNavigation();
  const reduceMotion = useReducedMotion();
  const { subject } = useAuth();
  const isOnline = useIsOnline();
  const {
    items,
    freeAnswer,
    loading: promptsLoading,
    error: promptsError,
    refetch: refetchPrompts,
  } = usePrompts();
  const {
    story,
    loading: storyLoading,
    error: storyError,
    refetch: refetchStory,
  } = useLifeStory();

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  // 幕のフェーズ。null 以外＝生成中（幕が出ている）
  const [genPhase, setGenPhase] = useState<CurtainPhase | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  // 直近の生成で返った「今日あと何回つくれるか」。生成するまでは出さない
  const [remaining, setRemaining] = useState<number | null>(null);
  // 生成は成功したが DB 保存に失敗した本文（1回分消費済みなので捨てない）
  const [unsavedBody, setUnsavedBody] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editInitialRef = useRef('');
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current);
      }
    };
  }, []);

  const usableAnswers = buildLifeStoryAnswers(items, freeAnswer);
  const generating = genPhase !== null;
  const editDirty = mode === 'edit' && draft !== editInitialRef.current;
  const trimmedDraft = draft.trim();
  // 未保存の生成本文があれば、保存済みの本文より優先して見せる
  const bodyToShow = unsavedBody ?? story?.body_text ?? null;
  const loading = storyLoading || promptsLoading;
  const loadError = storyError ?? promptsError;

  // 離脱ガード：生成中・編集の書きかけ・未保存の生成本文があるときは「もどる」を差し止める
  usePreventRemove(generating || editDirty || unsavedBody !== null, ({ data }) => {
    if (generating) {
      Alert.alert('じぶん史をつくっています', 'できあがるまで少しおまちください。', [
        { text: 'わかりました', style: 'cancel' },
      ]);
      return;
    }
    if (unsavedBody !== null && mode === 'view') {
      Alert.alert('できあがったじぶん史がほぞんされていません', 'もどると消えてしまいます。', [
        { text: 'やめる', style: 'cancel' },
        {
          text: 'ほぞんしないで もどる',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ]);
      return;
    }
    Alert.alert('書きなおした文章がほぞんされていません', 'もどると消えてしまいます。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: 'ほぞんしないで もどる',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const handleGenerate = async () => {
    if (!subject || generating || busy || usableAnswers.length === 0) {
      return;
    }
    setGenError(null);
    setSaveWarning(null);
    setUnsavedBody(null);

    // reduced-motion 時はスライドさせず、閉じた幕を即出して即しまう
    const closeMs = reduceMotion ? 0 : CURTAIN_CLOSE_MS;
    const openMs = reduceMotion ? 0 : CURTAIN_OPEN_MS;
    setGenPhase(closeMs === 0 ? 'closed' : 'closing');
    // 幕が閉じ切る前に結果が返ることがある（レート制限は即時 429）。
    // 開幕は必ず閉幕の完了を待ってから（順序は state ではなく Promise で保証する）
    const closeDone = new Promise<void>((resolve) => {
      closeTimerRef.current = setTimeout(() => {
        setGenPhase('closed');
        resolve();
      }, closeMs);
    });

    let generated: { bodyText: string; remaining: number } | null = null;
    let failureMessage: string | null = null;
    try {
      generated = await generateLifeStory(usableAnswers);
    } catch (error) {
      failureMessage = error instanceof WorkerApiError ? error.message : GENERATE_ERROR_MESSAGE;
      // レート制限で断られた＝今日の残りは0。ボタンの回数表示にも反映する
      if (error instanceof WorkerApiError && error.code === 'rate_limited') {
        setRemaining(0);
      }
    }

    if (generated) {
      setRemaining(generated.remaining);
      const saved = await saveLifeStory(subject.id, generated.bodyText);
      if (saved.ok) {
        await refetchStory();
      } else {
        setUnsavedBody(generated.bodyText);
        setSaveWarning(saved.message ?? null);
      }
    } else {
      setGenError(failureMessage);
    }

    // 幕を開けたときには結果（本文またはエラーカード）が描画済みになっている
    await closeDone;
    if (openMs === 0) {
      setGenPhase(null);
      return;
    }
    setGenPhase('opening');
    openTimerRef.current = setTimeout(() => setGenPhase(null), openMs);
  };

  const handleRegenerate = () => {
    if (story?.edited_by_user) {
      Alert.alert('つくりなおしますか？', '書きなおした文章は消えて、あたらしい文章に置きかわります。', [
        { text: 'やめる', style: 'cancel' },
        { text: 'つくりなおす', style: 'destructive', onPress: () => void handleGenerate() },
      ]);
      return;
    }
    void handleGenerate();
  };

  const handleRetrySave = async () => {
    if (!subject || unsavedBody === null || busy) {
      return;
    }
    setBusy(true);
    const saved = await saveLifeStory(subject.id, unsavedBody);
    setBusy(false);
    if (saved.ok) {
      setUnsavedBody(null);
      setSaveWarning(null);
      await refetchStory();
    } else {
      setSaveWarning(saved.message ?? null);
    }
  };

  const startEdit = () => {
    if (!story) {
      return;
    }
    editInitialRef.current = story.body_text;
    setDraft(story.body_text);
    setEditError(null);
    setMode('edit');
  };

  const handleSaveEdit = async () => {
    if (!story || busy || trimmedDraft === '') {
      return;
    }
    setBusy(true);
    setEditError(null);
    const saved = await saveManualEdit(story.id, trimmedDraft);
    if (!saved.ok) {
      setBusy(false);
      setEditError(saved.message ?? null);
      return;
    }
    await refetchStory();
    // 離脱ガードが誤発火しないよう、初期値を保存済みの内容へ揃えてから閲覧に戻る
    editInitialRef.current = draft;
    setBusy(false);
    setMode('view');
  };

  const handleCancelEdit = () => {
    if (draft !== editInitialRef.current) {
      Alert.alert('書きなおした文章がほぞんされていません', 'やめると消えてしまいます。', [
        { text: 'かきつづける', style: 'cancel' },
        { text: 'ほぞんしないでやめる', style: 'destructive', onPress: () => setMode('view') },
      ]);
      return;
    }
    setMode('view');
  };

  return (
    // じぶん史は全画面共通の空グラデではなく紙色ベタ（DESIGN.md §4 の例外指定）
    <View style={styles.paper}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        {mode === 'edit' ? (
          <View style={styles.safeArea}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled">
              <BackButton />
              <AppText variant="screenTitle">じぶん史</AppText>
              <AppCard style={styles.gapCard}>
                <AppText variant="cardTitle">じぶんの言葉で書きなおせます</AppText>
                <TextInput
                  accessibilityLabel="じぶん史の本文"
                  multiline
                  onChangeText={setDraft}
                  style={styles.editInput}
                  textAlignVertical="top"
                  value={draft}
                />
              </AppCard>
            </ScrollView>
            {/* 保存はスクロール外の固定フッター（answer 画面と同じ。キーボードの真上に浮く） */}
            <View style={styles.footer}>
              {editError ? <AppText style={styles.footerError}>{editError}</AppText> : null}
              {trimmedDraft === '' ? (
                <AppText style={styles.footerError}>からっぽではほぞんできません</AppText>
              ) : null}
              <PrimaryButton
                icon={Check}
                label={busy ? 'ほぞんしています…' : 'ほぞんする'}
                onPress={() => void handleSaveEdit()}
                disabled={busy || trimmedDraft === '' || !isOnline}
              />
              <SecondaryButton label="やめる" onPress={handleCancelEdit} disabled={busy} />
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <BackButton />
            <AppText variant="screenTitle">じぶん史</AppText>

            {!isOnline ? <OfflineNote detail="じぶん史づくりは つながってから できます。" /> : null}

            {loading ? <ActivityIndicator color={colors.curtainRed} size="large" /> : null}

            {!loading && loadError && bodyToShow === null ? (
              <AppCard style={styles.gapCard}>
                <AppText variant="cardTitle" style={styles.errorTitle}>
                  よみこめませんでした
                </AppText>
                <AppText>{loadError}</AppText>
                <PrimaryButton
                  label="もういちどよみこむ"
                  onPress={() => {
                    void refetchStory();
                    void refetchPrompts();
                  }}
                />
              </AppCard>
            ) : null}

            {genError ? (
              <AppCard style={styles.gapCard}>
                <AppText variant="cardTitle" style={styles.errorTitle}>
                  つくれませんでした
                </AppText>
                <AppText>{genError}</AppText>
              </AppCard>
            ) : null}

            {unsavedBody !== null ? (
              <AppCard style={styles.gapCard}>
                <AppText variant="cardTitle" style={styles.errorTitle}>
                  まだほぞんできていません
                </AppText>
                {saveWarning ? <AppText>{saveWarning}</AppText> : null}
                <PrimaryButton
                  label={busy ? 'ほぞんしています…' : 'もういちど保存する'}
                  onPress={() => void handleRetrySave()}
                  disabled={busy}
                />
              </AppCard>
            ) : null}

            {bodyToShow !== null ? (
              <>
                {story && unsavedBody === null ? (
                  <AppText variant="caption" style={styles.dateCaption}>
                    {formatJaDate(story.generated_at)}につくりました
                    {story.edited_by_user ? '（じぶんで書きなおしました）' : ''}
                  </AppText>
                ) : null}
                <AppText variant="story">{bodyToShow}</AppText>
                {unsavedBody === null && story ? (
                  <View style={styles.actions}>
                    <SecondaryButton
                      icon={Pencil}
                      label="書きなおす"
                      onPress={startEdit}
                      disabled={generating || !isOnline}
                    />
                    {/* 残り回数はボタン自体に出す（実機フィードバック反映）。
                        worker が生成応答で返す値なので、この画面で一度つくる（または
                        レート制限に当たる）までは分からず、その間は素のラベルにする */}
                    <SecondaryButton
                      icon={RotateCcw}
                      label={
                        remaining !== null
                          ? `もういちどつくる（あと${remaining}回）`
                          : 'もういちどつくる'
                      }
                      onPress={handleRegenerate}
                      disabled={generating || usableAnswers.length === 0 || remaining === 0 || !isOnline}
                    />
                    {remaining === 0 ? (
                      <AppText variant="caption" style={styles.dateCaption}>
                        今日つくれる回数はこれでおしまいです。また明日つくれます
                      </AppText>
                    ) : null}
                    {usableAnswers.length === 0 && !promptsLoading ? (
                      <AppText variant="caption" style={styles.dateCaption}>
                        {promptsError
                          ? '回答をよみこめなかったため、いまはつくりなおせません'
                          : '文字で書いた回答がないため、いまはつくりなおせません'}
                      </AppText>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : !loading && !loadError ? (
              usableAnswers.length === 0 ? (
                <AppCard style={styles.gapCard}>
                  <AppText variant="cardTitle">文字の回答がまだありません</AppText>
                  <AppText>
                    文字で書いた回答をもとにじぶん史をつくります。お題にもどって、文字でもこたえてみてください。
                  </AppText>
                </AppCard>
              ) : (
                <AppCard style={styles.gapCard}>
                  <AppText variant="cardTitle">あなたのじぶん史をつくれます</AppText>
                  <AppText>
                    これまでの回答をもとに、AIが1本の読み物にまとめます。回答カードの文章はそのまま残ります。
                  </AppText>
                  <AppText variant="caption" style={styles.dateCaption}>
                    できあがるまで30秒ほどかかります。1日に3回までつくれます。
                  </AppText>
                  <PrimaryButton
                    icon={ScrollText}
                    label="じぶん史をつくる"
                    onPress={() => void handleGenerate()}
                    disabled={generating || remaining === 0 || !isOnline}
                  />
                </AppCard>
              )
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* 幕は SafeArea の外＝ステータスバーまで含む全画面を覆う */}
      {genPhase !== null ? <CurtainOverlay phase={genPhase} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
  },
  content: {
    gap: spacing.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  dateCaption: {
    color: colors.textSoft,
  },
  editInput: {
    borderColor: colors.textSoft,
    borderRadius: radii.button,
    borderWidth: 1,
    color: colors.stageNavy,
    // 編集中も読み物の書体（明朝18px）。lineHeight は指定しない：Android はカーソルが
    // 行の高さいっぱいに描かれるため（answer 画面と同じ判断）。行間2.0は閲覧側だけ
    fontFamily: fonts.story,
    fontSize: fontSizes.storyBody,
    minHeight: 300,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  errorTitle: {
    color: colors.errorRed,
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
  gapCard: {
    gap: spacing.md,
  },
  paper: {
    backgroundColor: colors.storyPaper,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});
