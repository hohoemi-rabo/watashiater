/**
 * 自分（家族）の「みたよ」状態と送信（チケット16）。REQUIREMENTS §3.5(a)。
 * - 楽観更新：タップの瞬間に reacted にして拍手演出を遅らせない。INSERT が
 *   23505（すでに みたよ 済み）なら維持、それ以外の失敗（RLS で家族解除・
 *   対象削除のトリガー RAISE 等）は巻き戻してエラー文言を出す
 * - みたよの取り消しは仕様に無い（reactions に UPDATE/DELETE ポリシーも無い）
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type ReactionTargetType = 'photo' | 'life_story';

const reactionKey = (targetType: ReactionTargetType, targetId: string) =>
  `${targetType}:${targetId}`;

const SEND_ERROR_MESSAGE = 'みたよ を おくれませんでした。もういちど ためしてください。';
const LOAD_ERROR_MESSAGE =
  'よみこめませんでした。電波のよいところで、もういちどためしてください。';

export function useMyReactions(memberId: string | null) {
  const [reactedKeys, setReactedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!memberId) {
      setReactedKeys(new Set());
      return;
    }
    const { data, error: fetchError } = await supabase
      .from('reactions')
      .select('target_type, target_id')
      .eq('member_id', memberId);
    if (fetchError) {
      // 初回だけ知らせる（reacted 状態はサーバー側 unique が真実なので、送信は 23505 で自癒する）
      if (!hasLoadedRef.current) {
        setError(LOAD_ERROR_MESSAGE);
      }
      return;
    }
    hasLoadedRef.current = true;
    setReactedKeys(
      new Set(data.map((row) => reactionKey(row.target_type as ReactionTargetType, row.target_id))),
    );
  }, [memberId]);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const hasReacted = useCallback(
    (targetType: ReactionTargetType, targetId: string) =>
      reactedKeys.has(reactionKey(targetType, targetId)),
    [reactedKeys],
  );

  const react = useCallback(
    (targetType: ReactionTargetType, targetId: string) => {
      if (!memberId) {
        return;
      }
      const key = reactionKey(targetType, targetId);
      setError(null);
      // 楽観更新：先に reacted へ（演出を待たせない）
      setReactedKeys((prev) => new Set(prev).add(key));
      void (async () => {
        const { error: insertError } = await supabase
          .from('reactions')
          .insert({ member_id: memberId, target_type: targetType, target_id: targetId });
        if (!insertError || insertError.code === '23505') {
          return;
        }
        // 巻き戻し（嘘の「みたよ済み」を見せ続けない）
        setReactedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        setError(SEND_ERROR_MESSAGE);
      })();
    },
    [memberId],
  );

  return { hasReacted, react, error, refetch };
}
