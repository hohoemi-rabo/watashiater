/**
 * 【チケット00・検証用の仮画面】
 *
 * expo-audio の「録音 → 停止 → 再生」が実機で安定して動くか、AAC・最長3分の制限が守れるか、
 * 録音ファイルがどれくらいのサイズになるか（＝チケット09/10 のアップロード設計の入力）を
 * 確かめるためだけの画面。チケット03（app 基盤）で本物の共通UIを作るときに、このファイルごと削除する。
 *
 * フォントだけは tokens.fonts を参照しない：@expo-google-fonts の導入はチケット03の範囲で、
 * 未導入のフォント名を指定すると実機で意図しないフォントに落ちて検証結果を誤らせるため。
 * 色・影・文字サイズ・タップターゲットは DESIGN.md 準拠で tokens から参照する。
 *
 * reactCompiler: true の下では、recorder / player の「時間とともに変わるインスタンスプロパティ」
 * （uri・currentTime・isRecording・playing など）を **render 中に読まない**こと。
 * インスタンスの同一性が変わらないため、コンパイラが読み取りを記憶して古い値を返しうる。
 * 表示には useAudioRecorderState / useAudioPlayerStatus（本物の state）を使い、
 * インスタンスプロパティは非同期ハンドラの中でだけ読む。
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
import { File } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TAP_TARGET_MIN, colors, fontSizes, lineHeights, shadows } from '@/constants/tokens';

/**
 * REQUIREMENTS.md §4.2「音声は AAC、1録音あたり最長3分」。
 * HIGH_QUALITY だけが Android で AAC(.m4a) になる（LOW_QUALITY は Android では 3gp/AMR で要件を満たさない）。
 * useAudioRecorder は options の中身が変わると native recorder を作り直すため、モジュールスコープに固定する。
 */
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true, // 録音中の波形表示に使う。マイクが実際に音を拾えているかの確認も兼ねる
};

const MAX_RECORDING_SEC = 180;
/** native の forDuration が効かなかったときだけ JS 側で止める猶予。どちらが効いたか判別できる */
const BACKSTOP_GRACE_SEC = 1;
/** 残り時間表示と波形の更新間隔（ms）。useAudioRecorderState はマウント時の値で固定される */
const POLL_INTERVAL_MS = 100;
const WAVEFORM_BAR_COUNT = 32;
/** metering は dBFS。この値を無音の下限とみなして 0〜1 に正規化する */
const METER_FLOOR_DB = 60;

/** DESIGN.md には余白・角丸のスケールが無い（tokens.ts にも無い）。決めるのはチケット03の仕事なので、
 *  この仮画面ではローカル定数に閉じ込めて、StyleSheet に数値を散らさないでおく。 */
const SPACE = { xs: 4, sm: 8, md: 16, lg: 20, xl: 48 } as const;
const RADIUS = { button: 12, card: 16, bar: 2 } as const;
const WAVE_BAR_MIN_HEIGHT = 4;
const WAVE_BAR_MAX_HEIGHT = 56;

type Phase = 'checking' | 'blocked' | 'idle' | 'recording' | 'ready';
type StopTrigger = 'tap' | 'native' | 'backstop';

type LevelSample = { at: number; level: number };

type Measurement = {
  fileName: string;
  mimeType: string;
  bytes: number;
  durationSec: number;
  stopTrigger: StopTrigger;
};

const STOP_TRIGGER_LABEL: Record<StopTrigger, string> = {
  tap: '自分でとめた',
  native: '3分で自動停止（expo-audio の forDuration が効いた）',
  backstop: '3分で自動停止（JS の予備処理。forDuration は効かなかった）',
};

