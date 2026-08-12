/**
 * Cloudflare Worker（メディアの門番）クライアント。
 * R2 の写真・音声はアプリから直接触らず、必ず worker の署名URLを通す（CLAUDE.md アーキテクチャ）。
 * - 認証は Supabase のアクセストークン（worker 側が公開 JWKS で検証する）
 * - worker のエラー応答は日本語 message を持つので、そのまま画面に出せる WorkerApiError にして投げる
 */
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';

const workerUrl = process.env.EXPO_PUBLIC_WORKER_URL;

if (!workerUrl) {
  // .env の作り忘れ（新規クローン時）を起動時に明確に知らせる
  throw new Error(
    'EXPO_PUBLIC_WORKER_URL が設定されていません。app/.env を用意してください（.env.example 参照）',
  );
}

const GENERIC_ERROR_MESSAGE =
  'つうしんに しっぱいしました。でんぱの よいところで もういちど ためしてください。';

export class WorkerApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** worker のエラー応答 {error:{code,message}} を WorkerApiError に変換する */
function toApiError(status: number, bodyText: string): WorkerApiError {
  try {
    const parsed = JSON.parse(bodyText) as { error?: { code?: string; message?: string } };
    if (parsed.error?.message) {
      return new WorkerApiError(parsed.error.code ?? 'unknown', parsed.error.message);
    }
  } catch {
    // JSON でない応答（通信機器のエラーページ等）は汎用文言に落とす
  }
  return new WorkerApiError(`http_${status}`, GENERIC_ERROR_MESSAGE);
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new WorkerApiError('no_session', 'ログインしなおしてください。');
  }
  return token;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${workerUrl}${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new WorkerApiError('network', GENERIC_ERROR_MESSAGE);
  }
  if (!response.ok) {
    throw toApiError(response.status, await response.text());
  }
  return (await response.json()) as T;
}

export type UploadTarget = { r2Key: string; uploadUrl: string };

/** アップロード用署名URLの発行（photo は1回につき最大5件、recording は1件。有効期限15分） */
export async function getUploadUrls(
  kind: 'photo' | 'recording',
  count: number,
): Promise<UploadTarget[]> {
  const { items } = await postJson<{ items: UploadTarget[] }>('/media/upload-urls', {
    kind,
    count,
  });
  return items;
}

/** 閲覧用署名URLの一括取得（r2_key → 署名URL。有効期限1時間なのでキャッシュしない） */
export async function getViewUrls(r2Keys: string[]): Promise<Record<string, string>> {
  if (r2Keys.length === 0) {
    return {};
  }
  const { urls } = await postJson<{ urls: Record<string, string> }>('/media/view-urls', {
    r2Keys,
  });
  return urls;
}

export type LifeStoryAnswer = { title: string; body: string };

/**
 * じぶん史の生成（チケット12。worker の AI 生成プロキシ経由）。
 * 1日3回まで・できあがるまで10〜30秒かかる（worker 側タイムアウト60秒）。
 * remaining は「今日あと何回つくれるか」。エラーは message をそのまま表示できる
 * WorkerApiError（429 レート制限の文言も worker が日本語で返す）
 */
export async function generateLifeStory(
  answers: LifeStoryAnswer[],
): Promise<{ bodyText: string; remaining: number }> {
  return postJson<{ bodyText: string; remaining: number }>('/ai/life-story', { answers });
}

/**
 * 署名URLへファイル本体を PUT する。
 * legacy の uploadAsync を使う判断（チケット09）：native スタックが既知長ファイルを
 * 送るため、worker が必須にしている Content-Length が確実に付く。SDK 54 の expo/fetch は
 * File body 時の Content-Length 送出が docs に明記されていないため採らなかった
 */
export async function putObject(uploadUrl: string, fileUri: string): Promise<void> {
  let result: FileSystem.FileSystemUploadResult;
  try {
    result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
  } catch {
    throw new WorkerApiError('network', GENERIC_ERROR_MESSAGE);
  }
  if (result.status !== 200) {
    throw toApiError(result.status, result.body);
  }
}
