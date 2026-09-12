/**
 * 緞帳のひだ（チケット29で確立し、チケット30でギャラリーの拡大表示と共有）。
 *
 * 幕の色と縞の作り方・束ね縮みの座標だけをここに置く。**幕そのものの見た目と速さは使う側が決める**：
 * じぶん史の緞帳は金の縁＋飾り幕つきで2秒かけて開き（components/curtain-overlay.tsx）、
 * ギャラリーの拡大表示はひだだけを0.6秒で開く（components/photo-lightbox.tsx）。
 * 共有するのは「2か所に置くとずれるもの」＝混色の値と、間違えやすい transform の並びに限る。
 */
import { colors } from '@/constants/tokens';

/** ひだの山（明部）＝ curtainRed(#E0472F) 80% + cardWhite(#FFFFFF) 20% の混色 */
export const PLEAT_HIGHLIGHT = '#E66C59';
/**
 * ひだの谷（暗部）＝ curtainRed 78% + stageNavy(#2B3A55) 22% の混色。
 * 黒で落とさないのは DESIGN §11-4「黒背景・夜の劇場化禁止」。DIMMED_SKY と同じ流儀
 */
export const PLEAT_SHADOW = '#B84437';

/**
 * 縦のひだ（布のドレープ）を作る横方向グラデの stop 列。
 * 1ひだの中は「谷(0) → 山(0.35) → 基調(0.7) → 次の谷」。
 * expo-linear-gradient と react-native-svg のどちらにもそのまま渡せる形で返す。
 */
export function buildPleatStops(folds: number): {
  colors: [string, string, ...string[]];
  locations: [number, number, ...number[]];
} {
  const stopColors: string[] = [];
  const locations: number[] = [];
  for (let i = 0; i < folds; i += 1) {
    const start = i / folds;
    stopColors.push(PLEAT_SHADOW, PLEAT_HIGHLIGHT, colors.curtainRed);
    locations.push(start, start + 0.35 / folds, start + 0.7 / folds);
  }
  stopColors.push(PLEAT_SHADOW);
  locations.push(1);
  // expo-linear-gradient は色・位置を「2つ以上」のタプル型で要求する（本数1以上なら必ず満たす）
  return {
    colors: stopColors as [string, string, ...string[]],
    locations: locations as [number, number, ...number[]],
  };
}

export type CurtainSide = 'left' | 'right';

/**
 * 束ね縮みの座標。幕は外側の端を支点に、幅を縮めながら画面外へ出ていく。
 *
 * **transform の並び順が結果を決める**：RN は配列の先頭が最後に適用される（CSS と同じ）。
 * `[{translateX}, {scaleX}]` の順なら「縮めてから、縮む前の座標で動かす」ので、
 * 原点を外側の端に置けば `translateX = ±gatherScale × 半幅` でちょうど画面外に出切る。
 * 逆順にすると移動量まで縮んで幕の帯が残る。
 *
 * `closed` と `gathered` は同じ並びで返す（Reanimated は transform 配列を要素ごとに
 * 補間するため、from と base で形が違うと途中で飛ぶ）。
 */
export function curtainGather(side: CurtainSide, half: number, gatherScale: number) {
  const outward = side === 'left' ? -1 : 1;
  return {
    /** 束ねられる支点＝外側の端 */
    origin: side === 'left' ? ('left center' as const) : ('right center' as const),
    closed: [{ translateX: 0 }, { scaleX: 1 }],
    gathered: [{ translateX: outward * gatherScale * half }, { scaleX: gatherScale }],
  };
}