function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}分${String(whole % 60).padStart(2, '0')}秒`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** metering(dBFS) を 0〜1 に正規化する。値が来ない端末では 0 を返す */
function toLevel(metering: number | undefined) {
  if (typeof metering !== 'number' || !Number.isFinite(metering)) {
    return 0;
  }
  return Math.min(1, Math.max(0, (metering + METER_FLOOR_DB) / METER_FLOOR_DB));
}

export default function RecordingCheckScreen() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [levels, setLevels] = useState<LevelSample[]>([]);

  const reduceMotion = useReducedMotion();

  /** 停止は「タップ」「native の自動停止」「JS の予備処理」の3経路から来る。
   *  state ではなく ref で同期的にガードしないと、setPhase を待つ間に2本目がすり抜ける。 */
  const finalizingRef = useRef(false);
  /** statusListener は recorder.id が変わるまで再登録されない＝古いクロージャが残るため、ref 経由で最新を呼ぶ */
  const onNativeFinishRef = useRef<(url: string | null) => void>(() => {});

  const handleRecordingStatus = useCallback((status: RecordingStatus) => {
    if (status.hasError) {
      setErrorMessage(`録音中にエラーが起きました。${status.error ?? ''}`);
    }
    if (status.isFinished) {
      onNativeFinishRef.current(status.url);
    }
  }, []);

  const recorder = useAudioRecorder(RECORDING_OPTIONS, handleRecordingStatus);
  const recorderState = useAudioRecorderState(recorder, POLL_INTERVAL_MS);
  const player = useAudioPlayer(recordedUri ? { uri: recordedUri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  const finalize = useCallback(
    async (trigger: StopTrigger, urlFromStatus: string | null) => {
      if (finalizingRef.current) {
        return;
      }
      finalizingRef.current = true;

      // 長さは stop() の前に読む。stop 後は 0 に戻りうる
      const durationSec = recorder.getStatus().durationMillis / 1000;

      let uri = urlFromStatus;
      try {
        await recorder.stop();
      } catch {
        // native が forDuration で自動停止済みの場合 stop() は失敗しうる。url があれば続行する
      }
      // uri は stop() の await 後にしか確定しない
      uri = uri ?? recorder.uri;

      // 録音モードを戻す。iOS は PlayAndRecord のままだと受話口から小さく鳴る。
      // Android は shouldRouteThroughEarpiece: false でスピーカーに戻す。
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldRouteThroughEarpiece: false,
      });

      if (!uri) {
        setErrorMessage('録音したファイルが見つかりませんでした。');
        setPhase('idle');
        finalizingRef.current = false;
        return;
      }

      const file = new File(uri);
      setRecordedUri(uri);
      setMeasurement({
        fileName: uri.split('/').pop() ?? uri,
        mimeType: file.type,
        bytes: file.exists ? file.size : 0,
        durationSec,
        stopTrigger: trigger,
      });
      setPhase('ready');
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
    // 拒否が固定されている（もう聞けない）ときだけ設定アプリへ誘導する画面を出す。
    // 未許可でも「もう一度きける」なら、録音ボタンを出してタップ時に許可を求める。
    setPhase((prev) => {
      if (prev === 'recording' || prev === 'ready') {
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

  // 画面を離れるときに録音モードを戻す
  useEffect(() => {
    return () => {
      void setAudioModeAsync({ allowsRecording: false });
    };
  }, []);

  // native が止めてくれなかった場合に JS 側で止める（3分＋猶予1秒）
  useEffect(() => {
    if (phase !== 'recording') {
      return;
    }
    if (recorderState.durationMillis >= (MAX_RECORDING_SEC + BACKSTOP_GRACE_SEC) * 1000) {
      void finalize('backstop', null);
    }
  }, [phase, recorderState.durationMillis, finalize]);

  // 波形。実データ（metering）で高さが決まるので、装飾の常時ループアニメにはしない（DESIGN.md §8）
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

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    const allowed = await ensurePermission();
    if (!allowed) {
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      // stop() で MediaRecorder がリセットされるため、録音のたびに毎回よびだす
      await recorder.prepareToRecordAsync();
      finalizingRef.current = false;
      setLevels([]);
      setMeasurement(null);
      setRecordedUri(null);
      setPhase('recording');
      recorder.record({ forDuration: MAX_RECORDING_SEC });
    } catch (error) {
      setErrorMessage(`録音をはじめられませんでした。${String(error)}`);
      setPhase('idle');
    }
  }, [ensurePermission, recorder]);

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
    MAX_RECORDING_SEC - Math.floor(recorderState.durationMillis / 1000),
  );
  const currentLevel = toLevel(recorderState.metering);
  const bytesPerSec =
    measurement && measurement.durationSec > 0 ? measurement.bytes / measurement.durationSec : 0;

  return (
    <LinearGradient colors={[colors.skyTop, colors.skyBottom]} style={styles.gradient}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.screenTitle}>ろくおん検証</Text>
          <Text style={styles.lead}>
            こえを録音して、そのまま聞きかえせます。いちばん長くて3分までです。
          </Text>

          {phase === 'checking' ? <Text style={styles.lead}>じゅんびちゅう…</Text> : null}

          {phase === 'blocked' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>マイクが使えません</Text>
              <Text style={styles.body}>
                スマホの設定で、このアプリの「マイク」をオンにしてください。下のボタンから設定をひらけます。
              </Text>
              <PrimaryButton label="設定をひらく" onPress={() => void Linking.openSettings()} />
            </View>
          ) : null}

          {phase === 'idle' || phase === 'ready' ? (
            <PrimaryButton
              label={phase === 'ready' ? 'もう一度録音する' : '録音をはじめる'}
              onPress={() => void startRecording()}
            />
          ) : null}

          {phase === 'recording' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>録音しています</Text>
              <Text style={[styles.body, remainingSec <= 30 && styles.bodyWarning]}>
                あと {formatDuration(remainingSec)}
              </Text>

              {reduceMotion ? (
                <View style={styles.meterTrack}>
                  <View style={[styles.meterFill, { width: `${Math.round(currentLevel * 100)}%` }]} />
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

              <Text style={styles.caption}>
                マイクの大きさ（metering）:{' '}
                {typeof recorderState.metering === 'number'
                  ? `${recorderState.metering.toFixed(1)} dB`
                  : '（値が来ていません）'}
              </Text>

              <PrimaryButton label="とめる" onPress={() => void finalize('tap', null)} />
            </View>
          ) : null}

          {phase === 'ready' && measurement ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>聞いてみる</Text>
              <SecondaryButton
                label={playerStatus.playing ? 'とめる' : '聞いてみる'}
                onPress={() => void togglePlayback()}
              />
              <Text style={styles.caption}>
                {playerStatus.isLoaded ? '読みこみずみ' : '読みこみ中…'} / 再生位置{' '}
                {playerStatus.currentTime.toFixed(1)} 秒
              </Text>
            </View>
          ) : null}

          {measurement ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>計測けっか（この数字を報告してください）</Text>
              <Row label="ファイル名" value={measurement.fileName} />
              <Row label="種類（MIME）" value={measurement.mimeType || '（取れませんでした）'} />
              <Row label="録音の長さ" value={`${measurement.durationSec.toFixed(1)} 秒`} />
              <Row
                label="再生の長さ"
                value={playerStatus.duration > 0 ? `${playerStatus.duration.toFixed(1)} 秒` : '—'}
              />
              <Row
                label="サイズ"
                value={
                  measurement.bytes > 0
                    ? `${formatBytes(measurement.bytes)}（${measurement.bytes.toLocaleString('ja-JP')} バイト）`
                    : '計測できませんでした'
                }
              />
              <Row
                label="実測ビットレート"
                value={bytesPerSec > 0 ? `${((bytesPerSec * 8) / 1000).toFixed(1)} kbps` : '—'}
              />
              <Row
                label="3分ぶんの見つもり"
                value={bytesPerSec > 0 ? formatBytes(bytesPerSec * MAX_RECORDING_SEC) : '—'}
              />
              <Row label="とまりかた" value={STOP_TRIGGER_LABEL[measurement.stopTrigger]} />
              {recordedUri ? <Text style={styles.uri}>{recordedUri}</Text> : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>録音の設定</Text>
            <Row label="プリセット" value="RecordingPresets.HIGH_QUALITY" />
            <Row label="拡張子" value={RECORDING_OPTIONS.extension} />
            <Row
              label="Android"
              value={`${RECORDING_OPTIONS.android.outputFormat} / ${RECORDING_OPTIONS.android.audioEncoder}`}
            />
            <Row
              label="音の質"
              value={`${RECORDING_OPTIONS.sampleRate} Hz / ${RECORDING_OPTIONS.numberOfChannels} ch / ${RECORDING_OPTIONS.bitRate / 1000} kbps`}
            />
            <Row label="いちばん長くて" value={formatDuration(MAX_RECORDING_SEC)} />
          </View>

          {errorMessage ? (
            <View style={styles.card}>
              <Text style={styles.errorTitle}>うまくいきませんでした</Text>
              <Text style={styles.body}>{errorMessage}</Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

/** 画面でいちばん大切な操作1つだけに curtain-red を使う（DESIGN.md §3） */
function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      // 押すとわずかに沈む（DESIGN.md §5「押した感」）
      style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}>
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
      <Text style={styles.secondaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text selectable style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    gap: SPACE.md,
    padding: SPACE.lg,
    paddingBottom: SPACE.xl,
  },
  screenTitle: {
    color: colors.stageNavy,
    fontSize: fontSizes.screenTitle,
    fontWeight: 'bold',
  },
  lead: {
    color: colors.stageNavy,
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
  },
  card: {
    backgroundColor: colors.cardWhite,
    borderRadius: RADIUS.card,
    gap: SPACE.sm,
    padding: SPACE.lg,
    ...shadows.rest,
  },
  cardTitle: {
    color: colors.stageNavy,
    fontSize: fontSizes.cardTitle,
    fontWeight: 'bold',
  },
  body: {
    color: colors.stageNavy,
    fontSize: fontSizes.body,
    lineHeight: fontSizes.body * lineHeights.body,
  },
  bodyWarning: {
    color: colors.spotYellow,
    fontWeight: 'bold',
  },
  caption: {
    color: colors.textSoft,
    fontSize: fontSizes.caption,
  },
  uri: {
    color: colors.textSoft,
    fontSize: fontSizes.caption,
  },
  errorTitle: {
    color: colors.errorRed,
    fontSize: fontSizes.cardTitle,
    fontWeight: 'bold',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.curtainRed,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    minHeight: TAP_TARGET_MIN,
    minWidth: TAP_TARGET_MIN,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    ...shadows.raised,
  },
  primaryButtonLabel: {
    color: colors.cardWhite,
    fontSize: fontSizes.button,
    fontWeight: 'bold',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.cardWhite,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
    minHeight: TAP_TARGET_MIN,
    minWidth: TAP_TARGET_MIN,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    ...shadows.raised,
  },
  secondaryButtonLabel: {
    color: colors.stageNavy,
    fontSize: fontSizes.button,
    fontWeight: 'bold',
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    ...shadows.rest,
  },
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: WAVE_BAR_MAX_HEIGHT,
  },
  waveBar: {
    backgroundColor: colors.spotYellow,
    borderRadius: RADIUS.bar,
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
  row: {
    flexDirection: 'row',
    gap: SPACE.sm,
    justifyContent: 'space-between',
  },
  rowLabel: {
    color: colors.textSoft,
    flexShrink: 0,
    fontSize: fontSizes.caption,
  },
  rowValue: {
    color: colors.stageNavy,
    flexShrink: 1,
    fontSize: fontSizes.caption,
    textAlign: 'right',
  },
});
