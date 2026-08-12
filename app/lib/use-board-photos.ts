/**
 * 机の上ボード用に subject の全写真を取得するフック（チケット13）。
 * 家風どおり並列フラットクエリ＋JS join（PostgREST の embed は使わない）。
 * - キャプション＝固定お題は prompts.title、自由お題は answers.custom_title
 * - スピーカーバッジ用に recordings の有無だけ引く（音声URLはチケット15で必要になってから）
 * - 署名URLは有効期限つきなのでキャッシュせず、フォーカスのたびに取り直す
 * - どの段の失敗も単一のエラー state（部分描画しない。use-photos と同じ方針）
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { getViewUrls } from '@/lib/worker-api';
import type { Tables } from '@/types/database.types';

export type BoardItem = {
  photo: Tables<'photos'>;
  caption: string;
  hasRecording: boolean;
  viewUrl: string | undefined;
};

type BoardPhotosState = {
  items: BoardItem[];
  loading: boolean;
  error: string | null;
};

const LOAD_ERROR_MESSAGE =
  '写真をよみこめませんでした。電波のよいところで、もういちどためしてください。';

export function useBoardPhotos() {
  const { subject } = useAuth();
  const subjectId = subject?.id ?? null;
  const [state, setState] = useState<BoardPhotosState>({
    items: [],
    loading: subjectId !== null,
    error: null,
  });
  // 2回目以降のフォーカス時はローディング表示を出さない（ちらつき防止。use-prompts と同じ）
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!subjectId) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    if (!hasLoadedRef.current) {
      setState((prev) => ({ ...prev, loading: true }));
    }
    const fail = () => setState((prev) => ({ ...prev, loading: false, error: LOAD_ERROR_MESSAGE }));

    const [answersResult, promptsResult] = await Promise.all([
      supabase.from('answers').select('*').eq('subject_id', subjectId),
      supabase.from('prompts').select('*'),
    ]);
    if (answersResult.error || promptsResult.error) {
      fail();
      return;
    }
    const answers = answersResult.data;
    const answerIds = answers.map((answer) => answer.id);
    if (answerIds.length === 0) {
      hasLoadedRef.current = true;
      setState({ items: [], loading: false, error: null });
      return;
    }

    // created_at だけでは全順序にならない（同時刻がありうる）。id で必ずタイブレークしないと
    // 「同じ seed で毎回同じ配置」が壊れる（board-layout.ts の契約）
    const [photosResult, recordingsResult] = await Promise.all([
      supabase
        .from('photos')
        .select('*')
        .in('answer_id', answerIds)
        .order('created_at')
        .order('id'),
      supabase.from('recordings').select('answer_id').in('answer_id', answerIds),
    ]);
    if (photosResult.error || recordingsResult.error) {
      fail();
      return;
    }
    const photos = photosResult.data;

    let viewUrls: Record<string, string> = {};
    try {
      viewUrls = await getViewUrls(photos.map((photo) => photo.r2_key));
    } catch {
      fail();
      return;
    }

    const promptTitleById = new Map(promptsResult.data.map((prompt) => [prompt.id, prompt.title]));
    const answerById = new Map(answers.map((answer) => [answer.id, answer]));
    const recordedAnswerIds = new Set(recordingsResult.data.map((row) => row.answer_id));

    const items: BoardItem[] = photos.map((photo) => {
      const answer = answerById.get(photo.answer_id);
      const caption =
        (answer?.prompt_id !== null && answer?.prompt_id !== undefined
          ? promptTitleById.get(answer.prompt_id)
          : answer?.custom_title) ?? 'じぶんのお題';
      return {
        photo,
        caption,
        hasRecording: recordedAnswerIds.has(photo.answer_id),
        viewUrl: viewUrls[photo.r2_key],
      };
    });

    hasLoadedRef.current = true;
    setState({ items, loading: false, error: null });
  }, [subjectId]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return { ...state, refetch };
}
