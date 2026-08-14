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
 * 写真添付（チケット09）：
 * - photos 行には answers 行が必要（RLS）なので、回答が未保存のまま写真をのせたときは
 *   body_text '' の行を自動作成する（写真だけでも「回答済み」になる＝仕様どおり）
 * - 全滅・最後の1枚削除では cleanupEmptyAnswer で「空の済」を残さない（確認失敗時は消さない側に倒す）
 * - アップロードは PhotoStrip＋lib/photo-attach.ts。失敗分は署名URLを取り直してリトライ
 *
 * 録音（チケット10）：
 * - 「声で話す」モードは RecordingBox（録音 → プレビュー → のこす）。録音の保存順序は
 *   「R2 へ PUT → answers 行の用意 → recordings upsert」（空行が残る失敗経路を作らない）
 * - 録音中・プレビュー・声のアップロード中はモード切替と保存を無効にし、離脱もガードする
 * - 音声入力（テキスト化）はキーボードの音声認識に任せる（チケット22で確定）：録音が
 *   マイクを保持している間は端末の音声認識がマイクを取れず同時動作は不可（実機検証済み。
 *   docs/22）。録音とテキストは別モードのまま、テキスト側にマイクの案内だけを出す
 */
import { usePreventRemove } from '@react-navigation/native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Check, Keyboard, Mic } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { OfflineNote } from '@/components/offline-note';
import { PhotoStrip } from '@/components/photo-strip';
import { PrimaryButton } from '@/components/primary-button';
import { RecordingBox, type RecordingBoxPhase } from '@/components/recording-box';
import { SkyBackground } from '@/components/sky-background';
import { TAP_TARGET_MIN, colors, fonts, fontSizes, radii, shadows, spacing } from '@/constants/tokens';
import { showAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';
import {
  PHOTO_MAX_PER_ANSWER,
  compressPhoto,
  pickPhotos,
  uploadCompressedPhotos,
} from '@/lib/photo-attach';
import { deleteRecording } from '@/lib/recording-attach';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/lib/use-online';
import { usePhotos, type Photo } from '@/lib/use-photos';
import { useRecording, type Recording } from '@/lib/use-recording';
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
  // 写真・録音だけ先にのせたとき自動作成した answers 行の id（setState 直後に読まないよう state で持つ）
  const [createdAnswerId, setCreatedAnswerId] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // 入力モード。切替で bodyText は消えない（state のまま保持）。入場時の自動切替はしない
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  // RecordingBox の進行状態（離脱ガード・保存/モード切替の無効化に使う）
  const [recPhase, setRecPhase] = useState<RecordingBoxPhase>('idle');

  const initialBodyRef = useRef('');
  const initialTitleRef = useRef('');
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // アップロードに失敗した圧縮済みファイル（「もういちど のせる」で使う）
  const pendingUrisRef = useRef<string[]>([]);

  // 回答行の id。usePrompts の再取得が追いつく前でも createdAnswerId で写真を扱える
  const answerId = existingAnswer?.id ?? createdAnswerId;
  const {
    photos,
    viewUrls,
    loading: photosLoading,
    error: photosError,
    refetch: refetchPhotos,
  } = usePhotos(answerId);
  const {
    recording,
    viewUrl: recordingViewUrl,
    loading: recordingLoading,
    error: recordingError,
    refetch: refetchRecording,
  } = useRecording(answerId);

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

  const uploading = uploadState !== null;
  // 録音の進行中（録音・未保存プレビュー・アップロード）。この間はモード切替と保存を止める
  const recBusy = recPhase === 'recording' || recPhase === 'preview' || recPhase === 'uploading';

  // 書きかけ保護：未保存の変更・各アップロード・録音中は「もどる」を差し止める
  usePreventRemove(dirty || uploading || recBusy, ({ data }) => {
    if (recPhase === 'recording') {
      showAlert('録音しています', '「とめる」を おしてから おもどりください。', [
        { text: 'わかりました', style: 'cancel' },
      ]);
      return;
    }
    if (recPhase === 'uploading') {
      showAlert('声を のこしています', 'おわるまで すこし おまちください。', [
        { text: 'わかりました', style: 'cancel' },
      ]);
      return;
    }
    if (uploading) {
      showAlert('写真をのせています', 'おわるまで すこし おまちください。', [
        { text: 'わかりました', style: 'cancel' },
      ]);
      return;
    }
    if (recPhase === 'preview') {
      showAlert('ろくおんした声を まだ のこしていません', 'もどると きえてしまいます。', [
        { text: 'やめる', style: 'cancel' },
        {
          text: 'のこさないで もどる',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ]);
      return;
    }
    showAlert('かきかけの ぶんしょうが ほぞんされていません', 'もどると きえてしまいます。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: 'ほぞんしないで もどる',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const isOnline = useIsOnline();
  const trimmedBody = bodyText.trim();
  const trimmedTitle = customTitle.trim();
  // 新規で本文が空なら保存するものが無い。自由お題の新規はタイトルも必要
  const canSave =
    !busy &&
    !uploading &&
    !recBusy &&
    initialized &&
    (answerId !== null || trimmedBody.length > 0) &&
    (!isFree || trimmedTitle.length > 0 || (answerId !== null && trimmedBody.length === 0));

  /**
   * 自由お題は custom_title が必須（DB の CHECK）。行の自動作成が起きる操作
   * （写真をのせる・録音をはじめる・声をのこす）の前にタイトルを求める
   */
  const requireFreeTitle = (kind: 'photo' | 'voice'): boolean => {
    if (!isFree || answerId !== null || trimmedTitle.length > 0) {
      return true;
    }
    showAlert(
      'さきに お題のなまえを かいてください',
      kind === 'photo'
        ? 'いちばん上の「お題の なまえ」を うめると、写真をのせられます。'
        : 'いちばん上の「お題の なまえ」を うめると、声を のこせます。',
    );
    return false;
  };

  const saveAnswer = async (): Promise<SaveResult> => {
    if (!subject) {
      return { ok: false, message: SAVE_ERROR_MESSAGE };
    }

    // 本文を空にした場合：付属物（写真・録音）が無ければ行ごと削除、あれば本文だけ空に
    if (answerId && trimmedBody.length === 0) {
      const [photosResult, recordingsResult] = await Promise.all([
        supabase
          .from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('answer_id', answerId),
        supabase
          .from('recordings')
          .select('id', { count: 'exact', head: true })
          .eq('answer_id', answerId),
      ]);
      // 件数確認に失敗したときは消さない側に倒す（写真・録音の巻き添え削除を防ぐ）
      const attachmentCount =
        photosResult.error || recordingsResult.error
          ? 1
          : (photosResult.count ?? 0) + (recordingsResult.count ?? 0);

      if (attachmentCount === 0) {
        const { error: deleteError } = await supabase.from('answers').delete().eq('id', answerId);
        if (!deleteError) {
          setCreatedAnswerId(null);
        }
        return deleteError ? { ok: false, message: SAVE_ERROR_MESSAGE } : { ok: true };
      }
      const { error: updateError } = await supabase
        .from('answers')
        .update({ body_text: '' })
        .eq('id', answerId);
      return updateError ? { ok: false, message: SAVE_ERROR_MESSAGE } : { ok: true };
    }

    if (answerId) {
      const { error: updateError } = await supabase
        .from('answers')
        .update({
          body_text: trimmedBody,
          ...(isFree ? { custom_title: trimmedTitle } : {}),
        })
        .eq('id', answerId);
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

  /**
   * 写真をのせる前に answers 行を用意する（photos の RLS は answer_id 必須）。
   * 自由お題のタイトルはここで確定・保存されるので initialTitleRef も同期する
   */
  const ensureAnswerId = async (): Promise<
    { ok: true; answerId: string } | { ok: false; message: string }
  > => {
    if (answerId) {
      return { ok: true, answerId };
    }
    if (!subject) {
      return { ok: false, message: SAVE_ERROR_MESSAGE };
    }
    const { data, error: insertError } = await supabase
      .from('answers')
      .insert({
        subject_id: subject.id,
        prompt_id: isFree ? null : Number(promptId),
        custom_title: isFree ? trimmedTitle : null,
        body_text: '',
      })
      .select('id')
      .single();
    if (insertError || !data) {
      return { ok: false, message: SAVE_ERROR_MESSAGE };
    }
    setCreatedAnswerId(data.id);
    if (isFree) {
      initialTitleRef.current = trimmedTitle;
      setCustomTitle(trimmedTitle);
    }
    void refetch();
    return { ok: true, answerId: data.id };
  };

  /**
   * 「空の済」を残さない後始末。DB 上で本文空・写真0・録音0のときだけ行を消す。
   * 確認に失敗したときは消さない側に倒す（保存済み内容の巻き添え削除を防ぐ）
   */
  const cleanupEmptyAnswer = async (targetAnswerId: string) => {
    const [answerResult, photosResult, recordingsResult] = await Promise.all([
      supabase.from('answers').select('body_text').eq('id', targetAnswerId).single(),
      supabase
        .from('photos')
        .select('id', { count: 'exact', head: true })
        .eq('answer_id', targetAnswerId),
      supabase
        .from('recordings')
        .select('id', { count: 'exact', head: true })
        .eq('answer_id', targetAnswerId),
    ]);
    if (answerResult.error || photosResult.error || recordingsResult.error) {
      return;
    }
    if (
      answerResult.data.body_text !== '' ||
      (photosResult.count ?? 0) > 0 ||
      (recordingsResult.count ?? 0) > 0
    ) {
      return;
    }
    const { error: deleteError } = await supabase.from('answers').delete().eq('id', targetAnswerId);
    if (!deleteError) {
      setCreatedAnswerId(null);
      void refetch();
    }
  };

  /** 圧縮済み uri 群をアップロードして photos 行を作る（初回・リトライ共通） */
  const runUpload = async (targetAnswerId: string, uris: string[]) => {
    setUploadError(null);
    setUploadState({ done: 0, total: uris.length });
    const outcome = await uploadCompressedPhotos(targetAnswerId, uris, (done, total) =>
      setUploadState({ done, total }),
    );
    setUploadState(null);
    // 行を作った直後は refetchPhotos の closure が古い answerId(null) を見ているため id を明示的に渡す
    await refetchPhotos(targetAnswerId);
    if (outcome.failedUris.length > 0) {
      pendingUrisRef.current = outcome.failedUris;
      setUploadError(outcome.errorMessage ?? SAVE_ERROR_MESSAGE);
      if (outcome.uploadedCount === 0) {
        // 1枚ものせられなかったとき、写真のために自動作成した行が空のままなら回収する
        void cleanupEmptyAnswer(targetAnswerId);
      }
      return;
    }
    pendingUrisRef.current = [];
    void refetch();
  };

  const handleAddPhotos = async () => {
    if (busy || uploading || recPhase === 'recording' || recPhase === 'uploading') {
      return;
    }
    if (!requireFreeTitle('photo')) {
      return;
    }
    const remaining = PHOTO_MAX_PER_ANSWER - photos.length;
    if (remaining <= 0) {
      return;
    }
    const picked = await pickPhotos(remaining);
    if (!picked || picked.length === 0) {
      return;
    }
    setUploadError(null);
    setUploadState({ done: 0, total: picked.length });
    const uris: string[] = [];
    try {
      for (const photo of picked) {
        uris.push((await compressPhoto(photo)).uri);
      }
    } catch {
      setUploadState(null);
      setUploadError('写真を よみこめませんでした。ちがう写真で ためしてください。');
      return;
    }
    const ensured = await ensureAnswerId();
    if (!ensured.ok) {
      setUploadState(null);
      setUploadError(ensured.message);
      return;
    }
    await runUpload(ensured.answerId, uris);
  };

  const handleRetryUpload = async () => {
    if (!answerId || uploading || pendingUrisRef.current.length === 0) {
      return;
    }
    await runUpload(answerId, pendingUrisRef.current);
  };

  const handleDeletePhoto = (photo: Photo) => {
    if (busy || uploading || recPhase === 'recording' || recPhase === 'uploading') {
      return;
    }
    // 破壊的操作は必ず確認ダイアログ（REQUIREMENTS §4.1）
    showAlert('この写真を けしますか？', 'けした写真は もどせません。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: 'けす',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const { error: deleteError } = await supabase
              .from('photos')
              .delete()
              .eq('id', photo.id);
            if (deleteError) {
              showAlert(
                'けせませんでした',
                'でんぱの よいところで もういちど ためしてください。',
              );
              return;
            }
            await refetchPhotos();
            // 最後の1枚を消して本文も空なら「空の済」を残さない
            if (answerId) {
              await cleanupEmptyAnswer(answerId);
            }
            void refetch();
          })();
        },
      },
    ]);
  };

  /** 録音の保存成功。RecordingBox が await するので、作りたての id で refetch を終えてから返す */
  const handleRecordingSaved = async (savedAnswerId: string) => {
    await refetchRecording(savedAnswerId);
    void refetch();
  };

  const handleDeleteRecording = (target: Recording) => {
    if (busy || uploading || recBusy) {
      return;
    }
    // 破壊的操作は必ず確認ダイアログ（REQUIREMENTS §4.1）
    showAlert('この声を けしますか？', 'けした声は もどせません。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: 'けす',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const deleted = await deleteRecording(target.id);
            if (!deleted) {
              showAlert(
                'けせませんでした',
                'でんぱの よいところで もういちど ためしてください。',
              );
              return;
            }
            await refetchRecording();
            // 録音だけの回答だったら「空の済」を残さない（済スタンプが戻る）
            if (answerId) {
              await cleanupEmptyAnswer(answerId);
            }
            void refetch();
          })();
        },
      },
    ]);
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

            {!isOnline ? <OfflineNote detail="ほぞんは つながってから できます。" /> : null}

            {/* テキスト⇄音声の大きな2ボタン（DESIGN §7）。録音の進行中は切り替えない
                （未保存のテイクが RecordingBox のアンマウントで消えるのを防ぐ） */}
            <View style={styles.modeRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'text' }}
                disabled={busy || uploading || recBusy}
                onPress={() => setMode('text')}
                style={({ pressed }) => [
                  styles.modeButton,
                  mode === 'text' ? styles.modeButtonActive : styles.modeButtonInactive,
                  pressed && styles.modePressed,
                ]}>
                <Keyboard
                  color={mode === 'text' ? colors.cardWhite : colors.stageNavy}
                  size={22}
                  strokeWidth={2}
                />
                <AppText
                  variant="bodyMedium"
                  style={mode === 'text' ? styles.modeLabelActive : styles.modeLabelInactive}>
                  自分でかく
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'voice' }}
                disabled={busy || uploading || recBusy}
                onPress={() => setMode('voice')}
                style={({ pressed }) => [
                  styles.modeButton,
                  mode === 'voice' ? styles.modeButtonActive : styles.modeButtonInactive,
                  pressed && styles.modePressed,
                ]}>
                <Mic
                  color={mode === 'voice' ? colors.cardWhite : colors.stageNavy}
                  size={22}
                  strokeWidth={2}
                />
                <View>
                  <AppText
                    variant="bodyMedium"
                    style={mode === 'voice' ? styles.modeLabelActive : styles.modeLabelInactive}>
                    声で話す
                  </AppText>
                  {recording ? (
                    <AppText
                      variant="caption"
                      style={mode === 'voice' ? styles.modeCaptionActive : undefined}>
                      ろくおん あり
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
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

            {mode === 'text' ? (
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
                {/* 音声入力の導線（チケット22）。話して書く＝キーボードの音声認識に任せる。
                    録音との同時動作は実機検証で不可と確定（録音がマイクを保持している間、
                    Gboard は「音声を受信できません」で失敗する。docs/22 検証結果）ため、
                    モードを分けたまま案内だけを出す */}
                <AppText variant="caption">
                  キーボードの マイクのしるしを おすと、話した ことばが 文字に なります。
                </AppText>
              </AppCard>
            ) : (
              /* 音声カード（チケット10）。録音〜のこすの流れは RecordingBox がまとめる */
              <RecordingBox
                recording={recording}
                viewUrl={recordingViewUrl}
                loading={recordingLoading}
                loadError={recordingError}
                onRetryLoad={() => void refetchRecording()}
                requireFreeTitle={() => requireFreeTitle('voice')}
                ensureAnswerId={ensureAnswerId}
                onSaved={handleRecordingSaved}
                onDeleteRequest={handleDeleteRecording}
                onPhaseChange={setRecPhase}
                offline={!isOnline}
              />
            )}

            {/* 写真エリア（チケット09）。表示・追加・削除・進捗は PhotoStrip がまとめる */}
            <PhotoStrip
              photos={photos}
              viewUrls={viewUrls}
              loading={photosLoading}
              loadError={photosError}
              onRetryLoad={() => void refetchPhotos()}
              uploadState={uploadState}
              uploadError={uploadError}
              onRetryUpload={() => void handleRetryUpload()}
              onAdd={() => void handleAddPhotos()}
              onDelete={handleDeletePhoto}
              offline={!isOnline}
            />
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
              disabled={!canSave || !isOnline}
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
  modeButtonInactive: {
    backgroundColor: colors.cardWhite,
    ...shadows.rest,
  },
  modePressed: {
    transform: [{ scale: 0.98 }],
  },
  modeLabelActive: {
    color: colors.cardWhite,
  },
  modeLabelInactive: {
    color: colors.stageNavy,
  },
  modeCaptionActive: {
    color: colors.cardWhite,
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
