// アプリアイコン一式の生成（チケット25で PWA 用に作成 → チケット23で本番アイコン・
// スプラッシュ・ストア用バナーまで拡張。これが本番アイコンの正）
// 使い方: node scripts/gen-icons.mjs
// - 依存なし（Node 組み込み zlib で PNG エンコード）。gen-wood-tile.mjs と同じ方式
// - 生成物はコミットする（ビルド時に再生成しない）
// - Android のアダプティブアイコン foreground / monochrome は透過が必須（不透明だと
//   全面四角に切り抜かれる）ため、PNG エンコーダは RGBA（color type 6）も出せる
// - docs/store/feature-graphic.png は Google Play のフィーチャーグラフィック
//   （1024×500）。アプリのビルド入力ではないのでリポジトリ直下の docs/ に置く。
//   フォントを持たないのでテキストなしの構図（Play のガイドライン上テキストは任意）
//
// 絵柄は DESIGN §1「マチネ（昼公演）」＋§6.1 の緞帳（チケット28で新パレットに全面刷新）：
//   桜色→ラベンダー→淡い空色の3色グラデの地に、ローズ→紫のグラデの緞帳
//   （上の房飾り＋左右の垂れ幕）が開いていて、中央の舞台にスポット光が落ちている。
//   §1 の決別点どおり、夜の劇場（黒・金）にも葬送の気配にもしない。
//   幕をアプリ内アクセントの curtain-red にしない判断（28）：朱色は桜色の地と
//   彩度がぶつかって濁るため、アイコンだけ背景と同系のローズ→紫で揃える。
//
// アダプティブアイコンの構成（チケット23の判断）：
//   background = トークンそのままのパステル空グラデ／foreground = 安全領域
//   （中央66%の円）内に「白フチつきの丸バッジ」として舞台の絵を収める。
//   全面絵をそのまま foreground にするとマスク形状しだいで幕が切り落とされるため。
//   白フチはポラロイドの白フチ（DESIGN §1「手ざわり」）と同じ意匠。

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
// アダプティブアイコンの background 層はトークンそのままのパステル空
// （tokens.ts の sky-top/mid/bottom。バッジの外側なので白飛びの心配がなく、
//   濃いめのバッジを引き立てる）
const PASTEL_TOP = [0xff, 0xd6, 0xe8];
const PASTEL_MID = [0xe0, 0xd4, 0xff];
const PASTEL_BOTTOM = [0xc4, 0xe8, 0xff];
const WHITE = [0xff, 0xff, 0xff];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** 0→1 のなめらかな立ち上がり（縁のギザギザを避ける） */
const smoothstep = (edge0, edge1, v) => {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** 房飾り（上の幕）の下端。弧が下にふくらむ。数を絞って1つ1つを大きく
 *  （小さいアイコンでもドレープに見えるように。チケット28で 7→5） */
function valanceBottom(x, scallops = 5) {
  const f = x * scallops - Math.floor(x * scallops);
  return 0.18 + 0.075 * Math.sin(Math.PI * f);
}

/**
 * 左の垂れ幕の内側の端（右はこれを左右反転）。
 * 裾に向かって弧を描いて大きく開く＝「幕が左右に寄せられている」シルエット。
 * 旧版の直線的な台形は開口部が塔のように見えた（チケット28の目視で判明）ため曲線に変更
 */
function panelInnerEdge(y) {
  return 0.34 - 0.24 * clamp01(y) ** 1.6;
}

/** 舞台の床の上端。ここから下は木の床＝「舞台」が一目で分かる要素（チケット28で追加） */
const FLOOR_Y = 0.74;
// 床は desk-wood トークンの木色（DESIGN §3。アプリの「机の上」と同じ素材感）
const WOOD = [0xc9, 0x9a, 0x68];
const WOOD_DARK = [0x8f, 0x66, 0x3f];

/**
 * 舞台の絵。単位座標 (0..1) の色を返す。
 * 正方形以外（フィーチャーグラフィック）にも使えるよう、x 方向のジオメトリは
 * 「高さ=1」の単位（xa = cx * aspect）で測る。aspect=1・既定オプションのときは
 * 従来の shade と浮動小数まで一致する（既存 PWA アイコンのバイト不変を守る）。
 * - inset: content 座標が枠外なら幕もスポットも描かない（maskable 用）
 * - scallops: 房飾りの数（横長では密度を合わせて増やす）
 * - coneScale / poolRx / panelScale: 横長でスポットと幕の見た目バランスを取る係数
 */
function shadeScene(x, y, { inset = 1, aspect = 1, scallops = 5, coneScale = 1, poolRx = 0.26, panelScale = 1 } = {}) {
  // 地：空のグラデ（DESIGN §3「背景は常に sky-top → sky-mid(60%) → sky-bottom」）
  let color =
    y < 0.6 ? mix(SKY_TOP, SKY_MID, y / 0.6) : mix(SKY_MID, SKY_BOTTOM, (y - 0.6) / 0.4);

  const cx = 0.5 + (x - 0.5) / inset;
  const cy = 0.5 + (y - 0.5) / inset;
  if (cx < 0 || cx > 1 || cy < 0 || cy > 1) {
    return color;
  }
  const xa = cx * aspect;
  const mid = aspect / 2;

  // 舞台の床：奥（上）が明るく手前（下）へ沈む木色
  if (cy > FLOOR_Y) {
    color = mix(WOOD, WOOD_DARK, ((cy - FLOOR_Y) / (1 - FLOOR_Y)) * 0.7);
  }
  // 床と空のさかい目にうっすら暗い線（舞台の輪郭を立たせる）
  const horizonBand = Math.abs(cy - FLOOR_Y);
  if (horizonBand < 0.008) {
    color = color.map((c) => c * (1 - 0.2 * (1 - horizonBand / 0.008)));
  }

  // スポット光：房飾りの陰から床へ落ちる円錐と、床の上の光だまり（楕円）
  const apexY = 0.16;
  const poolY = 0.86;
  if (cy > apexY) {
    const halfWidth = (0.05 + (cy - apexY) * 0.3) * coneScale;
    const across = Math.abs(xa - mid) / halfWidth;
    if (across < 1) {
      const alpha = 0.3 * (1 - across) ** 1.4 * smoothstep(0.18, 0.4, cy);
      color = mix(color, SPOT_LIGHT, alpha);
    }
  }
  if (cy > FLOOR_Y) {
    const dx = (xa - mid) / poolRx;
    const dy = (cy - poolY) / 0.09;
    const pool = dx * dx + dy * dy;
    if (pool < 1) {
      color = mix(color, SPOT_LIGHT, 0.55 * (1 - pool));
    }
  }

  // 幕：房飾り（上）と左右の垂れ幕
  const edge = panelInnerEdge(cy) * panelScale;
  const distances = [
    valanceBottom(cx, scallops) - cy, // 房飾りの内側なら正
    edge - xa, // 左の幕
    xa - (aspect - edge), // 右の幕
  ];
  const curtain = Math.max(...distances);
  // 0.006 の幅で混ぜて縁をなめらかに（スーパーサンプルと併せて 48px でも汚くならない）
  const coverage = smoothstep(0, 0.006, curtain);
  if (coverage > 0) {
    // 縦のひだ。幕の上でだけ見える
    const fold = 0.9 + 0.14 * (0.5 + 0.5 * Math.cos(xa * Math.PI * 14));
    // 裾を少し落として奥行きを出す
    const depth = 1 - 0.12 * smoothstep(0.55, 1, cy);
    // 布地はローズ→紫の縦グラデ（上の房飾りはローズ寄り・裾に向かって紫へ）
    let cloth = mix(CURTAIN_ROSE, CURTAIN_PURPLE, clamp01(cy)).map((c) => c * fold * depth);
    // 内側の縁に淡い桜色の縁取り＝幕のシルエットを小さいサイズでも読ませる（チケット28）
    const rim = 1 - smoothstep(0.004, 0.03, curtain);
    cloth = mix(cloth, [0xff, 0xd6, 0xe8], rim * 0.5);
    color = mix(color, cloth, coverage);
  } else {
    // 房飾りのすぐ下に落ちる影（DESIGN §1「浮かんでいる」）
    const shadow = 0.14 * smoothstep(0.05, 0, cy - valanceBottom(cx, scallops));
    color = color.map((c) => c * (1 - shadow));
  }

  return color;
}

/** 従来の正方形アイコンの絵（チケット25からの互換ラッパー） */
function shade(x, y, inset) {
  return shadeScene(x, y, { inset });
}

/** アダプティブアイコンの background 層：パステル空グラデのみ */
function shadePastelSky(x, y) {
  return y < 0.6 ? mix(PASTEL_TOP, PASTEL_MID, y / 0.6) : mix(PASTEL_MID, PASTEL_BOTTOM, (y - 0.6) / 0.4);
}

// 円の縁のアンチエイリアス幅（キャンバス単位。1024px なら約1.5px）
const EDGE_AA = 0.0015;
// バッジの白フチの太さ（半径に対する割合）
const RIM_FRACTION = 0.07;

/**
 * 白フチつき丸バッジ：半径 radius（キャンバス単位）の円に舞台の絵を収め、外側は透過。
 * 色は縁の外でも連続に保つ（透明サンプルとの平均で黒フチが出ないように）
 */
function makeBadgeShade(radius) {
  const sceneRadius = radius * (1 - RIM_FRACTION);
  return (x, y) => {
    const dist = Math.hypot(x - 0.5, y - 0.5);
    // 絵は白フチの内側いっぱいに正方形としてマップ（四隅は円で切れるが、
    // 房飾りが上端・床が下端に来る構図は保たれる）
    const u = clamp01(0.5 + (x - 0.5) / (2 * sceneRadius));
    const v = clamp01(0.5 + (y - 0.5) / (2 * sceneRadius));
    const scene = shadeScene(u, v);
    const inRim = smoothstep(sceneRadius - EDGE_AA, sceneRadius + EDGE_AA, dist);
    const color = mix(scene, WHITE, inRim);
    const alpha = 1 - smoothstep(radius - EDGE_AA, radius + EDGE_AA, dist);
    return [color[0], color[1], color[2], 255 * alpha];
  };
}

/**
 * モノクロ層（テーマアイコン用）：白一色＋アルファがシルエット。
 * 「円から舞台の開口部をくり抜いた」形＝幕と床のシルエット。
 */
function makeMonochromeShade(radius) {
  return (x, y) => {
    const dist = Math.hypot(x - 0.5, y - 0.5);
    const circle = 1 - smoothstep(radius - EDGE_AA, radius + EDGE_AA, dist);
    const u = clamp01(0.5 + (x - 0.5) / (2 * radius));
    const v = clamp01(0.5 + (y - 0.5) / (2 * radius));
    const curtain = Math.max(
      valanceBottom(u) - v,
      panelInnerEdge(v) - u,
      u - (1 - panelInnerEdge(v)),
    );
    const silhouette = Math.max(
      smoothstep(0, 0.006, curtain),
      smoothstep(FLOOR_Y, FLOOR_Y + 0.01, v),
    );
    return [255, 255, 255, 255 * silhouette * circle];
  };
}

/** フィーチャーグラフィック（1024×500）：横長の舞台。房飾りの密度を高さ基準で合わせる */
function shadeBanner(x, y) {
  return shadeScene(x, y, {
    aspect: 1024 / 500,
    scallops: 10,
    coneScale: 1.8,
    poolRx: 0.5,
    panelScale: 1.4,
  });
}

// アダプティブアイコンの安全領域は中央 66/108 の円（それより外はマスクで欠けうる）
const ADAPTIVE_SAFE_RADIUS = 66 / 108 / 2;
// スプラッシュはマスクされないので余白ぶんだけ残してほぼいっぱいに使う
const SPLASH_RADIUS = 0.46;

const JOBS = [
  // --- 書き手Web（PWA。チケット25）。出力は従来とバイト一致を保つこと ---
  { file: 'public/icons/icon-192.png', width: 192, height: 192, shade: (x, y) => shade(x, y, 1) },
  { file: 'public/icons/icon-512.png', width: 512, height: 512, shade: (x, y) => shade(x, y, 1) },
  // maskable は OS が円などで切り抜くので、中身を内側80%（安全領域）に収める
  { file: 'public/icons/maskable-512.png', width: 512, height: 512, shade: (x, y) => shade(x, y, 0.8) },
  { file: 'public/icons/apple-touch-icon.png', width: 180, height: 180, shade: (x, y) => shade(x, y, 1) },
  // app.json の web.favicon が指す先。Expo がここから favicon.ico を作る
  { file: 'assets/images/favicon.png', width: 96, height: 96, shade: (x, y) => shade(x, y, 1) },

  // --- 本番アイコン・スプラッシュ（チケット23） ---
  { file: 'assets/images/icon.png', width: 1024, height: 1024, shade: (x, y) => shade(x, y, 1) },
  { file: 'assets/images/android-icon-background.png', width: 1024, height: 1024, shade: shadePastelSky },
  {
    file: 'assets/images/android-icon-foreground.png',
    width: 1024,
    height: 1024,
    shade: makeBadgeShade(ADAPTIVE_SAFE_RADIUS),
    alpha: true,
  },
  {
    file: 'assets/images/android-icon-monochrome.png',
    width: 1024,
    height: 1024,
    shade: makeMonochromeShade(ADAPTIVE_SAFE_RADIUS),
    alpha: true,
  },
  {
    file: 'assets/images/splash-icon.png',
    width: 1024,
    height: 1024,
    shade: makeBadgeShade(SPLASH_RADIUS),
    alpha: true,
  },

  // --- ストア素材（Google Play。アプリのビルド入力ではない） ---
  { file: '../docs/store/feature-graphic.png', width: 1024, height: 500, shade: shadeBanner },
];

/** スーパーサンプリングして PNG のピクセル行を作る（channels: 3=RGB / 4=RGBA） */
function render(width, height, shadeFn, channels) {
  const samples = 4;
  const rows = Buffer.alloc(height * (1 + width * channels));
  for (let py = 0; py < height; py++) {
    const rowOffset = py * (1 + width * channels);
    rows[rowOffset] = 0; // filter: None
    for (let px = 0; px < width; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const color = shadeFn(
            (px + (sx + 0.5) / samples) / width,
            (py + (sy + 0.5) / samples) / height,
          );
          r += color[0];
          g += color[1];
          b += color[2];
          if (channels === 4) a += color[3];
        }
      }
      const n = samples * samples;
      const o = rowOffset + 1 + px * channels;
      rows[o] = Math.max(0, Math.min(255, Math.round(r / n)));
      rows[o + 1] = Math.max(0, Math.min(255, Math.round(g / n)));
      rows[o + 2] = Math.max(0, Math.min(255, Math.round(b / n)));
      if (channels === 4) rows[o + 3] = Math.max(0, Math.min(255, Math.round(a / n)));
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
function encodePng(width, height, rows, alpha) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  // 2 = RGB（不透明。maskable と apple-touch-icon は透過を持てない）
  // 6 = RGBA（アダプティブアイコンの foreground / monochrome とスプラッシュ用）
  ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const { file, width, height, shade: shadeFn, alpha = false } of JOBS) {
  const out = resolve(ROOT, file);
  mkdirSync(dirname(out), { recursive: true });
  const channels = alpha ? 4 : 3;
  const png = encodePng(width, height, render(width, height, shadeFn, channels), alpha);
  writeFileSync(out, png);
  console.log(`wrote ${file} (${width}x${height}, ${png.length} bytes)`);
}
