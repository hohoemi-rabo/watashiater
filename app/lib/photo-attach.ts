/**
 * 写真添付の道具箱（React 非依存の純関数。チケット09）。
 * - 圧縮は長辺1600px・JPEG品質80（REQUIREMENTS §4.2）。worker は image/jpeg 固定で
 *   配信するため、元が PNG などでも必ず JPEG に再エンコードする
 * - 1お題5枚の上限はアプリ側で制御する（DB に上限は無い。REQUIREMENTS §3.2）
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import { WorkerApiError, getUploadUrls, putObject } from '@/lib/worker-api';

export const PHOTO_MAX_PER_ANSWER = 5;
const LONG_EDGE_MAX = 1600;
const JPEG_QUALITY = 0.8;

const UPLOAD_ERROR_MESSAGE =
  'のせられませんでした。でんぱの よいところで もういちど ためしてください。';

export type PickedPhoto = { uri: string; width: number; height: number };

/** フォトライブラリから最大 remaining 枚を選ぶ（Android は Photo Picker で権限不要）。やめたら null */
export async function pickPhotos(remaining: number): Promise<PickedPhoto[] | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: remaining > 1,
    selectionLimit: remaining,
  });
  if (result.canceled) {
    return null;
  }
  // selectionLimit を尊重しない端末があっても上限を越えないための保険
  return result.assets
    .slice(0, remaining)
    .map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height }));
}

/** 長辺が 1600px を超えるときだけ縮小し、常に JPEG（品質80）へ再エンコードする */
export async function compressPhoto(photo: PickedPhoto): Promise<{ uri: string }> {
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > LONG_EDGE_MAX) {
    // 片方だけ指定するとアスペクト比を保って自動計算される
    context.resize(
      photo.width >= photo.height ? { width: LONG_EDGE_MAX } : { height: LONG_EDGE_MAX },
    );
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return { uri: saved.uri };
}

export type UploadOutcome = {
  uploadedCount: number;
  /** 失敗して未アップロードのまま残った圧縮済み uri（リトライに使う） */
  failedUris: string[];
  errorMessage: string | null;
};

/**
 * 圧縮済み写真を1枚ずつ「PUT → photos 行 INSERT」で確定していく。
 * 最初の失敗で止め、成功分はそのまま・残りをリトライ対象として返す。
 * リトライはこの関数を failedUris で呼び直す（署名URLを取り直すので TTL に縛られない）
 */
export async function uploadCompressedPhotos(
  answerId: string,
  uris: string[],
  onProgress: (done: number, total: number) => void,
): Promise<UploadOutcome> {
  let targets;
  try {
    targets = await getUploadUrls('photo', uris.length);
  } catch (error) {
    return { uploadedCount: 0, failedUris: uris, errorMessage: messageOf(error) };
  }
  for (let i = 0; i < uris.length; i++) {
    try {
      await putObject(targets[i].uploadUrl, uris[i]);
      // PUT 成功後の INSERT 失敗はリトライで再アップロードになる（R2 に孤児が1つ残るのは許容。docs/09 メモ）
      const { error } = await supabase
        .from('photos')
        .insert({ answer_id: answerId, r2_key: targets[i].r2Key });
      if (error) {
        throw new WorkerApiError('db_insert', UPLOAD_ERROR_MESSAGE);
      }
    } catch (error) {
      return { uploadedCount: i, failedUris: uris.slice(i), errorMessage: messageOf(error) };
    }
    onProgress(i + 1, uris.length);
  }
  return { uploadedCount: uris.length, failedUris: [], errorMessage: null };
}

function messageOf(error: unknown): string {
  return error instanceof WorkerApiError ? error.message : UPLOAD_ERROR_MESSAGE;
}
