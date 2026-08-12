/**
 * ならべかえの保存の道具箱（React 非依存。チケット14）。
 * 座標契約は board-layout.ts 冒頭コメントのとおり：
 * - 保存は board_x / board_y / board_rotation / board_z の4項目セット
 * - 「もとにもどす」は4項目とも null に戻す（自動整列に復帰）
 * RLS は photos_owner_update（回答の持ち主のみ）が既存なのでマイグレーション不要。
 */
import type { BoardPlacement } from '@/lib/board-layout';
import { supabase } from '@/lib/supabase';

const SAVE_ERROR_MESSAGE =
  'ならべかえを ほぞんできませんでした。電波のよいところで、もういちどためしてください。';
const RESET_ERROR_MESSAGE =
  'もとにもどせませんでした。電波のよいところで、もういちどためしてください。';

/** 1枚ぶんの配置を保存する（ドロップ毎に呼ぶ） */
export async function saveBoardPlacement(
  photoId: string,
  placement: BoardPlacement,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from('photos')
    .update({
      board_x: placement.x,
      board_y: placement.y,
      board_rotation: placement.rotation,
      board_z: placement.z,
    })
    .eq('id', photoId);
  return error ? { ok: false, message: SAVE_ERROR_MESSAGE } : { ok: true };
}

/** 全写真の配置を消して自動整列へ戻す */
export async function resetBoardPlacements(
  photoIds: string[],
): Promise<{ ok: boolean; message?: string }> {
  if (photoIds.length === 0) {
    return { ok: true };
  }
  const { error } = await supabase
    .from('photos')
    .update({ board_x: null, board_y: null, board_rotation: null, board_z: null })
    .in('id', photoIds);
  return error ? { ok: false, message: RESET_ERROR_MESSAGE } : { ok: true };
}
