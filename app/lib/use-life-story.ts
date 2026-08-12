/**
 * じぶん史（life_story 行。subject 毎に1本）を取得するフック（チケット12・19）。
 * use-recording.ts と同じ構造の単数版。画面フォーカス毎に再取得する。
 *
 * オフライン対応（チケット19。use-prompts / use-board-photos も同型）：
 * - 通信より先に端末キャッシュを出す。オフラインでも待たせず、つながっていても
 *   「前に見たもの」が先に出てから最新に置きかわる（お医者さんナビ方式）
 * - **error を立てるのは見せるものが何一つ無いときだけ**。キャッシュで表示できて
 *   いるなら error は null のまま（画面側の !error ゲートをそのまま活かすための契約）
 * - つながっていないと分かっているならサーバーに行かない（postgrest は GET を
 *   1/2/4 秒あけて3回やり直すので、待つと画面が数秒固まる）
 * - isOnline を依存に入れているので、電波が戻るとフォーカス中の画面は自動で取り直す
 * - キャッシュするのは自分の博物館だけ（targetSubjectId 指定＝家族の閲覧は残さない。
 *   理由は lib/offline-cache.ts の判断コメント）
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { cacheKeys, readCache, writeCache } from '@/lib/offline-cache';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/lib/use-online';
import type { Tables } from '@/types/database.types';

export type LifeStory = Tables<'life_story'>;

type LifeStoryState = {
  story: LifeStory | null;
  loading: boolean;
  error: string | null;
};

type CachedLifeStory = { story: LifeStory | null };

const LOAD_ERROR_MESSAGE = 'じぶん史をよみこめませんでした。';

/** @param targetSubjectId 家族として見る対象の subject（チケット16）。省略時は自分の博物館 */
export function useLifeStory(targetSubjectId?: string) {
  const { subject } = useAuth();
  const isOnline = useIsOnline();
  const subjectId = targetSubjectId ?? subject?.id ?? null;
  const cacheKey =
    targetSubjectId === undefined && subjectId ? cacheKeys.story(subjectId) : null;

  const [state, setState] = useState<LifeStoryState>({
    story: null,
    loading: subjectId !== null,
    error: null,
  });
  // 何かを表示できた（2回目以降のフォーカスでローディングを出さない。ちらつき防止）
  const hasLoadedRef = useRef(false);
  // サーバーから取れた（遅れて届いたキャッシュで新しい内容を上書きしない）
  const hasFreshRef = useRef(false);
  // キャッシュの読み出しを試した（1回だけ）
  const hydratedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!subjectId) {
      setState({ story: null, loading: false, error: null });
      return;
    }
    if (!hasLoadedRef.current) {
      setState((prev) => ({ ...prev, loading: true }));
    }

    if (cacheKey && !hydratedRef.current) {
      hydratedRef.current = true;
      const cached = await readCache<CachedLifeStory>(cacheKey);
      if (cached && !hasFreshRef.current) {
        hasLoadedRef.current = true;
        setState({ story: cached.story, loading: false, error: null });
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

    const { data, error } = await supabase
      .from('life_story')
      .select('*')
      .eq('subject_id', subjectId)
      .maybeSingle();
    if (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: hasLoadedRef.current ? null : LOAD_ERROR_MESSAGE,
      }));
      return;
    }
    hasLoadedRef.current = true;
    hasFreshRef.current = true;
    setState({ story: data, loading: false, error: null });
    if (cacheKey) {
      void writeCache(cacheKey, { story: data } satisfies CachedLifeStory);
    }
  }, [subjectId, cacheKey, isOnline]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return { ...state, refetch };
}
