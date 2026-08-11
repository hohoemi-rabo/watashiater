/**
 * 回答に添付された写真（photos 行）と閲覧用署名URLをまとめて取得するフック（チケット09）。
 * - answerId が null（まだ回答行が無い）のときは空で確定する
 * - 署名URLは有効期限つきなのでキャッシュせず、フォーカスのたびに取り直す。
 *   画像本体は expo-image が r2_key の cacheKey でディスクキャッシュする（PhotoStrip 側）
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { getViewUrls } from '@/lib/worker-api';
import type { Tables } from '@/types/database.types';

export type Photo = Tables<'photos'>;

type PhotosState = {
  photos: Photo[];
  viewUrls: Record<string, string>;
  loading: boolean;
  error: string | null;
};

const LOAD_ERROR_MESSAGE = '写真を よみこめませんでした。';

export function usePhotos(answerId: string | null) {
  const [state, setState] = useState<PhotosState>({
    photos: [],
    viewUrls: {},
    loading: answerId !== null,
    error: null,
  });
  // 2回目以降のフォーカス時はローディング表示を出さない（ちらつき防止。use-prompts と同じ）
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(
    async (overrideAnswerId?: string) => {
      // 回答行を作った直後は answerId(state 由来) がまだ古い closure に残っているため、
      // 呼び出し側が作りたての id を明示的に渡せるようにする
      //（実機で「のせた直後に写真が出ない」バグの原因だった。値は引数で流す＝チケット04の教訓）
      const targetId = overrideAnswerId ?? answerId;
      if (!targetId) {
        setState({ photos: [], viewUrls: {}, loading: false, error: null });
        return;
      }
      if (!hasLoadedRef.current) {
        setState((prev) => ({ ...prev, loading: true }));
      }
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('answer_id', targetId)
        .order('created_at');
      if (error) {
        setState((prev) => ({ ...prev, loading: false, error: LOAD_ERROR_MESSAGE }));
        return;
      }
      let viewUrls: Record<string, string> = {};
      try {
        viewUrls = await getViewUrls(data.map((photo) => photo.r2_key));
      } catch {
        setState((prev) => ({ ...prev, loading: false, error: LOAD_ERROR_MESSAGE }));
        return;
      }
      hasLoadedRef.current = true;
      setState({ photos: data, viewUrls, loading: false, error: null });
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
