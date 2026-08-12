/**
 * 机の上ボード用に subject の全写真を取得するフック（チケット13・15）。
 * 家風どおり並列フラットクエリ＋JS join（PostgREST の embed は使わない）。
 * - キャプション＝固定お題は prompts.title、自由お題は answers.custom_title
 * - 録音の署名URLは写真と同じ1バッチで取る（チケット15。タップ→声が出るまでの
 *   無音を作らない。worker は同一 subject なら写真＋録音の混在キーを受け付ける）
 * - 署名URLは有効期限つきなのでキャッシュせず、フォーカスのたびに取り直す
 * - どの段の失敗も単一のエラー state（部分描画しない。use-photos と同じ方針）
 *
 * オフライン対応（チケット19。骨格の判断コメントは use-life-story.ts）：
 * - 【「署名URLはキャッシュしない」原則の唯一の例外】オフライン閲覧用の端末キャッシュ
 *   にだけは、最後に取れた**写真の**閲覧URLを入れる。expo-image のディスクキャッシュは
 *   cacheKey（r2_key）で引くので、URL が期限切れでも絵がディスクにあれば通信せずに描ける。
 *   逆に uri を undefined にすると expo-image は何も探しに行かず、机の上が空になる。
 *   保存先はアプリ専用領域で、期限切れURLは誰の役にも立たない（1時間で失効し、再発行は
 *   必ず worker の JWT 検証を通る）ため、持ち出されても新しい権限を与えない。
 *   フォーカスのたびに取り直す原則（オンライン時）は変えない
 * - **録音の署名URLは入れない**：声はオンライン前提（チケット19のスコープ外）で、
 *   録音の実体を端末に残さない方針（docs/00・10）も変えない
 * - 配置（board_x/y/rotation/z）は photos 行の列なので別途キャッシュ不要。
 *   board_seed は auth スナップショット（lib/auth-context.tsx）から来る
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { cacheKeys, readCache, writeCache } from '@/lib/offline-cache';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/lib/use-online';
import { getViewUrls } from '@/lib/worker-api';
import type { Tables } from '@/types/database.types';

export type BoardItem = {
  photo: Tables<'photos'>;
  caption: string;
  /** 本文エピソード（'' あり＝声だけの回答。ライトボックスの「録音なし」表示用） */
  bodyText: string;
  /** バッジ＋「録音ありなのに URL 無し＝読み込みエラー」の判別に使う */
  hasRecording: boolean;
  viewUrl: string | undefined;
  recordingUrl: string | undefined;
};

type BoardPhotosState = {
  items: BoardItem[];
  loading: boolean;
  error: string | null;
};

/** 端末に残すのは写真ぶんだけ（声はオンライン前提なので recordingUrl を持たない） */
type CachedBoardItem = Omit<BoardItem, 'recordingUrl'>;
type CachedBoard = { items: CachedBoardItem[] };

const LOAD_ERROR_MESSAGE =
  '写真をよみこめませんでした。電波のよいところで、もういちどためしてください。';

/**
 * @param targetSubjectId 家族として見る対象の subject（チケット16）。省略時は自分の博物館。
 *   家族の SELECT は RLS が、署名URLは worker の canViewSubject が認可する
 */
export function useBoardPhotos(targetSubjectId?: string) {
  const { subject } = useAuth();
  const isOnline = useIsOnline();
  const subjectId = targetSubjectId ?? subject?.id ?? null;
  // 家族の博物館は端末に残さない（lib/offline-cache.ts の判断）
  const cacheKey = targetSubjectId === undefined && subjectId ? cacheKeys.board(subjectId) : null;
  const [state, setState] = useState<BoardPhotosState>({
    items: [],
    loading: subjectId !== null,
    error: null,
  });
  // 2回目以降のフォーカス時はローディング表示を出さない（ちらつき防止。use-prompts と同じ）
  const hasLoadedRef = useRef(false);
  const hasFreshRef = useRef(false);
  const hydratedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!subjectId) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    if (!hasLoadedRef.current) {
      setState((prev) => ({ ...prev, loading: true }));
    }
    // 見せるものが端末にあるならエラーにしない（画面を白くしない＝チケット19の契約）
    const fail = () =>
      setState((prev) => ({
        ...prev,
        loading: false,
        error: hasLoadedRef.current ? null : LOAD_ERROR_MESSAGE,
      }));

    const saveCache = (items: BoardItem[]) => {
      if (!cacheKey) {
        return;
      }
      const cachedItems: CachedBoardItem[] = items.map(
        ({ photo, caption, bodyText, hasRecording, viewUrl }) => ({
          photo,
          caption,
          bodyText,
          hasRecording,
          viewUrl,
        }),
      );
      void writeCache(cacheKey, { items: cachedItems } satisfies CachedBoard);
    };

    if (cacheKey && !hydratedRef.current) {
      hydratedRef.current = true;
      const cached = await readCache<CachedBoard>(cacheKey);
      if (cached && !hasFreshRef.current) {
        hasLoadedRef.current = true;
        setState({
          // 声はオンラインでのみ聞ける（キャッシュに録音URLは無い）
          items: cached.items.map((item) => ({ ...item, recordingUrl: undefined })),
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
      hasFreshRef.current = true;
      setState({ items: [], loading: false, error: null });
      // 「写真が1枚も無い」も最新の事実なので残す（古いキャッシュを見せ続けない）
      saveCache([]);
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
      supabase.from('recordings').select('answer_id, r2_key').in('answer_id', answerIds),
    ]);
    if (photosResult.error || recordingsResult.error) {
      fail();
      return;
    }
    const photos = photosResult.data;
    const recordings = recordingsResult.data;

    let viewUrls: Record<string, string> = {};
    try {
      viewUrls = await getViewUrls([
        ...photos.map((photo) => photo.r2_key),
        ...recordings.map((recording) => recording.r2_key),
      ]);
    } catch {
      fail();
      return;
    }

    const promptTitleById = new Map(promptsResult.data.map((prompt) => [prompt.id, prompt.title]));
    const answerById = new Map(answers.map((answer) => [answer.id, answer]));
    const recordingKeyByAnswerId = new Map(
      recordings.map((recording) => [recording.answer_id, recording.r2_key]),
    );

    const items: BoardItem[] = photos.map((photo) => {
      const answer = answerById.get(photo.answer_id);
      const caption =
        (answer?.prompt_id !== null && answer?.prompt_id !== undefined
          ? promptTitleById.get(answer.prompt_id)
          : answer?.custom_title) ?? 'じぶんのお題';
      const recordingKey = recordingKeyByAnswerId.get(photo.answer_id);
      return {
        photo,
        caption,
        bodyText: answer?.body_text ?? '',
        hasRecording: recordingKey !== undefined,
        viewUrl: viewUrls[photo.r2_key],
        recordingUrl: recordingKey !== undefined ? viewUrls[recordingKey] : undefined,
      };
    });

    hasLoadedRef.current = true;
    hasFreshRef.current = true;
    setState({ items, loading: false, error: null });
    saveCache(items);
  }, [subjectId, cacheKey, isOnline]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return { ...state, refetch };
}
