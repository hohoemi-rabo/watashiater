/**
 * 【一時】書き手Web（PWA）の技術検証画面（チケット24）。docs/00 の recording-check.tsx と同じ扱いで、
 * **チケット26 でこのファイルごと削除する**。本番の導線からは張らない（URL 直打ちで開く）。
 *
 * ここで確かめること（docs/24 の Todo）：
 *  1. ブラウザが録音できる形式（MediaRecorder.isTypeSupported の対応表）
 *  2. マイク許可ダイアログが「画面を開いただけ」で出ないか
 *  3. 録音を2経路で比較して、26 でどちらを採るか決める
 *     A: expo-audio の Web recorder（AudioRecorderWeb。共通コードを活かせる）
 *     B: 素の MediaRecorder（挙動を完全に握れる）
 *  4. 署名URLへの fetch PUT が worker の Content-Length 必須を満たすか
 *  5. R2 に入ったものが署名URLで再生できるか／閲覧Web でも鳴るか
 *  6. 写真の選択・圧縮（長辺1600px・JPEG品質80）が Web で成立するか
 *
 * 結果はユーザーが読み上げるのではなく「ログをコピー」で貼り戻してもらう前提。
 */
import {
  AudioModule,
  RecordingPresets,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';
import { compressPhoto, pickPhotos } from '@/lib/photo-attach';
import { RECORDING_MAX_SEC, saveRecordingRow } from '@/lib/recording-attach';
import { supabase } from '@/lib/supabase';
import { getUploadUrls, getViewUrls } from '@/lib/worker-api';

/** 対応表を取る候補。docs/24 の事前調査で Chromium は audio/mp4 true・コーデック付きは false だった */
const MIME_CANDIDATES = [
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/aac',
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
];

/** worker が R2 に固定で書く Content-Type。ここからずれた形式を上げると閲覧側が壊れる */
const TARGET_MIME = 'audio/mp4';

/**
 * 経路A のオプション。expo-audio の Web 実装（AudioModule.web.js の createMediaRecorder）は
 * 型に定義された `options.web.mimeType` ではなく **トップレベルの `options.mimeType`** を読む。
 * 型に無い項目なのでキャストで渡し、「これで audio/mp4 を強制できるか」をこの画面で確かめる。
 * 既定のままだと HIGH_QUALITY.web.mimeType = 'audio/webm' が使われる＝Chrome で webm になる
 */
const RECORDER_A_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  mimeType: TARGET_MIME,
} as RecordingOptions;

type AnswerRow = { id: string; custom_title: string | null; body_text: string };

function formatBytes(bytes: number): string {
  return `${bytes.toLocaleString()} バイト（${(bytes / 1024 / 1024).toFixed(2)} MB）`;
}

export default function WebCheckScreen() {
  // hooks を条件分岐の中に置かないため、ブラウザ専用の中身は子コンポーネントに閉じる
  if (Platform.OS !== 'web') {
    return (
      <SkyBackground>
        <ScrollView contentContainerStyle={styles.content}>
          <BackButton />
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">この画面はブラウザ専用です</AppText>
            <AppText>チケット24 の検証用。パソコンか iPhone のブラウザで開いてください。</AppText>
          </AppCard>
        </ScrollView>
      </SkyBackground>
    );
  }
  return <WebProbes />;
}

