/**
 * mic-level.ts の Web 実装（チケット26）。Web の RecorderState には metering が無いので、
 * expo-audio 内部の MediaRecorder が使っている MediaStream に AnalyserNode を繋いで
 * 実レベルを読む（DESIGN §8：波形は実データ駆動＝装飾の常時ループにしない）。
 * 同一ストリームへの接続なので2本目の getUserMedia は不要
 * （iOS Safari は複数ストリームで先行ストリームが無音化しうるため、ここが重要）。
 *
 * recorder.mediaRecorder は expo-audio（~1.1.1）の .d.ts では private だが、ランタイムでは
 * 素の public フィールド（AudioModule.web.js を実読して確認。存在期間は
 * prepareToRecordAsync() 解決後〜stop() 冒頭）。内部 API 依存はこのファイルに閉じ、
 * expo-audio 更新で形が変わった場合は read() が undefined を返して波形が非表示に
 * 劣化するだけで、録音そのものは壊れない設計にしてある。
 *
 * AudioContext はモジュールで1個だけ作って使い回す（Safari は生成数に上限がある）。
 * 生成はユーザージェスチャの同期スタック内（prime()）で行う：await を挟んだ後の生成は
 * Safari の自動再生制限で suspended のまま戻らないことがある
 */

type RecorderInternals = { mediaRecorder?: { stream?: MediaStream } | null };

/** native 側 toLevel と同じ床（dBFS）。波形の見た目のスケールをネイティブと揃える */
const METER_FLOOR_DB = 60;

let ctx: AudioContext | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let buffer: Uint8Array<ArrayBuffer> | null = null;

export const micLevelMeter = {
  prime(): void {
    if (!ctx && typeof AudioContext !== 'undefined') {
      ctx = new AudioContext();
    }
  },
  attach(recorder: unknown): void {
    micLevelMeter.detach();
    const stream = (recorder as RecorderInternals).mediaRecorder?.stream;
    if (!ctx || !stream) {
      return;
    }
    void ctx.resume();
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    buffer = new Uint8Array(analyser.fftSize);
    source.connect(analyser);
    // AnalyserNode は出力先に繋がなくても解析できる（スピーカーへは流さない＝エコーしない）
  },
  read(): number | undefined {
    if (!analyser || !buffer) {
      return undefined;
    }
    analyser.getByteTimeDomainData(buffer);
    let sumSquares = 0;
    for (const value of buffer) {
      const centered = (value - 128) / 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / buffer.length);
    if (rms <= 0) {
      return 0;
    }
    // RMS → dBFS → 0〜1。native の toLevel（metering dBFS 基準）と同じ正規化
    const db = 20 * Math.log10(rms);
    return Math.min(1, Math.max(0, (db + METER_FLOOR_DB) / METER_FLOOR_DB));
  },
  detach(): void {
    source?.disconnect();
    source = null;
    analyser = null;
    buffer = null;
  },
};
