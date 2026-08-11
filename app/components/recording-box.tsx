/**
 * 回答画面の音声カード（チケット10）。録音 → プレビュー → のこす（アップロード）→ 保存済み表示。
 *
 * 録音まわりの機微はチケット00の検証画面から移植した実機検証済みの実装（docs/00 検証結果）：
 * - 停止は「タップ」「native の forDuration」「JS 予備」の3経路 → finalizingRef で同期ガード
 * - native 自動停止後は getStatus().durationMillis が 0 を返す → ポーリングの控えと大きい方を使う
 * - 停止後に audio mode を戻さないと再生が受話口から小さく鳴る
 * - statusListener は recorder.id が変わるまで再登録されない → ref 経由で最新の finalize を呼ぶ
 * - reactCompiler: true の下では recorder / player のインスタンスプロパティを render 中に読まない
 *   （表示は useAudioRecorderState / useAudioPlayerStatus のみ）
 *
 * 色の規律：curtain-red はこの画面ではフッターの保存ボタン専用なのでカード内は白ボタンのみ。
 * 波形の spot-yellow は DESIGN §7 の指定（metering 実データ駆動＝装飾の常時ループに該当しない）
 */
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingStatus,
} from 'expo-audio';
import { Check, Mic, Pause, Play, RotateCcw, Square, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { SecondaryButton } from '@/components/secondary-button';
import { colors, spacing } from '@/constants/tokens';
import {
  RECORDING_HARD_CAP_SEC,
  RECORDING_MAX_SEC,
  saveRecordingRow,
  uploadRecordingFile,
} from '@/lib/recording-attach';
import type { Recording } from '@/lib/use-recording';

/**
 * REQUIREMENTS §4.2「音声は AAC、最長3分」。AAC(.m4a) になるのは HIGH_QUALITY 系のみ
 * （LOW_QUALITY は Android では 3gp/AMR になり要件を満たさない。docs/00）。
 * android サブ設定（mpeg4/aac）はそのまま残し、声の記録には過剰なステレオ128kbps だけを
 * 1ch/64kbps に落とす（3分≈1.4MB。HIGH_QUALITY 実測 2.78MB の半分。docs/00 の申し送り）。
 * 音質が気になったら numberOfChannels / bitRate の2行を消せば HIGH_QUALITY に戻る。
 * useAudioRecorder は options の中身が変わると native recorder を作り直すため、モジュールスコープに固定
 */
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
};

/** 残り時間表示と波形の更新間隔（ms）。useAudioRecorderState はマウント時の値で固定される */
const POLL_INTERVAL_MS = 100;
const WAVEFORM_BAR_COUNT = 32;
/** metering は dBFS。この値を無音の下限とみなして 0〜1 に正規化する */
const METER_FLOOR_DB = 60;
const WAVE_BAR_MIN_HEIGHT = 4;
const WAVE_BAR_MAX_HEIGHT = 56;

const SAVE_NOTICE = 'この声は写真の説明として使えます';
const GENERIC_SAVE_ERROR =
  'のこせませんでした。でんぱの よいところで もういちど ためしてください。';

export type RecordingBoxPhase =
  | 'checking'
  | 'blocked'
  | 'idle'
  | 'recording'
  | 'preview'
  | 'uploading';

type StopTrigger = 'tap' | 'native' | 'backstop';

type LevelSample = { at: number; level: number };

type RecordingBoxProps = {
  recording: Recording | null;
  viewUrl: string | null;
  loading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  /** 自由お題でタイトル未入力なら親が Alert を出して false を返す（録音開始前と のこす時の2回呼ぶ） */
  requireFreeTitle: () => boolean;
  ensureAnswerId: () => Promise<{ ok: true; answerId: string } | { ok: false; message: string }>;
  /** 保存成功。親の refetch（recordings・prompts）が終わるまで await して表示のチラつきを防ぐ */
  onSaved: (answerId: string) => Promise<void>;
  /** 削除の確認ダイアログ〜削除〜後始末は親（PhotoStrip と同じ分担） */
  onDeleteRequest: (recording: Recording) => void;
  /** 親の離脱ガード・保存/モード切替の無効化に使う */
  onPhaseChange: (phase: RecordingBoxPhase) => void;
};