function WebProbes() {
  const { subject } = useAuth();
  const [log, setLog] = useState<string[]>([]);
  const [permissionNote, setPermissionNote] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  /** 直近にアップロードできた録音（閲覧・紐づけの対象） */
  const [uploaded, setUploaded] = useState<{ r2Key: string; durationSec: number } | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [recordingB, setRecordingB] = useState(false);

  const append = useCallback((line: string) => {
    setLog((prev) => [...prev, line]);
  }, []);

  const player = useAudioPlayer(playbackUrl ? { uri: playbackUrl } : null);
  const playerStatus = useAudioPlayerStatus(player);

  // ── 4. アップロード（署名URL へ fetch PUT）────────────────
  // 経路A・B の両方から呼ぶので先に定義する
  const uploadRecording = useCallback(
    async (blob: Blob, durationSec: number, label: string) => {
      try {
        const [target] = await getUploadUrls('recording', 1);
        // Blob を body にすると Content-Length が自動で付く（worker は無いと 411 を返す）。
        // native の FileSystem.uploadAsync は Web に無いので、26 ではこれが正式な差し替え先になる
        const response = await fetch(target.uploadUrl, { method: 'PUT', body: blob });
        if (!response.ok) {
          append(`${label}: PUT 失敗 ${response.status} ${await response.text()}`);
          return;
        }
        append(`${label}: PUT 成功 → ${target.r2Key}`);
        setUploaded({ r2Key: target.r2Key, durationSec });
      } catch (error) {
        append(`${label}: PUT で例外（CORS の可能性）: ${String(error)}`);
      }
    },
    [append],
  );

  // ── 1. 環境 ──────────────────────────────────────────────
  useEffect(() => {
    append(`userAgent: ${navigator.userAgent}`);
    append(`isSecureContext: ${window.isSecureContext}`);
    append(`mediaDevices: ${navigator.mediaDevices ? 'あり' : 'なし'}`);
    if (typeof MediaRecorder === 'undefined') {
      append('MediaRecorder: この環境には無い');
      return;
    }
    for (const mime of MIME_CANDIDATES) {
      append(`isTypeSupported(${mime}) = ${MediaRecorder.isTypeSupported(mime)}`);
    }
    // 「画面を開いただけ」でマイク許可を求めていないことを、この行が出た時点で目視確認する
    append('--- ここまでは許可ダイアログを出していない ---');
  }, [append]);

  // 紐づけ先の候補（自分の回答）を読む
  useEffect(() => {
    if (!subject) {
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from('answers')
        .select('id, custom_title, body_text')
        .eq('subject_id', subject.id)
        .order('updated_at', { ascending: false })
        .limit(10);
      if (error) {
        append(`answers 取得エラー: ${error.message}`);
        return;
      }
      setAnswers(data);
    })();
  }, [subject, append]);

  // ── 2. マイク許可（押したときだけ）─────────────────────────
  const checkPermission = useCallback(async () => {
    const status = await AudioModule.getRecordingPermissionsAsync();
    // 注意：Web 実装は Permissions API が使えないと即 getUserMedia を呼ぶ（＝ダイアログが出る）。
    // Safari は microphone の query に未対応なので、ここでダイアログが出るのが「素の挙動」
    setPermissionNote(`granted=${status.granted} / canAskAgain=${status.canAskAgain}`);
    append(`getRecordingPermissionsAsync → granted=${status.granted}`);
  }, [append]);

  // ── 3-A. expo-audio の Web recorder ─────────────────────
  const recorderA = useAudioRecorder(RECORDER_A_OPTIONS);
  const recorderAState = useAudioRecorderState(recorderA, 200);

  const startA = useCallback(async () => {
    try {
      await recorderA.prepareToRecordAsync();
      recorderA.record({ forDuration: RECORDING_MAX_SEC });
      append(`A: 録音開始（forDuration=${RECORDING_MAX_SEC}秒）`);
    } catch (error) {
      append(`A: 録音を開始できない: ${String(error)}`);
    }
  }, [recorderA, append]);

  const stopA = useCallback(async () => {
    const durationMs = recorderA.getStatus().durationMillis;
    try {
      await recorderA.stop();
    } catch (error) {
      // forDuration で自動停止済みだと mediaRecorder が null になっていて throw する
      append(`A: stop() が例外（自動停止済みの可能性）: ${String(error)}`);
    }
    const uri = recorderA.uri;
    if (!uri) {
      append('A: uri が取れなかった');
      return;
    }
    const blob = await (await fetch(uri)).blob();
    append(`A: 実際の形式 = ${blob.type || '(空)'} / ${formatBytes(blob.size)} / ${durationMs}ms`);
    append(`A: 目標 ${TARGET_MIME} と一致するか = ${blob.type.startsWith(TARGET_MIME)}`);
    await uploadRecording(blob, durationMs / 1000, 'A');
  }, [recorderA, append, uploadRecording]);

  // ── 3-B. 素の MediaRecorder ──────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  const startB = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // コーデックまで書くと Chromium が弾く（docs/24 事前調査）ので mimeType はコンテナまで
      const supported = MediaRecorder.isTypeSupported(TARGET_MIME);
      const recorder = new MediaRecorder(stream, {
        ...(supported ? { mimeType: TARGET_MIME } : {}),
        audioBitsPerSecond: 64000,
      });
      chunksRef.current = [];
      recorder.addEventListener('dataavailable', (event) => {
        chunksRef.current.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const durationSec = (Date.now() - startedAtRef.current) / 1000;
        append(`B: recorder.mimeType = ${recorder.mimeType || '(空)'}`);
        append(`B: blob = ${blob.type || '(空)'} / ${formatBytes(blob.size)} / ${durationSec.toFixed(1)}秒`);
        append(`B: 目標 ${TARGET_MIME} と一致するか = ${blob.type.startsWith(TARGET_MIME)}`);
        setRecordingB(false);
        void uploadRecording(blob, durationSec, 'B');
      });
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setRecordingB(true);
      append(`B: 録音開始（mimeType 指定=${supported ? TARGET_MIME : 'ブラウザ既定にまかせた'}）`);
      // 3分上限。native の forDuration に相当する保険
      window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          append('B: 3分に達したので自動停止');
          mediaRecorderRef.current.stop();
        }
      }, RECORDING_MAX_SEC * 1000);
    } catch (error) {
      append(`B: 録音を開始できない: ${String(error)}`);
      setRecordingB(false);
    }
  }, [append, uploadRecording]);

  const stopB = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  // ── 5. 閲覧（署名URL で再生）─────────────────────────────
  const loadPlayback = useCallback(async () => {
    if (!uploaded) {
      return;
    }
    try {
      const urls = await getViewUrls([uploaded.r2Key]);
      setPlaybackUrl(urls[uploaded.r2Key] ?? null);
      append(`閲覧URL 取得 ${urls[uploaded.r2Key] ? '成功' : '失敗'}`);
    } catch (error) {
      append(`閲覧URL 取得で例外: ${String(error)}`);
    }
  }, [uploaded, append]);

  // ── 6. 実データへ紐づけ（閲覧Web で鳴るか確かめるため）────
  const attachToAnswer = useCallback(
    async (answerId: string) => {
      if (!uploaded) {
        return;
      }
      const saved = await saveRecordingRow(answerId, uploaded.r2Key, uploaded.durationSec);
      append(saved.ok ? `recordings 紐づけ成功 → ${answerId}` : `紐づけ失敗: ${saved.message}`);
    },
    [uploaded, append],
  );

  // ── 7. 写真（選択 → 圧縮 → PUT → 表示）──────────────────
  const runPhoto = useCallback(async () => {
    try {
      const picked = await pickPhotos(1);
      if (!picked || picked.length === 0) {
        append('写真: えらばれなかった');
        return;
      }
      const original = picked[0];
      const originalBlob = await (await fetch(original.uri)).blob();
      append(
        `写真: 元 ${original.width}x${original.height} / ${originalBlob.type} / ${formatBytes(originalBlob.size)}`,
      );

      const compressed = await compressPhoto(original);
      const blob = await (await fetch(compressed.uri)).blob();
      append(`写真: 圧縮後 ${blob.type} / ${formatBytes(blob.size)}`);
      if (blob.type !== 'image/jpeg') {
        append('写真: JPEG になっていない（worker は image/jpeg 固定で配信するので要対処）');
      }

      const [target] = await getUploadUrls('photo', 1);
      const response = await fetch(target.uploadUrl, { method: 'PUT', body: blob });
      if (!response.ok) {
        append(`写真: PUT 失敗 ${response.status} ${await response.text()}`);
        return;
      }
      append(`写真: PUT 成功 → ${target.r2Key}`);
      // photos 行は作らない（検証用の写真を博物館に出さないため。R2 の孤児はチケット18 が回収する）
      const urls = await getViewUrls([target.r2Key]);
      setPhotoUrl(urls[target.r2Key] ?? null);
    } catch (error) {
      append(`写真: 例外 ${String(error)}`);
    }
  }, [append]);

  const copyLog = useCallback(() => {
    void navigator.clipboard.writeText(log.join('\n'));
  }, [log]);

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">Web けんしょう</AppText>

        <AppCard style={styles.card}>
          <AppText variant="cardTitle">2. マイクの許可</AppText>
          <AppText variant="caption">
            この画面を開いただけでダイアログが出たかどうかを先に見てから押すこと。
          </AppText>
          <SecondaryButton label="許可の状態をしらべる" onPress={() => void checkPermission()} />
          {permissionNote ? <AppText variant="caption">{permissionNote}</AppText> : null}
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="cardTitle">3-A. expo-audio の Web recorder</AppText>
          <AppText variant="caption">
            {recorderAState.isRecording
              ? `録音中 ${Math.floor(recorderAState.durationMillis / 1000)} 秒`
              : 'とまっています'}
          </AppText>
          <SecondaryButton label="A で録音をはじめる" onPress={() => void startA()} />
          <SecondaryButton label="A をとめる（→ 計測＋PUT）" onPress={() => void stopA()} />
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="cardTitle">3-B. 素の MediaRecorder</AppText>
          <AppText variant="caption">{recordingB ? '録音中' : 'とまっています'}</AppText>
          <SecondaryButton label="B で録音をはじめる" onPress={() => void startB()} />
          <SecondaryButton label="B をとめる（→ 計測＋PUT）" onPress={stopB} />
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="cardTitle">5. R2 から再生</AppText>
          <AppText variant="caption">{uploaded ? uploaded.r2Key : 'まだ上げていません'}</AppText>
          <SecondaryButton label="閲覧URLをとる" onPress={() => void loadPlayback()} />
          <SecondaryButton
            label={playerStatus.playing ? 'とめる' : '聞いてみる'}
            disabled={!playbackUrl}
            onPress={() => {
              if (playerStatus.playing) {
                player.pause();
                return;
              }
              void player.seekTo(0).then(() => player.play());
            }}
          />
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="cardTitle">6. 回答に紐づける（閲覧Web で鳴るか）</AppText>
          {answers.length === 0 ? (
            <AppText variant="caption">回答がありません</AppText>
          ) : (
            answers.map((answer) => (
              <SecondaryButton
                key={answer.id}
                disabled={!uploaded}
                label={(answer.custom_title ?? answer.body_text).slice(0, 18) || '（無題）'}
                onPress={() => void attachToAnswer(answer.id)}
              />
            ))
          )}
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="cardTitle">7. 写真</AppText>
          <SecondaryButton label="写真をえらんで 圧縮＋PUT" onPress={() => void runPhoto()} />
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" />
          ) : null}
        </AppCard>

        <AppCard style={styles.card}>
          <AppText variant="cardTitle">ログ</AppText>
          <SecondaryButton label="ログをコピー" onPress={copyLog} />
          <View style={styles.logBox}>
            {log.map((line, index) => (
              <AppText key={`${index}-${line}`} variant="caption" style={styles.logLine}>
                {line}
              </AppText>
            ))}
          </View>
        </AppCard>
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  card: {
    gap: spacing.md,
  },
  photo: {
    aspectRatio: 1,
    backgroundColor: colors.skyBottom,
    width: '100%',
  },
  logBox: {
    gap: spacing.xs,
  },
  logLine: {
    color: colors.textSoft,
  },
});
