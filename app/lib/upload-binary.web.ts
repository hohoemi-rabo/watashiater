/**
 * upload-binary.ts の Web 実装（チケット26）。fileUri は blob: URL
 * （expo-audio の録音・expo-image-manipulator の圧縮写真とも）なので、
 * fetch で Blob に戻してから署名URLへ PUT する。Blob body なら Content-Length が
 * 自動で付き、worker の 411（Content-Length 必須）を満たす（docs/24 実測）。
 * 追加ヘッダーは付けない（CORS プリフライトを増やさない。実測で通った形を保つ）
 */
import type { UploadBinaryResult } from './upload-binary';

export async function uploadBinary(
  uploadUrl: string,
  fileUri: string,
): Promise<UploadBinaryResult> {
  const blob = await (await fetch(fileUri)).blob();
  const response = await fetch(uploadUrl, { method: 'PUT', body: blob });
  return { status: response.status, body: await response.text() };
}
