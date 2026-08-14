// 書き手Web（PWA）のアイコン生成（チケット25）
// 使い方: node scripts/gen-icons.mjs
// - 依存なし（Node 組み込み zlib で PNG エンコード）。gen-wood-tile.mjs と同じ方式
// - 生成物はコミットする（ビルド時に再生成しない）
//
// 絵柄は DESIGN §1「マチネ（昼公演）」＋§6.1 の緞帳（チケット28で新パレットに全面刷新）：
//   桜色→ラベンダー→淡い空色の3色グラデの地に、ローズ→紫のグラデの緞帳
//   （上の房飾り＋左右の垂れ幕）が開いていて、中央の舞台にスポット光が落ちている。
//   §1 の決別点どおり、夜の劇場（黒・金）にも葬送の気配にもしない。
//   幕をアプリ内アクセントの curtain-red にしない判断（28）：朱色は桜色の地と
//   彩度がぶつかって濁るため、アイコンだけ背景と同系のローズ→紫で揃える。
//
// これは**仮アイコン**。本番アイコンはチケット23（リリース準備）で差し替える。
// 23 で Android 用の 1024 が要るときは SIZES に足せばよい。

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 空。トークン（#FFD6E8/#E0D4FF/#C4E8FF）そのままだと開口部が白飛びして
// 空に見えない（アイコンは幕との対比が強く、淡いパステルが飛ぶ）ため、
// 同じ色相のまま彩度を上げた「アイコン用の濃いめトーン」を使う（チケット28の判断）
const SKY_TOP = [0xff, 0x9e, 0xc9];
const SKY_MID = [0xb3, 0x9d, 0xff];
const SKY_BOTTOM = [0x8f, 0xd0, 0xff];
// 幕はローズ→紫の縦グラデ（アイコン専用色。ヘッダーコメントの判断参照）
const CURTAIN_ROSE = [0xff, 0x4d, 0x8a];
const CURTAIN_PURPLE = [0x8a, 0x4d, 0xff];
// スポット光。spot-yellow(#F5B93C) をそのまま重ねると地と混ざって濁るので、
// その色みを保ったまま明るく起こした「光の色」を使う（DESIGN §3 の組み合わせの範囲）
const SPOT_LIGHT = [0xff, 0xec, 0xc2];

