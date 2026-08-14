/**
 * 署名URLへのバイナリ転送プリミティブ（チケット26で worker-api.ts から分離）。
 * Web は upload-binary.web.ts に差し替わる。ファイルごと分けるのは import する
 * モジュール自体が違うため（CLAUDE.md の分岐基準1）：legacy FileSystem は Web では
 * 全メソッドが throw する shim で、Platform.OS 分岐だと import が Web バンドルに残り、
 * 「実装の穴がネットワークエラーに化ける」事故（docs/24）の温床になる。
 * エラーの意味づけ（WorkerApiError への変換）は呼び出し元 worker-api.ts の担当なので、
 * ここでは try/catch しない。
 *
 * legacy の uploadAsync を使う判断（チケット09）：native スタックが既知長ファイルを
 * 送るため、worker が必須にしている Content-Length が確実に付く。SDK 54 の expo/fetch は
 * File body 時の Content-Length 送出が docs に明記されていないため採らなかった
 */
import * as FileSystem from 'expo-file-system/legacy';

export type UploadBinaryResult = { status: number; body: string };

export async function uploadBinary(
  uploadUrl: string,
  fileUri: string,
): Promise<UploadBinaryResult> {
  const result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  return { status: result.status, body: result.body };
}
