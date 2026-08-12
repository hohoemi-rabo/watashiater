/**
 * 閲覧専用URL（見せる用リンク）の発行・無効化（チケット17。REQUIREMENTS §3.5(b) / §4.3）。
 * - スラッグは小文字 base32 風の32文字×16桁（5bit×16=80bit＝「十分に長い」）。
 *   リンクはタップで開くもので手入力しないため、紛らわしい文字の除外はしない。
 *   256 % 32 === 0 なので剰余の偏りなし
 * - 有効リンクは subject につき1本（DB の partial unique）。新規 INSERT の 23505 は
 *   スラッグ衝突と「有効リンクが残っている」の区別がつかないため、
 *   **呼び出し側は必ず無効化してから作る**規約（再発行＝止めて作り直す2段階）
 * - 無効化は worker の slug 照会（is_active=true）に即座に効く。既発行の署名付き
 *   メディアURLだけは最長1時間生き残る（docs/08 の受容済み設計）
 */
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database.types';

export type ViewLink = Tables<'view_links'>;

const webUrl = process.env.EXPO_PUBLIC_WEB_URL;

if (!webUrl) {
  // .env の作り忘れ（新規クローン時）を起動時に明確に知らせる（worker-api.ts と同じ）
  throw new Error(
    'EXPO_PUBLIC_WEB_URL が設定されていません。app/.env を用意してください（.env.example 参照）',
  );
}

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const SLUG_LENGTH = 16;

const CREATE_ERROR_MESSAGE =
  'リンクをつくれませんでした。電波のよいところで、もういちどためしてください。';
const DEACTIVATE_ERROR_MESSAGE =
  'リンクを止められませんでした。電波のよいところで、もういちどためしてください。';

function generateSlug(): string {
  const bytes = Crypto.getRandomBytes(SLUG_LENGTH);
  return Array.from(bytes, (byte) => SLUG_ALPHABET[byte % SLUG_ALPHABET.length]).join('');
}

/** 家族に送る完全なURL（例: https://…/w/xxxxxxxxxxxxxxxx） */
export function buildViewUrl(slug: string): string {
  return `${webUrl}/w/${slug}`;
}

export type CreateViewLinkResult = { ok: true; link: ViewLink } | { ok: false; message: string };

/**
 * 新しい見せる用リンクを発行する。有効リンクが残っていると partial unique で失敗するので、
 * 呼び出し側で無効化してから呼ぶこと。スラッグ衝突（実質起きない）は作り直して最大3回
 */
export async function createViewLink(subjectId: string): Promise<CreateViewLinkResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from('view_links')
      .insert({ subject_id: subjectId, slug: generateSlug() })
      .select()
      .single();
    if (!error) {
      return { ok: true, link: data };
    }
    if (error.code !== '23505') {
      break;
    }
  }
  return { ok: false, message: CREATE_ERROR_MESSAGE };
}

/** リンクを止める（is_active=false）。以後 worker の slug 照会は 403 になる */
export async function deactivateViewLink(
  linkId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from('view_links')
    .update({ is_active: false })
    .eq('id', linkId);
  if (error) {
    return { ok: false, message: DEACTIVATE_ERROR_MESSAGE };
  }
  return { ok: true };
}

/** いま有効なリンク（partial unique により最大1本）。画面の再訪で同じリンクを見せる */
export async function fetchActiveViewLink(
  subjectId: string,
): Promise<{ ok: boolean; link: ViewLink | null }> {
  const { data, error } = await supabase
    .from('view_links')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) {
    return { ok: false, link: null };
  }
  return { ok: true, link: data };
}