function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}分${String(whole % 60).padStart(2, '0')}秒`;
}

/** metering(dBFS) を 0〜1 に正規化する。値が来ない端末では 0 を返す */
function toLevel(metering: number | undefined) {
  if (typeof metering !== 'number' || !Number.isFinite(metering)) {
    return 0;
  }
  return Math.min(1, Math.max(0, (metering + METER_FLOOR_DB) / METER_FLOOR_DB));
}

export function RecordingBox({
  recording,
  viewUrl,
  loading,
  loadError,
  onRetryLoad,
  requireFreeTitle,
  ensureAnswerId,
  onSaved,
  onDeleteRequest,
  onPhaseChange,
}: RecordingBoxProps) {
  const [phase, setPhase] = useState<RecordingBoxPhase>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [levels, setLevels] = useState<LevelSample[]>([]);

  const reduceMotion = useReducedMotion();

  /** 停止3経路（タップ・native・JS予備）の同時着火を防ぐ同期ガード（state では間に合わない） */
  const finalizingRef = useRef(false);
  /** ポーリングで見えた最後の録音長。native 自動停止後は getStatus() が 0 を返すため控えを持つ */
  const lastDurationMsRef = useRef(0);
  /** statusListener の古い closure 対策：常に最新の finalize を呼ぶための ref */
  const onNativeFinishRef = useRef<(url: string | null) => void>(() => {});

  const handleRecordingStatus = useCallback((status: RecordingStatus) => {
    if (status.hasError) {
      setErrorMessage('録音中に エラーが おきました。もういちど ためしてください。');
    }
    if (status.isFinished) {
      onNativeFinishRef.current(status.url);
    }
  }, []);

  const recorder = useAudioRecorder(RECORDING_OPTIONS, handleRecordingStatus);
  const recorderState = useAudioRecorderState(recorder, POLL_INTERVAL_MS);

  // 再生ソースは1本：プレビュー中（アップロード中含む）はローカル、保存済み表示は署名URL
  const playbackUri =
    phase === 'preview' || phase === 'uploading'
      ? localUri
      : phase === 'idle' && recording
        ? viewUrl
        : null;
  const player = useAudioPlayer(playbackUri ? { uri: playbackUri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    onPhaseChange(phase);
  }, [phase, onPhaseChange]);

  const finalize = useCallback(
    async (trigger: StopTrigger, urlFromStatus: string | null) => {
      if (finalizingRef.current) {
        return;
      }
      finalizingRef.current = true;

      // 長さは stop() の前に読む。native 自動停止後は getStatus() が 0 なので控えと大きい方
      const durationMs = Math.max(recorder.getStatus().durationMillis, lastDurationMsRef.current);

      let uri = urlFromStatus;
      try {
        await recorder.stop();
      } catch {
        // native が forDuration で自動停止済みの場合 stop() は失敗しうる。url があれば続行する
      }
      // uri は stop() の await 後にしか確定しない
      uri = uri ?? recorder.uri;

      // 録音モードを戻す。戻さないと再生が受話口から小さく鳴り「壊れている」と受け取られる
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });

      if (!uri) {
        setErrorMessage('録音した声が みつかりませんでした。もういちど ためしてください。');
        setPhase('idle');
        finalizingRef.current = false;
        return;
      }

      setLocalUri(uri);
      setDurationSec(durationMs / 1000);
      setPhase('preview');
      finalizingRef.current = false;
    },
    [recorder],
  );

  useEffect(() => {
    onNativeFinishRef.current = (url) => {
      void finalize('native', url);
    };
  }, [finalize]);

  const refreshPermission = useCallback(async () => {
    const status = await AudioModule.getRecordingPermissionsAsync();
    // 拒否が固定されている（もう聞けない）ときだけ設定アプリへ誘導する。
    // 未許可でも「もう一度きける」なら録音ボタンを出し、タップ時に許可を求める
    setPhase((prev) => {
      if (prev === 'recording' || prev === 'preview' || prev === 'uploading') {
        return prev;
      }
      return status.granted || status.canAskAgain ? 'idle' : 'blocked';
    });
  }, []);

  // 起動時は許可を求めない（文脈なしに OS ダイアログを出さない）。状態だけ静かに見ておく
  useEffect(() => {
    void refreshPermission();
  }, [refreshPermission]);

  // 設定アプリでマイクをオンにして戻ってきたら、自動で録音できる状態に復帰させる
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refreshPermission();
      }
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  // カードを離れるときに録音モードを戻す
  useEffect(() => {
    return () => {
      void setAudioModeAsync({ allowsRecording: false });
    };
  }, []);

  // native が止めてくれなかった場合に JS 側で止める（3分＋猶予1秒＝DB CHECK の上限と一致）
  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }
    lastDurationMsRef.current = Math.max(lastDurationMsRef.current, recorderState.durationMillis);
    if (recorderState.durationMillis >= RECORDING_HARD_CAP_SEC * 1000) {
      void finalize('backstop', null);
    }
  }, [phase, recorderState.durationMillis, finalize]);

  // 波形。実データ（metering）で高さが決まるので、装飾の常時ループアニメにはしない（DESIGN §8）
  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }
    const at = recorderState.durationMillis;
    const level = toLevel(recorderState.metering);
    setLevels((prev) =>
      prev.at(-1)?.at === at ? prev : [...prev, { at, level }].slice(-WAVEFORM_BAR_COUNT),
    );
  }, [phase, recorderState.durationMillis, recorderState.metering]);

  const ensurePermission = useCallback(async () => {
    const current = await AudioModule.getRecordingPermissionsAsync();
    if (current.granted) {
      return true;
    }
    const next = await AudioModule.requestRecordingPermissionsAsync();
    if (!next.granted) {
      setPhase(next.canAskAgain ? 'idle' : 'blocked');
      setErrorMessage(
        next.canAskAgain
          ? 'マイクを使う許可がありません。もう一度ボタンをおして「許可」をえらんでください。'
          : null,
      );
      return false;
    }
    setErrorMessage(null);
    setPhase('idle');
    return true;
  }, []);

  /** 録音開始（新規・プレビューからのとりなおし・保存済みからのとりなおし共通） */
  const startRecording = useCallback(async () => {
    if (!requireFreeTitle()) {
      return;
    }
    setErrorMessage(null);
    setUploadError(null);
    const allowed = await ensurePermission();
    if (!allowed) {
      return;
    }
    try {
      player.pause();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      // stop() で MediaRecorder がリセットされるため、録音のたびに毎回よびだす
      await recorder.prepareToRecordAsync();
      finalizingRef.current = false;
      lastDurationMsRef.current = 0;
      setLevels([]);
      setLocalUri(null);
      setDurationSec(0);
      setPhase('recording');
      recorder.record({ forDuration: RECORDING_MAX_SEC });
    } catch {
      setErrorMessage('録音をはじめられませんでした。もういちど ためしてください。');
      setPhase('idle');
    }
  }, [requireFreeTitle, ensurePermission, player, recorder]);

  /** 「この声を のこす」＝ PUT → answers 行の用意 → recordings upsert → 親の refetch を待つ */
  const handleSave = useCallback(async () => {
    if (!localUri || phase === 'uploading') {
      return;
    }
    if (!requireFreeTitle()) {
      return;
    }
    player.pause();
    setUploadError(null);
    setPhase('uploading');
    const uploaded = await uploadRecordingFile(localUri);
    if (!uploaded.ok) {
      setUploadError(uploaded.message);
      setPhase('preview');
      return;
    }
    const ensured = await ensureAnswerId();
    if (!ensured.ok) {
      setUploadError(ensured.message);
      setPhase('preview');
      return;
    }
    const saved = await saveRecordingRow(ensured.answerId, uploaded.r2Key, durationSec);
    if (!saved.ok) {
      setUploadError(saved.message ?? GENERIC_SAVE_ERROR);
      setPhase('preview');
      return;
    }
    // 親の refetch（recordings・prompts）が終わるまで待ってから保存済み表示へ（チラつき防止）
    await onSaved(ensured.answerId);
    setLocalUri(null);
    setDurationSec(0);
    setPhase('idle');
  }, [localUri, phase, requireFreeTitle, player, ensureAnswerId, durationSec, onSaved]);

  const togglePlayback = useCallback(async () => {
    if (playerStatus.playing) {
      player.pause();
      return;
    }
    await player.seekTo(0);
    player.play();
  }, [player, playerStatus.playing]);

  const remainingSec = Math.max(
    0,
    RECORDING_MAX_SEC - Math.floor(recorderState.durationMillis / 1000),
  );
  const currentLevel = toLevel(recorderState.metering);
  const playing = playerStatus.playing;

  return (
    <AppCard style={styles.card}>
      {loading ? <ActivityIndicator color={colors.stageNavy} /> : null}

      {!loading && loadError ? (
        <>
          <AppText variant="caption" style={styles.errorText}>
            {loadError}
          </AppText>
          <SecondaryButton label="もういちど よみこむ" onPress={onRetryLoad} />
        </>
      ) : null}

      {!loading && !loadError ? (
        <>
          {phase === 'checking' ? <AppText>じゅんびちゅう…</AppText> : null}

          {phase === 'blocked' ? (
            <>
              <AppText variant="cardTitle">マイクが使えません</AppText>
              <AppText>
                スマホの設定で、このアプリの「マイク」をオンにしてください。下のボタンから設定をひらけます。
              </AppText>
              <SecondaryButton label="設定をひらく" onPress={() => void Linking.openSettings()} />
            </>
          ) : null}

          {phase === 'idle' && !recording ? (
            <>
              <AppText variant="cardTitle">声で おはなしを どうぞ</AppText>
              <AppText variant="caption">{SAVE_NOTICE}</AppText>
              <SecondaryButton icon={Mic} label="録音をはじめる" onPress={() => void startRecording()} />
              <AppText variant="caption" style={styles.centerText}>
                録音は いちばん長くて 3分です
              </AppText>
            </>
          ) : null}

          {phase === 'idle' && recording ? (
            <>
              <AppText variant="cardTitle">のこした声</AppText>
              <SecondaryButton
                icon={playing ? Pause : Play}
                label={playing ? 'とめる' : '聞いてみる'}
                onPress={() => void togglePlayback()}
                disabled={!viewUrl}
              />
              <AppText variant="caption" style={styles.centerText}>
                長さ {formatDuration(recording.duration_sec)}
              </AppText>
              <SecondaryButton icon={RotateCcw} label="とりなおす" onPress={() => void startRecording()} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="この声をけす"
                hitSlop={8}
                onPress={() => onDeleteRequest(recording)}
                style={({ pressed }) => [styles.deleteButton, pressed && styles.deletePressed]}>
                <Trash2 color={colors.errorRed} size={16} strokeWidth={2} />
                <AppText variant="caption" style={styles.deleteLabel}>
                  けす
                </AppText>
              </Pressable>
            </>
          ) : null}

          {phase === 'recording' ? (
            <>
              <AppText variant="cardTitle">録音しています</AppText>
              <AppText style={remainingSec <= 30 ? styles.remainingWarning : undefined}>
                あと {formatDuration(remainingSec)}
              </AppText>

              {reduceMotion ? (
                <View style={styles.meterTrack}>
                  <View
                    style={[styles.meterFill, { width: `${Math.round(currentLevel * 100)}%` }]}
                  />
                </View>
              ) : (
                <View style={styles.waveform}>
                  {levels.map((sample) => (
                    <View
                      key={sample.at}
                      style={[
                        styles.waveBar,
                        {
                          height:
                            WAVE_BAR_MIN_HEIGHT +
                            sample.level * (WAVE_BAR_MAX_HEIGHT - WAVE_BAR_MIN_HEIGHT),
                        },
                      ]}
                    />
                  ))}
                </View>
              )}

              <SecondaryButton icon={Square} label="とめる" onPress={() => void finalize('tap', null)} />
            </>
          ) : null}

          {phase === 'preview' ? (
            <>
              <AppText variant="cardTitle">ろくおんできました</AppText>
              <AppText>聞いてみて、よければ のこしてください。</AppText>
              <SecondaryButton
                icon={playing ? Pause : Play}
                label={playing ? 'とめる' : '聞いてみる'}
                onPress={() => void togglePlayback()}
              />
              <AppText variant="caption" style={styles.centerText}>
                長さ {formatDuration(durationSec)}
              </AppText>
              <AppText variant="caption">{SAVE_NOTICE}</AppText>
              {uploadError ? (
                <AppText variant="caption" style={styles.errorText}>
                  {uploadError}
                </AppText>
              ) : null}
              <SecondaryButton
                icon={Check}
                label={uploadError ? 'もういちど のこす' : 'この声を のこす'}
                onPress={() => void handleSave()}
              />
              <SecondaryButton icon={RotateCcw} label="とりなおす" onPress={() => void startRecording()} />
            </>
          ) : null}

          {phase === 'uploading' ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={colors.stageNavy} />
              <AppText variant="caption">声を のこしています…</AppText>
            </View>
          ) : null}

          {errorMessage ? (
            <AppText variant="caption" style={styles.errorText}>
              {errorMessage}
            </AppText>
          ) : null}
        </>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    color: colors.errorRed,
  },
  remainingWarning: {
    color: colors.spotYellow,
    fontWeight: 'bold',
  },
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: WAVE_BAR_MAX_HEIGHT,
  },
  waveBar: {
    backgroundColor: colors.spotYellow,
    borderRadius: 2,
    flex: 1,
  },
  meterTrack: {
    backgroundColor: colors.skyBottom,
    borderRadius: 6,
    height: 12,
    overflow: 'hidden',
  },
  meterFill: {
    backgroundColor: colors.spotYellow,
    height: '100%',
  },
  deleteButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: spacing.section,
    paddingHorizontal: spacing.lg,
  },
  deletePressed: {
    opacity: 0.6,
  },
  deleteLabel: {
    color: colors.errorRed,
  },
});
