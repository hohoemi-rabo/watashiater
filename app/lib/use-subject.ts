/**
 * 対象 subject（博物館）1件を取得するフック（チケット16。家族の閲覧画面用）。
 * use-life-story と同じ構造。家族に見えるかどうかは RLS（subjects_select）が決める：
 * 書き手が家族登録を解除すると data が null になるので、画面は
 * 「見られなくなりました」を出す（エラーとは区別する）。
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database.types';

type SubjectState = {
  subject: Tables<'subjects'> | null;
  loading: boolean;
  error: string | null;
};

const LOAD_ERROR_MESSAGE =
  'よみこめませんでした。電波のよいところで、もういちどためしてください。';

export function useSubject(subjectId: string | null) {
  const [state, setState] = useState<SubjectState>({
    subject: null,
    loading: subjectId !== null,
    error: null,
  });
  // 2回目以降のフォーカス時はローディング表示を出さない（ちらつき防止。use-prompts と同じ）
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!subjectId) {
      setState({ subject: null, loading: false, error: null });
      return;
    }
    if (!hasLoadedRef.current) {
      setState((prev) => ({ ...prev, loading: true }));
    }
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', subjectId)
      .maybeSingle();
    if (error) {
      setState((prev) => ({ ...prev, loading: false, error: LOAD_ERROR_MESSAGE }));
      return;
    }
    hasLoadedRef.current = true;
    setState({ subject: data, loading: false, error: null });
  }, [subjectId]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return { ...state, refetch };
}
