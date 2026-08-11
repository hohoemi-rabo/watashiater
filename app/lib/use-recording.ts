/**
 * 回答の録音（recordings 行。1回答1録音）と閲覧用署名URLを取得するフック（チケット10）。
 * use-photos.ts と同じ構造の単数版。
 * - answerId が null（まだ回答行が無い）のときは空で確定する
 * - 署名URLは有効期限つきなのでキャッシュせず、フォーカスのたびに取り直す
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { getViewUrls } from '@/lib/worker-api';
import type { Tables } from '@/types/database.types';

export type Recording = Tables<'recordings'>;

type RecordingRowState = {
  recording: Recording | null;
  viewUrl: string | null;
  loading: boolean;
  error: string | null;
};

const LOAD_ERROR_MESSAGE = '声を よみこめませんでした。';

export function useRecording(answerId: string | null) {
  const [state, setState] = useState<RecordingRowState>({
    recording: null,
    viewUrl: null,
    loading: answerId !== null,
    error: null,
  });
  // 2回目以降のフォーカス時はローディング表示を出さない（ちらつき防止。use-prompts と同じ）
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(
    async (overrideAnswerId?: string) => {
      // 行を作った直後は closure の answerId が古いことがあるため、呼び出し側が
      // 作りたての id を明示的に渡せるようにする（チケット09で実際に起きたバグの教訓）
      const targetId = overrideAnswerId ?? answerId;
      if (!targetId) {
        setState({ recording: null, viewUrl: null, loading: false, error: null });
        return;
      }
      if (!hasLoadedRef.current) {
        setState((prev) => ({ ...prev, loading: true }));
      }
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('answer_id', targetId)
        .maybeSingle();
      if (error) {
        setState((prev) => ({ ...prev, loading: false, error: LOAD_ERROR_MESSAGE }));
        return;
      }
      let viewUrl: string | null = null;
      if (data) {
        try {
          const urls = await getViewUrls([data.r2_key]);
          viewUrl = urls[data.r2_key] ?? null;
        } catch {
          setState((prev) => ({ ...prev, loading: false, error: LOAD_ERROR_MESSAGE }));
          return;
        }
      }
      hasLoadedRef.current = true;
      setState({ recording: data, viewUrl, loading: false, error: null });
    },
    [answerId],
  );

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return { ...state, refetch };
}
