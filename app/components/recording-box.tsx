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
 *
 * Web 対応（チケット26）は Platform.OS 分岐（CLAUDE.md の分岐基準2）：このファイルの大半は
 * プラットフォーム共通で、違うのは許可の取り方・波形のレベル源・blocked 画面だけ。
 * ファイルごと複製すると停止3経路などの機微が片方だけ直る事故になるため、差分を分岐で埋める
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
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { SecondaryButton } from '@/components/secondary-button';
import { colors, spacing } from '@/constants/tokens';
import { micLevelMeter } from '@/lib/mic-level';
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
  // Web の録音形式（チケット26。docs/24 で Chrome 151・iOS Safari 26.6 実測）。
  // - web: に置く理由：useAudioRecorder は createRecordingOptions() で options.web を
  //   トップレベルへ展開する。トップレベルに書くと黙って捨てられ既定の audio/webm になる
  // - コーデックまで明示する理由：'audio/mp4' だけだと Chrome が Opus を選び
  //   AAC 要件（REQUIREMENTS §4.2）に反する
  // - bitsPerSecond を書かない理由：web.bitsPerSecond はトップレベルの bitRate より
  //   優先される。プリセットの web（audio/webm・128kbps）をこのオブジェクトごと潰し、
  //   bitRate: 64000 を効かせる（1ch/64kbps は docs/24 の実測済み構成）
  web: { mimeType: 'audio/mp4;codecs=mp4a.40.2' },
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
  /** オフライン（チケット19）。録音の保存も再生もオンライン前提なので案内に替える */
  offline?: boolean;
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
  offline,
}: RecordingBoxProps) {
  // Web は 'idle' 始まり：許可状態を静かに確認する手段が無い（refreshPermission 参照）
  const [phase, setPhase] = useState<RecordingBoxPhase>(
    Platform.OS === 'web' ? 'idle' : 'checking',
  );
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
      // 波形のレベル取得を終了（Web のみ実体あり。native は no-op）
      micLevelMeter.detach();
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
    if (Platform.OS === 'web') {
      // Web の getRecordingPermissionsAsync は許可状態が確定していないと即 getUserMedia を
      // 呼ぶ（Safari は Permissions API 未対応で常に）＝画面を開いただけで許可ダイアログが
      // 出てしまう。Web に「静かに状態を見る」手段は無いので、マウント時（下の effect）と
      // AppState 復帰時は何もしない。許可は録音ボタン押下時（ensurePermission）だけ求める
      return;
    }
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

  // カードを離れるときに録音モードを戻す（波形のレベル取得も道連れにする）
  useEffect(() => {
    return () => {
      micLevelMeter.detach();
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

  // 波形。実データ（native: metering / web: AnalyserNode）で高さが決まるので、
  // 装飾の常時ループアニメにはしない（DESIGN §8）。Web のレベルは render 中に読まず
  // この effect で state に落とす（reactCompiler の下で外部可変オブジェクトを読まない規律）。
  // 更新は useAudioRecorderState の 100ms ポーリングに相乗りする（追加タイマーを作らない）
  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }
    const at = recorderState.durationMillis;
    const level = Platform.OS === 'web' ? micLevelMeter.read() : toLevel(recorderState.metering);
    if (level === undefined) {
      // Web で expo-audio 内部のストリームに届かなかったとき（mic-level.web.ts 参照）。
      // バーを積まず波形領域ごと出さない（フラットな偽バーを「壊れた」と読ませない）
      return;
    }
    setLevels((prev) =>
      prev.at(-1)?.at === at ? prev : [...prev, { at, level }].slice(-WAVEFORM_BAR_COUNT),
    );
  }, [phase, recorderState.durationMillis, recorderState.metering]);

  const ensurePermission = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const current = await AudioModule.getRecordingPermissionsAsync();
      if (current.granted) {
        return true;
      }
    }
    // Web は get を飛ばして request（=getUserMedia）1回だけにする：get は prompt 状態だと
    // 内部で request へ落ちるため、続けて request すると1回の押下でダイアログが2回出うる。
    // 許可済みなら getUserMedia はダイアログなしで解決するので、request 直行で困らない
    const next = await AudioModule.requestRecordingPermissionsAsync();
    if (!next.granted) {
      if (Platform.OS === 'web') {
        // Web の canAskAgain は成功・失敗とも true のハードコード（expo-audio の Web 実装を
        // 実読して確認）で判定材料にならない。拒否＝ブラウザがブロックを記憶した可能性が
        // 高いので、鍵マークからの解除案内（blocked 画面の Web 版）へ落とす
        setPhase('blocked');
        setErrorMessage(null);
        return false;
      }
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
    // Web の波形用 AudioContext はユーザージェスチャの同期スタック内で作る必要がある
    // （await の後だと Safari が suspended のまま戻さないことがある）。native は no-op
    micLevelMeter.prime();
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
      // 内部の MediaRecorder（と MediaStream）は prepare 後にしか存在しない。native は no-op
      micLevelMeter.attach(recorder);
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
  // レベル源は levels に一本化（native: metering / web: AnalyserNode。上の effect 参照）
  const currentLevel = levels.at(-1)?.level ?? 0;
  // Web でレベルが取れないとき（levels が空のまま）は波形領域を出さない。
  // native は従来どおり常に出す（metering が来ない端末でも高さ最小のバーが流れる）
  const showLevelDisplay = Platform.OS !== 'web' || levels.length > 0;
  const playing = playerStatus.playing;

  return (
    <AppCard style={styles.card}>
      {loading ? <ActivityIndicator color={colors.stageNavy} /> : null}

      {!loading && loadError && offline ? (
        // オフラインは「失敗」ではないので赤くしない（チケット19。DESIGN §3）
        <AppText variant="caption">声は つながると 聞けます。</AppText>
      ) : !loading && loadError ? (
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
            Platform.OS === 'web' ? (
              // Web 版：Linking.openSettings() はブラウザで機能しないので鍵マーク案内に差し替え。
              // Web は AppState 復帰の自動回復（refreshPermission）も無いため、
              // 「もういちど ためす」が回復経路（Safari は再試行で許可ダイアログが出なおす）
              <>
                <AppText variant="cardTitle">マイクが使えません</AppText>
                <AppText>
                  ブラウザにマイクの使用が止められています。アドレスバーの鍵マーク（iPhone
                  は「ぁあ」→「Webサイトの設定」）からマイクを「許可」にして、もういちど
                  ためしてください。
                </AppText>
                <SecondaryButton
                  icon={Mic}
                  label="もういちど ためす"
                  onPress={() => void startRecording()}
                />
              </>
            ) : (
              <>
                <AppText variant="cardTitle">マイクが使えません</AppText>
                <AppText>
                  スマホの設定で、このアプリの「マイク」をオンにしてください。下のボタンから設定をひらけます。
                </AppText>
                <SecondaryButton label="設定をひらく" onPress={() => void Linking.openSettings()} />
              </>
            )
          ) : null}

          {phase === 'idle' && !recording ? (
            <>
              <AppText variant="cardTitle">声で おはなしを どうぞ</AppText>
              {offline ? (
                <AppText variant="caption">
                  声を のこすには インターネットが ひつようです。
                </AppText>
              ) : (
                <>
                  <AppText variant="caption">{SAVE_NOTICE}</AppText>
                  <SecondaryButton
                    icon={Mic}
                    label="録音をはじめる"
                    onPress={() => void startRecording()}
                  />
                  <AppText variant="caption" style={styles.centerText}>
                    録音は いちばん長くて 3分です
                  </AppText>
                </>
              )}
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
              <SecondaryButton
                icon={RotateCcw}
                label="とりなおす"
                onPress={() => void startRecording()}
                disabled={offline}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="この声をけす"
                disabled={offline}
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

              {!showLevelDisplay ? null : reduceMotion ? (
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