const SIZES = [
  { file: 'public/icons/icon-192.png', size: 192, inset: 1 },
  { file: 'public/icons/icon-512.png', size: 512, inset: 1 },
  // maskable は OS が円などで切り抜くので、中身を内側80%（安全領域）に収める
  { file: 'public/icons/maskable-512.png', size: 512, inset: 0.8 },
  { file: 'public/icons/apple-touch-icon.png', size: 180, inset: 1 },
  // app.json の web.favicon が指す先。Expo がここから favicon.ico を作る
  { file: 'assets/images/favicon.png', size: 96, inset: 1 },
];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** 0→1 のなめらかな立ち上がり（縁のギザギザを避ける） */
const smoothstep = (edge0, edge1, v) => {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** 房飾り（上の幕）の下端。弧が下にふくらむ。開口部に2つ半ほど見える数にする
 *  （少ないと「角が2本」に見えてドレープに見えない） */
function valanceBottom(x) {
  const scallops = 7;
  const f = x * scallops - Math.floor(x * scallops);
  return 0.2 + 0.065 * Math.sin(Math.PI * f);
}

/**
 * 左の垂れ幕の内側の端（右はこれを左右反転）。
 * 上から裾へゆるく細くなる台形＝舞台が下に向かって広がって見える形。
 * 弧を描かせると開口部が卵型になって「劇場」に見えなくなる（試して却下）
 */
function panelInnerEdge(y) {
  return 0.32 - 0.09 * clamp01(y);
}

/** 単位座標 (0..1) の色。content 座標が枠外なら幕もスポットも描かない（maskable 用） */
function shade(x, y, inset) {
  // 地：空のグラデ（DESIGN §3「背景は常に sky-top → sky-mid(60%) → sky-bottom」）
  let color =
    y < 0.6 ? mix(SKY_TOP, SKY_MID, y / 0.6) : mix(SKY_MID, SKY_BOTTOM, (y - 0.6) / 0.4);

  const cx = 0.5 + (x - 0.5) / inset;
  const cy = 0.5 + (y - 0.5) / inset;
  if (cx < 0 || cx > 1 || cy < 0 || cy > 1) {
    return color;
  }

  // スポット光：房飾りの真下から舞台へ落ちる円錐
  const apexY = 0.2;
  if (cy > apexY) {
    const halfWidth = 0.05 + (cy - apexY) * 0.62;
    const across = Math.abs(cx - 0.5) / halfWidth;
    if (across < 1) {
      // 0.62→0.35（チケット28）：新しい地は桜色で明るく、強い光だと開口部が
      // 白飛びして空が見えなくなるため、光は「うっすら差す」程度に抑える
      const alpha = 0.35 * (1 - across) ** 1.4 * smoothstep(0.2, 0.42, cy);
      color = mix(color, SPOT_LIGHT, alpha);
    }
  }

  // 幕：房飾り（上）と左右の垂れ幕
  const edge = panelInnerEdge(cy);
  const distances = [
    valanceBottom(cx) - cy, // 房飾りの内側なら正
    edge - cx, // 左の幕
    cx - (1 - edge), // 右の幕
  ];
  const curtain = Math.max(...distances);
  // 0.006 の幅で混ぜて縁をなめらかに（スーパーサンプルと併せて 48px でも汚くならない）
  const coverage = smoothstep(0, 0.006, curtain);
  if (coverage > 0) {
    // 縦のひだ。幕の上でだけ見える
    const fold = 0.9 + 0.14 * (0.5 + 0.5 * Math.cos(cx * Math.PI * 14));
    // 裾を少し落として奥行きを出す
    const depth = 1 - 0.12 * smoothstep(0.55, 1, cy);
    // 布地はローズ→紫の縦グラデ（上の房飾りはローズ寄り・裾に向かって紫へ）
    const cloth = mix(CURTAIN_ROSE, CURTAIN_PURPLE, clamp01(cy)).map((c) => c * fold * depth);
    color = mix(color, cloth, coverage);
  } else {
    // 房飾りのすぐ下に落ちる影（DESIGN §1「浮かんでいる」）
    const shadow = 0.14 * smoothstep(0.05, 0, cy - valanceBottom(cx));
    color = color.map((c) => c * (1 - shadow));
  }

  return color;
}

/** スーパーサンプリングして PNG のピクセル行を作る */
function render(size, inset) {
  const samples = 4;
  const rows = Buffer.alloc(size * (1 + size * 3));
  for (let py = 0; py < size; py++) {
    const rowOffset = py * (1 + size * 3);
    rows[rowOffset] = 0; // filter: None
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const color = shade(
            (px + (sx + 0.5) / samples) / size,
            (py + (sy + 0.5) / samples) / size,
            inset,
          );
          r += color[0];
          g += color[1];
          b += color[2];
        }
      }
      const n = samples * samples;
      const o = rowOffset + 1 + px * 3;
      rows[o] = Math.max(0, Math.min(255, Math.round(r / n)));
      rows[o + 1] = Math.max(0, Math.min(255, Math.round(g / n)));
      rows[o + 2] = Math.max(0, Math.min(255, Math.round(b / n)));
    }
  }
  return rows;
}

// ---- PNG エンコード（gen-wood-tile.mjs と同じ） ----
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rows) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB（不透明。maskable と apple-touch-icon は透過を持てない）
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const { file, size, inset } of SIZES) {
  const out = resolve(ROOT, file);
  mkdirSync(dirname(out), { recursive: true });
  const png = encodePng(size, render(size, inset));
  writeFileSync(out, png);
  console.log(`wrote ${file} (${size}x${size}, ${png.length} bytes)`);
}
