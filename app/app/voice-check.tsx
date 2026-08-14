/**
 * 音声入力（キーボードの音声認識）× expo-audio 録音の同時動作チェック（チケット22）。
 * **一時画面**：検証が終わったらチケット22内でこのファイルごと削除する
 * （設定画面の一時ボタンも同時に削除）。docs/00 recording-check・docs/24 web-check と同じ扱い。
 *
 * 本番の回答画面はテキスト⇄音声がモード排他で同時に出せないため、この画面で
 * 「録音を続けたまま TextInput にキーボードのマイクで入力できるか」を確かめる。
 * 見るポイント：
 * - 音声入力に切り替えた瞬間に metering（マイク入力レベル）が止まる/消えるか
 * - statusListener に hasError が来るか
 * - 停止後の再生で、音声入力していた間の声が録れているか（無音区間の有無）
 *
 * 検証専用画面なので、共通トークンに無い余白等はローカル定数に閉じる（docs/00 の作法）
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
import { Mic, Pause, Play, Square } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, fonts, fontSizes, radii, spacing } from '@/constants/tokens';

/** 本番（recording-box）と同条件で検証するため、同じ録音オプションを使う */
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
};

const POLL_INTERVAL_MS = 100;
const MAX_LOG_LINES = 12;

export default function VoiceCheckScreen() {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'stopped'>('idle');
  const [text, setText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [localUri, setLocalUri] = useState<string | null>(null);

  const busyRef = useRef(false);

  const appendLog = useCallback((message: string) => {
    const at = new Date().toLocaleTimeString('ja-JP', { hour12: false });
    setLogs((prev) => [...prev, `${at} ${message}`].slice(-MAX_LOG_LINES));
  }, []);

  const handleStatus = useCallback(
    (status: RecordingStatus) => {
      if (status.hasError) {
        appendLog(`status: hasError=true error=${status.error ?? '(なし)'}`);
      }
      if (status.isFinished) {
        appendLog('status: isFinished=true（native 側で録音が終了）');
      }
    },
    [appendLog],
  );

  const recorder = useAudioRecorder(RECORDING_OPTIONS, handleStatus);
  const recorderState = useAudioRecorderState(recorder, POLL_INTERVAL_MS);

  const player = useAudioPlayer(localUri ? { uri: localUri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  // 画面を離れるときに録音モードを戻す（recording-box と同じ後始末）
  useEffect(() => {
    return () => {
      void setAudioModeAsync({ allowsRecording: false });
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        appendLog('マイク許可が得られませんでした');
        return;
      }
      player.pause();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      setLocalUri(null);
      setPhase('recording');
      recorder.record();
      appendLog('録音を開始しました');
    } catch (error) {
      appendLog(`録音開始に失敗: ${String(error)}`);
      setPhase('idle');
    } finally {
      busyRef.current = false;
    }
  }, [appendLog, player, recorder]);

  const stopRecording = useCallback(async () => {
    if (busyRef.current) {
      return;
    }
    busyRef.current = true;
    try {
      await recorder.stop();
    } catch (error) {
      appendLog(`stop() が失敗: ${String(error)}`);
    }
    const uri = recorder.uri;
    // 戻さないと再生が受話口から小さく鳴る（docs/00）
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
    });
    appendLog(uri ? '録音を停止しました（uri あり）' : '録音を停止しました（uri なし！）');
    setLocalUri(uri);
    setPhase(uri ? 'stopped' : 'idle');
    busyRef.current = false;
  }, [appendLog, recorder]);

  const togglePlayback = useCallback(async () => {
    if (playerStatus.playing) {
      player.pause();
      return;
    }
    await player.seekTo(0);
    player.play();
  }, [player, playerStatus.playing]);

  const meteringText =
    typeof recorderState.metering === 'number' && Number.isFinite(recorderState.metering)
      ? recorderState.metering.toFixed(1)
      : '（値なし）';
  const durationText = (recorderState.durationMillis / 1000).toFixed(1);

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BackButton />
        <AppText variant="screenTitle">音声入力の検証</AppText>
        <AppText variant="caption">
          チケット22の一時画面です。①下の入力欄でキーボードのマイクが使えることを確認 →
          ②録音を開始して話す → ③録音したまま入力欄でキーボードのマイクを使う →
          ④停止して再生し、③の間の声が録れているか聞く。
        </AppText>

        <AppCard style={styles.card}>
          <AppText variant="cardTitle">1. 録音</AppText>
          <AppText>
            状態: {phase === 'recording' ? '録音中' : phase === 'stopped' ? '停止（再生可）' : '待機'}
          </AppText>
          <AppText>
            長さ: {durationText}秒 ／ metering: {meteringText}
          </AppText>
          {phase === 'recording' ? (
            <SecondaryButton icon={Square} label="停止" onPress={() => void stopRecording()} />
          ) : (
            <SecondaryButton icon={Mic} label="録音開始" onPress={() => void startRecording()} />
          )}
          {phase === 'stopped' && localUri ? (
            <SecondaryButton
              icon={playerStatus.playing ? Pause : Play}
              label={playerStatus.playing ? 'とめる' : '再生する'}
              onPress={() => void togglePlayback()}
            />
          ) : null}
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="cardTitle">2. 音声入力の受け皿</AppText>
          <TextInput
            accessibilityLabel="音声入力の検証用テキスト"
            value={text}
            onChangeText={setText}
            placeholder="ここをタップして、キーボードのマイクで話してください"
            placeholderTextColor={colors.textSoft}
            multiline
            textAlignVertical="top"
            style={styles.input}
          />
          <AppText variant="caption">いま {text.length} 文字</AppText>
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="cardTitle">3. ログ</AppText>
          {logs.length === 0 ? <AppText variant="caption">（まだありません）</AppText> : null}
          {logs.map((line, index) => (
            <AppText key={`${index}-${line}`} variant="caption">
              {line}
            </AppText>
          ))}
        </AppCard>
        <View style={styles.bottomSpace} />
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    padding: spacing.xl,
  },
  card: {
    gap: spacing.sm,
  },
  input: {
    // 本番の回答画面 bodyInput と同じ指定（lineHeight を付けない理由も同じ。docs/06）
    borderColor: colors.textSoft,
    borderRadius: radii.button,
    borderWidth: 1,
    color: colors.stageNavy,
    fontFamily: fonts.body,
    fontSize: fontSizes.body,
    minHeight: 120,
    padding: spacing.md,
  },
  bottomSpace: {
    height: spacing.section,
  },
});
