/**
 * じぶん史（life_story 行。subject 毎に1本）を取得するフック（チケット12）。
 * use-recording.ts と同じ構造の単数版。画面フォーカス毎に再取得する。
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database.types';

export type LifeStory = Tables<'life_story'>;

type LifeStoryState = {
  story: LifeStory | null;
  loading: boolean;
  error: string | null;
};

const LOAD_ERROR_MESSAGE = 'じぶん史をよみこめませんでした。';

export function useLifeStory() {
  const { subject } = useAuth();
  const subjectId = subject?.id ?? null;
  const [state, setState] = useState<LifeStoryState>({
    story: null,
    loading: subjectId !== null,
    error: null,
  });
  // 2回目以降のフォーカス時はローディング表示を出さない（ちらつき防止。use-prompts と同じ）
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!subjectId) {
      setState({ story: null, loading: false, error: null });
      return;
    }
    if (!hasLoadedRef.current) {
      setState((prev) => ({ ...prev, loading: true }));
    }
    const { data, error } = await supabase
      .from('life_story')
      .select('*')
      .eq('subject_id', subjectId)
      .maybeSingle();
    if (error) {
      setState((prev) => ({ ...prev, loading: false, error: LOAD_ERROR_MESSAGE }));
      return;
    }
    hasLoadedRef.current = true;
    setState({ story: data, loading: false, error: null });
  }, [subjectId]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return { ...state, refetch };
}
