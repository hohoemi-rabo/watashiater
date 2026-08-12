/**
 * 机の上ボードの自動整列レイアウト（チケット13。React 非依存・app 内 import なし。
 * チケット21の閲覧Webはこのファイルをそのまま移植して同じ配置を再現する）。
 *
 * ── 座標系の契約（チケット13で確定。14=ならべかえ・21=閲覧Web はこれに従う）──
 * - 単位はすべて「ボード幅 = 1」の正規化値。原点はボード左上、x は右+、y は下+。
 *   ボードの高さは写真の枚数で伸びるため、y も幅基準にする（1.0 を超えうる）。
 *   幅基準にする理由：画面幅が違う端末・閲覧Webでも同じ数値で同じ配置を再現するため
 * - x, y はポラロイド外形（回転前の矩形）の中心。描画側は
 *   left = x*W - 幅/2, top = y*W - 高さ/2 で置き、中心まわりに回転する
 *   （RN の transform rotate / CSS の transform-origin: center と一致）
 * - rotation は度。時計回りが正（RN / CSS の rotate と同じ）
 * - z は重なり順の整数。大きいほど手前。自動配置は作成順 index を z とする。
 *   チケット14で最前面に出すときは「現在の最大 z + 1」を保存する
 * - photos.board_x / board_y / board_rotation / board_z はこの単位で保存する（チケット14）。
 *   board_x と board_y が両方 non-null のときだけ保存配置を採用する（14 は4項目セットで
 *   書き、「もとにもどす」で4項目とも null に戻す前提）。rotation / z の欠落は自動値で補う
 * - 乱数の引き順（jitterX → jitterY → rotation）も契約の一部。変えると全端末で配置が変わる
 *
 * ── 安定性（完了条件「枚数が増減しても安定」）──
 * - 追加は created_at 順で必ず末尾に付くので、既存写真は動かない
 * - 削除は後続のスロットを詰める（机に穴を残さない）
 * - 傾き・ジッターは photo.id 由来（座席 index に依らない）ので、詰まっても傾きは変わらない
 * - 保存配置（ドラッグ済み）の写真もスロットの席は予約したまま：1枚をドラッグ保存しても
 *   自動配置の写真は1つも動かない（元いた場所が自然な空きになる）
 * - n=1 でも左上寄せのまま中央寄せ特例を作らない（特例を作ると2枚目の追加で1枚目が動く）
 */

export type BoardPhotoInput = {
  id: string;
  board_x: number | null;
  board_y: number | null;
  board_rotation: number | null;
  board_z: number | null;
};

export type BoardPlacement = { x: number; y: number; rotation: number; z: number };

/**
 * レイアウト定数（正規化値）。収まりの根拠：
 * - ポラロイドの高さ h ≈ 幅0.42 + 固定20px ≦ 0.42*1.15 = 0.483（幅320dp 端末でも成立）
 * - 回転3°込みの半幅 = (0.42/2)cos3° + (0.483/2)sin3° ≈ 0.222
 *   → 最悪左端 0.28 − 0.04 − 0.222 = 0.018 ≥ 0、最悪右端 0.72 + 0.04 + 0.222 = 0.982 ≤ 1
 * - 同列の隣（中心距離 2*0.30=0.60、ジッターで最悪 0.54）> 回転込み全高 0.504 → 重なりゼロ保証
 * - 隣列とは角が最大 0.085 程度触れる＝DESIGN §7 の「軽い重なり」
 */
export const BOARD = {
  /** ポラロイド幅（ボード幅比） */
  POLAROID_W: 0.42,
  /** 2列の中心 x（スロット index % 2 で交互） */
  COL_X: [0.28, 0.72],
  /** 先頭スロットの中心 y */
  Y_START: 0.32,
  /** スロットごとの中心 y の送り */
  ROW_STEP: 0.3,
  /** x ジッター振幅（±） */
  JITTER_X: 0.04,
  /** y ジッター振幅（±） */
  JITTER_Y: 0.03,
  /** 傾きの上限（±度。DESIGN §5「±3°以内」） */
  ROTATION_MAX_DEG: 3,
  /** 高さ見積り用のアスペクト（白フチの固定px分を最小幅端末でも覆う余裕値） */
  EST_ASPECT: 1.15,
  /** ボード下端の余白 */
  BOTTOM_MARGIN: 0.08,
  /** 写真が少なくても「机」に見える最低高さ */
  MIN_HEIGHT: 1.2,
} as const;

/** FNV-1a（32bit）。photo.id（UUID＝ASCII）を乱数の種に変える */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32。Math.imul ベースなので Hermes とブラウザで同じ列を返す */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 全写真の配置を解決する。photos は created_at 昇順（同時刻は id 昇順）で渡すこと
 * （全順序でないと「同じ seed で毎回同じ配置」が壊れる）。戻りは入力と同順。
 */
export function resolveBoardPlacements(
  photos: readonly BoardPhotoInput[],
  boardSeed: number,
): { placements: BoardPlacement[]; boardHeightFraction: number } {
  const placements: BoardPlacement[] = photos.map((photo, index) => {
    const rand = mulberry32((fnv1a(photo.id) ^ (boardSeed >>> 0)) >>> 0);
    const jitterX = (rand() * 2 - 1) * BOARD.JITTER_X;
    const jitterY = (rand() * 2 - 1) * BOARD.JITTER_Y;
    const rotation = (rand() * 2 - 1) * BOARD.ROTATION_MAX_DEG;
    if (photo.board_x !== null && photo.board_y !== null) {
      return {
        x: photo.board_x,
        y: photo.board_y,
        rotation: photo.board_rotation ?? rotation,
        z: photo.board_z ?? index,
      };
    }
    return {
      x: BOARD.COL_X[index % 2] + jitterX,
      y: BOARD.Y_START + index * BOARD.ROW_STEP + jitterY,
      rotation,
      z: index,
    };
  });

  // 保存配置の y も含めて下端を求める（ドラッグで下へ置かれた写真が切れないように）
  const halfHeight = (BOARD.POLAROID_W * BOARD.EST_ASPECT) / 2;
  const maxBottom = placements.reduce((max, p) => Math.max(max, p.y + halfHeight), 0);
  const boardHeightFraction = Math.max(BOARD.MIN_HEIGHT, maxBottom + BOARD.BOTTOM_MARGIN);

  return { placements, boardHeightFraction };
}
