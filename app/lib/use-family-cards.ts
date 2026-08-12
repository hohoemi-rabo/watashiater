/**
 * 家族向けの「お題カード一覧」データ（チケット16。読み取り専用）。
 * 対象 subject の回答済みカードを、固定お題は sort_order 順・自由お題は最後で返す。
 * 家風どおり並列フラットクエリ＋JS join。閲覧可否は RLS が決める。
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type FamilyCard = {
  answerId: string;
  title: string;
  bodyText: string;
  hasRecording: boolean;
};

type FamilyCardsState = {
  cards: FamilyCard[];
  loading: boolean;
  error: string | null;
};

const LOAD_ERROR_MESSAGE =
  'よみこめませんでした。電波のよいところで、もういちどためしてください。';

export function useFamilyCards(subjectId: string | null) {
  const [state, setState] = useState<FamilyCardsState>({
    cards: [],
    loading: subjectId !== null,
    error: null,
  });
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!subjectId) {
      setState({ cards: [], loading: false, error: null });
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
    if (answers.length === 0) {
      hasLoadedRef.current = true;
      setState({ cards: [], loading: false, error: null });
      return;
    }

    const recordingsResult = await supabase
      .from('recordings')
      .select('answer_id')
      .in(
        'answer_id',
        answers.map((answer) => answer.id),
      );
    if (recordingsResult.error) {
      fail();
      return;
    }
    const recordedAnswerIds = new Set(recordingsResult.data.map((row) => row.answer_id));
    const sortOrderByPromptId = new Map(promptsResult.data.map((p) => [p.id, p.sort_order]));
    const promptTitleById = new Map(promptsResult.data.map((p) => [p.id, p.title]));

    const cards: FamilyCard[] = answers
      .map((answer) => ({
        answerId: answer.id,
        title:
          (answer.prompt_id !== null
            ? promptTitleById.get(answer.prompt_id)
            : answer.custom_title) ?? 'じぶんのお題',
        bodyText: answer.body_text,
        hasRecording: recordedAnswerIds.has(answer.id),
        // 自由お題（prompt_id null）は最後
        sortKey:
          answer.prompt_id !== null
            ? (sortOrderByPromptId.get(answer.prompt_id) ?? Number.MAX_SAFE_INTEGER - 1)
            : Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ sortKey: _sortKey, ...card }) => card);

    hasLoadedRef.current = true;
    setState({ cards, loading: false, error: null });
  }, [subjectId]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return { ...state, refetch };
}
