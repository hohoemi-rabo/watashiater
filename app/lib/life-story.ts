/**
 * じぶん史の保存の道具箱（React 非依存。チケット12。recording-attach.ts の鏡）。
 * - 生成結果の保存は upsert：life_story.subject_id は素の UNIQUE 制約なので
 *   onConflict が使える（recordings と同じ。answers が upsert を避けた事情は該当しない）
 * - generated_at は DB 側で自動更新されないため、再生成の上書きでも明示的に入れる
 */
import { supabase } from '@/lib/supabase';
import type { LifeStoryAnswer } from '@/lib/worker-api';
import type { Tables } from '@/types/database.types';

type PromptListItem = { prompt: Tables<'prompts'>; answer: Tables<'answers'> | null };

/** worker 側の1回答あたり本文上限（worker/src/ai.ts の MAX_BODY_LENGTH と同値） */
const WORKER_BODY_MAX = 8000;

const SAVE_ERROR_MESSAGE =
  'できあがった文章をまだほぞんできていません。電波のよいところで、もういちどためしてください。';
const EDIT_ERROR_MESSAGE =
  'ほぞんできませんでした。電波のよいところで、もういちどためしてください。';

/**
 * 回答一覧 → worker へ送るペイロード。
 * - body_text が空（写真・声だけの回答）は送らない（docs/11 の申し送り）
 * - 固定お題は表示順（items は sort_order 済み）、自由お題は最後に custom_title を題名として
 */
export function buildLifeStoryAnswers(
  items: PromptListItem[],
  freeAnswer: Tables<'answers'> | null,
): LifeStoryAnswer[] {
  const result: LifeStoryAnswer[] = [];
  for (const { prompt, answer } of items) {
    const body = answer?.body_text.trim() ?? '';
    if (body !== '') {
      result.push({ title: prompt.title, body: body.slice(0, WORKER_BODY_MAX) });
    }
  }
  const freeBody = freeAnswer?.body_text.trim() ?? '';
  if (freeAnswer && freeBody !== '') {
    // 自由お題の行には custom_title が必ずある（DB の CHECK）。万一の欠落は既定の題名で救う
    result.push({
      title: freeAnswer.custom_title ?? 'じぶんのお題',
      body: freeBody.slice(0, WORKER_BODY_MAX),
    });
  }
  return result;
}

/** 生成結果の保存（subject 毎に1本。再生成は上書き）。編集フラグは倒す */
export async function saveLifeStory(
  subjectId: string,
  bodyText: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('life_story').upsert(
    {
      subject_id: subjectId,
      body_text: bodyText,
      edited_by_user: false,
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'subject_id' },
  );
  return error ? { ok: false, message: SAVE_ERROR_MESSAGE } : { ok: true };
}

/** 手動編集の保存（edited_by_user を立てる。generated_at は生成時刻のまま触らない） */
export async function saveManualEdit(
  storyId: string,
  bodyText: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from('life_story')
    .update({ body_text: bodyText, edited_by_user: true })
    .eq('id', storyId);
  return error ? { ok: false, message: EDIT_ERROR_MESSAGE } : { ok: true };
}
