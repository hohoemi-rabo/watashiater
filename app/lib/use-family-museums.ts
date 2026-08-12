/**
 * 家族ハブ（/family）用：自分が家族として登録されている博物館の一覧（チケット16）。
 * auth-context の memberships と別に自前で取得するのは、書き手側の解除を
 * フォーカスのたびに反映するため（家風どおり並列フラットクエリ＋JS join）。
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export type FamilyMuseum = {
  membershipId: string;
  subjectId: string;
  nickname: string;
};

type FamilyMuseumsState = {
  museums: FamilyMuseum[];
  loading: boolean;
  error: string | null;
};

const LOAD_ERROR_MESSAGE =
  'よみこめませんでした。電波のよいところで、もういちどためしてください。';

export function useFamilyMuseums() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [state, setState] = useState<FamilyMuseumsState>({
    museums: [],
    loading: userId !== null,
    error: null,
  });
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!userId) {
      setState({ museums: [], loading: false, error: null });
      return;
    }
    if (!hasLoadedRef.current) {
      setState((prev) => ({ ...prev, loading: true }));
    }
    const membershipsResult = await supabase
      .from('family_members')
      .select('id, subject_id')
      .eq('member_user_id', userId)
      .order('joined_at');
    if (membershipsResult.error) {
      setState((prev) => ({ ...prev, loading: false, error: LOAD_ERROR_MESSAGE }));
      return;
    }
    const memberships = membershipsResult.data;
    let museums: FamilyMuseum[] = [];
    if (memberships.length > 0) {
      const subjectsResult = await supabase
        .from('subjects')
        .select('id, nickname')
        .in(
          'id',
          memberships.map((m) => m.subject_id),
        );
      if (subjectsResult.error) {
        setState((prev) => ({ ...prev, loading: false, error: LOAD_ERROR_MESSAGE }));
        return;
      }
      const nicknameById = new Map(subjectsResult.data.map((s) => [s.id, s.nickname]));
      museums = memberships.flatMap((m) => {
        const nickname = nicknameById.get(m.subject_id);
        // RLS の隙間で subject が見えない行は出さない（通常起きない防御）
        return nickname === undefined
          ? []
          : [{ membershipId: m.id, subjectId: m.subject_id, nickname }];
      });
    }
    hasLoadedRef.current = true;
    setState({ museums, loading: false, error: null });
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  return { ...state, refetch };
}
