/**
 * お題（prompts）と自分の回答（answers）をまとめて取得するフック。
 * ホーム・お題一覧・回答画面で共用する。
 *
 * - 「回答済み」の定義は「answers に行が存在する」（チケット06が保存時に行を作る）
 * - 進捗（answeredCount）は固定10問のみ数える（自由お題は含めない。
 *   REQUIREMENTS §7-2「10このうち 4つ こたえました」）
 * - 画面フォーカスのたびに再取得する（回答して戻ったとき一覧と進捗を追随させる）
 * - オフライン対応（チケット19）は use-life-story.ts と同型（判断コメントはそちら）
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { cacheKeys, readCache, writeCache } from '@/lib/offline-cache';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/lib/use-online';
import type { Tables } from '@/types/database.types';

export type Prompt = Tables<'prompts'>;
export type Answer = Tables<'answers'>;
export type PromptListItem = { prompt: Prompt; answer: Answer | null };

type PromptsState = {
  items: PromptListItem[];
  freeAnswer: Answer | null;
  loading: boolean;
  error: string | null;
};

type CachedPrompts = { items: PromptListItem[]; freeAnswer: Answer | null };

const LOAD_ERROR_MESSAGE =
  'よみこめませんでした。でんぱの よいところで もういちど ためしてください。';

export function usePrompts() {
  const { subject } = useAuth();
  const isOnline = useIsOnline();
  const subjectId = subject?.id ?? null;
  const cacheKey = subjectId ? cacheKeys.prompts(subjectId) : null;
  const [state, setState] = useState<PromptsState>({
    items: [],
    freeAnswer: null,
    loading: true,
    error: null,
  });
  // 2回目以降のフォーカス時はローディング表示を出さない（ちらつき防止）
  const hasLoadedRef = useRef(false);
  const hasFreshRef = useRef(false);
  const hydratedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!subjectId) {
      return;
    }
    if (!hasLoadedRef.current) {
      setState((prev) => ({ ...prev, loading: true }));
    }

    if (cacheKey && !hydratedRef.current) {
      hydratedRef.current = true;
      const cached = await readCache<CachedPrompts>(cacheKey);
      if (cached && !hasFreshRef.current) {
        hasLoadedRef.current = true;
        setState({
          items: cached.items,
          freeAnswer: cached.freeAnswer,
          loading: false,
          error: null,
        });
      }
    }

    if (!isOnline) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: hasLoadedRef.current ? null : LOAD_ERROR_MESSAGE,
      }));
      return;
    }

    const [promptsResult, answersResult] = await Promise.all([
      supabase.from('prompts').select('*').order('sort_order'),
      supabase.from('answers').select('*').eq('subject_id', subjectId),
    ]);
    if (promptsResult.error || answersResult.error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: hasLoadedRef.current ? null : LOAD_ERROR_MESSAGE,
      }));
      return;
    }
    hasLoadedRef.current = true;
    hasFreshRef.current = true;
    const answers = answersResult.data;
    const items = promptsResult.data.map((prompt) => ({
      prompt,
      answer: answers.find((a) => a.prompt_id === prompt.id) ?? null,
    }));
    const freeAnswer = answers.find((a) => a.prompt_id === null) ?? null;
    setState({ items, freeAnswer, loading: false, error: null });
    if (cacheKey) {
      void writeCache(cacheKey, { items, freeAnswer } satisfies CachedPrompts);
    }
  }, [subjectId, cacheKey, isOnline]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const answeredCount = state.items.filter((item) => item.answer !== null).length;

  return { ...state, answeredCount, refetch };
}
