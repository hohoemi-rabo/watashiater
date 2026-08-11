/**
 * 録音の保存の道具箱（React 非依存。チケット10。photo-attach.ts の鏡）。
 * 保存順序は「R2 へ PUT → answers 行の用意 → recordings upsert」：
 * いちばん多い失敗（電波）は PUT の段階で出尽くすので、空の answers 行が残る
 * 失敗経路がほぼ無く、失敗時の後始末分岐が要らない（判断はチケット10メモ）。
 */
import { supabase } from '@/lib/supabase';
import { WorkerApiError, getUploadUrls, putObject } from '@/lib/worker-api';

/** REQUIREMENTS §4.2「最長3分」。native の record({ forDuration }) に渡す値 */
export const RECORDING_MAX_SEC = 180;
/** JS 予備停止の上限（native が止め損ねた場合＋1秒の猶予）。DB の CHECK (0..181) と揃える */
export const RECORDING_HARD_CAP_SEC = 181;

const UPLOAD_ERROR_MESSAGE =
  'のこせませんでした。でんぱの よいところで もういちど ためしてください。';

export type UploadFileResult = { ok: true; r2Key: string } | { ok: false; message: string };

/** 録音ファイルを worker の署名URLで R2 へ上げる（DB には触らない） */
export async function uploadRecordingFile(localUri: string): Promise<UploadFileResult> {
  try {
    const [target] = await getUploadUrls('recording', 1);
    if (!target) {
      return { ok: false, message: UPLOAD_ERROR_MESSAGE };
    }
    await putObject(target.uploadUrl, localUri);
    return { ok: true, r2Key: target.r2Key };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

/** recordings 行を作成／置き換える（1回答1録音。録り直しも同じ経路） */
export async function saveRecordingRow(
  answerId: string,
  r2Key: string,
  durationSec: number,
): Promise<{ ok: boolean; message?: string }> {
  // DB の CHECK (0..181) と同じ範囲にクランプ（3分制限の多段防衛の一段）
  const clamped = Math.min(RECORDING_HARD_CAP_SEC, Math.max(0, Math.round(durationSec)));
  // answer_id は素の UNIQUE 制約なので upsert が使える（answers が upsert を避けたのは
  // 自由お題の unique が部分インデックスで onConflict 指定できないため。recordings は該当しない）。
  // 録り直しで置き換えられた旧 r2_key の R2 オブジェクトは孤児化を許容（docs/09 の方針・チケット18で回収）
  const { error } = await supabase
    .from('recordings')
    .upsert(
      { answer_id: answerId, r2_key: r2Key, duration_sec: clamped },
      { onConflict: 'answer_id' },
    );
  return error ? { ok: false, message: UPLOAD_ERROR_MESSAGE } : { ok: true };
}

/** DB 行のみ物理削除（R2 オブジェクトは残す。docs/09 の方針） */
export async function deleteRecording(recordingId: string): Promise<boolean> {
  const { error } = await supabase.from('recordings').delete().eq('id', recordingId);
  return !error;
}

function messageOf(error: unknown): string {
  return error instanceof WorkerApiError ? error.message : UPLOAD_ERROR_MESSAGE;
}
