/**
 * みんなに見せる画面（書き手側）のデータ（チケット16・17）。
 * 有効な招待コード・見せる用リンク・家族一覧・みたよ一覧を、家風どおり
 * 並列フラットクエリ＋JS join で取る。
 * - みたよは最新30件（画面が際限なく伸びないように。REQUIREMENTS §7-7 はアプリ内一覧のみ）
 * - 写真が消えて対象を解決できない みたよ は行ごと出さない（「けされた写真」の文言を発明しない）
 * - どの段の失敗も単一のエラー state（use-board-photos と同じ方針）
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { fetchActiveInviteCode, type InviteCode } from '@/lib/invite';
import { supabase } from '@/lib/supabase';
import { fetchActiveViewLink, type ViewLink } from '@/lib/view-link';

export type FamilyRow = {
  id: string;
  displayName: string;
  joinedAt: string;
};

export type ReactionFeedRow = {
  id: string;
  memberName: string;
  kind: 'photo' | 'life_story';
  /** kind === 'photo' のときだけ。写真が属するお題のタイトル */
  photoTitle?: string;
  createdAt: string;
};

type ShareDataState = {
  invite: InviteCode | null;
  viewLink: ViewLink | null;
  family: FamilyRow[];
  reactions: ReactionFeedRow[];
  loading: boolean;
  error: string | null;
};

const REACTION_FEED_LIMIT = 30;
const LOAD_ERROR_MESSAGE =
  'よみこめませんでした。電波のよいところで、もういちどためしてください。';

export function useShareData() {
  const { subject } = useAuth();
  const subjectId = subject?.id ?? null;
  const [state, setState] = useState<ShareDataState>({
    invite: null,
    viewLink: null,
    family: [],
    reactions: [],
    loading: subjectId !== null,
    error: null,
  });
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!subjectId) {
      setState({
        invite: null,
        viewLink: null,
        family: [],
        reactions: [],
        loading: false,
        error: null,
      });
      return;
    }
    if (!hasLoadedRef.current) {
      setState((prev) => ({ ...prev, loading: true }));
    }
    const fail = () => setState((prev) => ({ ...prev, loading: false, error: LOAD_ERROR_MESSAGE }));

    // お題タイトル解決は use-board-photos と同じ join（answers＋prompts を先に引いておく）
    const [inviteResult, viewLinkResult, familyResult, answersResult, promptsResult] =
      await Promise.all([
        fetchActiveInviteCode(subjectId),
        fetchActiveViewLink(subjectId),
        supabase
          .from('family_members')
          .select('id, display_name, joined_at')
          .eq('subject_id', subjectId)
          .order('joined_at'),
        supabase.from('answers').select('id, prompt_id, custom_title').eq('subject_id', subjectId),
        supabase.from('prompts').select('id, title'),
      ]);
    if (
      !inviteResult.ok ||
      !viewLinkResult.ok ||
      familyResult.error ||
      answersResult.error ||
      promptsResult.error
    ) {
      fail();
      return;
    }
    const family: FamilyRow[] = familyResult.data.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      joinedAt: row.joined_at,
    }));

    let reactions: ReactionFeedRow[] = [];
    if (family.length > 0) {
      const reactionsResult = await supabase
        .from('reactions')
        .select('*')
        .in(
          'member_id',
          family.map((row) => row.id),
        )
        .order('created_at', { ascending: false })
        .limit(REACTION_FEED_LIMIT);
      if (reactionsResult.error) {
        fail();
        return;
      }
      const reactionRows = reactionsResult.data;

      const photoIds = reactionRows
        .filter((row) => row.target_type === 'photo')
        .map((row) => row.target_id);
      const photoById = new Map<string, string>();
      if (photoIds.length > 0) {
        const photosResult = await supabase
          .from('photos')
          .select('id, answer_id')
          .in('id', photoIds);
        if (photosResult.error) {
          fail();
          return;
        }
        for (const photo of photosResult.data) {
          photoById.set(photo.id, photo.answer_id);
        }
      }

      const promptTitleById = new Map(promptsResult.data.map((p) => [p.id, p.title]));
      const answerById = new Map(answersResult.data.map((a) => [a.id, a]));
      const memberNameById = new Map(family.map((row) => [row.id, row.displayName]));

      reactions = reactionRows.flatMap((row): ReactionFeedRow[] => {
        const memberName = memberNameById.get(row.member_id);
        if (memberName === undefined) {
          return [];
        }
        if (row.target_type === 'life_story') {
          return [{ id: row.id, memberName, kind: 'life_story', createdAt: row.created_at }];
        }
        const answerId = photoById.get(row.target_id);
        const answer = answerId !== undefined ? answerById.get(answerId) : undefined;
        if (!answer) {
          // 写真（または回答）が消えていて解決できない行は出さない
          return [];
        }
        const photoTitle =
          (answer.prompt_id !== null
            ? promptTitleById.get(answer.prompt_id)
            : answer.custom_title) ?? 'じぶんのお題';
        return [{ id: row.id, memberName, kind: 'photo', photoTitle, createdAt: row.created_at }];
      });
    }

    hasLoadedRef.current = true;
    setState({
      invite: inviteResult.invite,
      viewLink: viewLinkResult.link,
      family,
      reactions,
      loading: false,
      error: null,
    });
  }, [subjectId]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return { ...state, refetch };
}
