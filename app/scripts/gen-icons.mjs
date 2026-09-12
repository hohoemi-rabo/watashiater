// アプリアイコン一式の生成
// 使い方: node scripts/gen-icons.mjs
//
// 絵の出どころ（チケット37で変更）：
//   以前はこのスクリプトが1ピクセルずつ舞台の絵を描いていた（依存なし・決定的生成）。
//   クローズドテストで「アイコンが山に見える」という声が出て形を直したあと、
//   ユーザーが本物の緞帳に近い絵を用意したので、**assets/icon-source.png を各サイズに
//   切り出すだけ**の作りに変えた。絵を差し替えるときは icon-source.jpg を置き換えて
//   このスクリプトを流す。生成物はコミットする（ビルド時に再生成しない）。
//   元絵は 2048px の JPEG のまま置く（再エンコードで劣化させない・リポジトリも軽い）。
//   出力は 256 色のパレット PNG にする：写真的な絵を素の PNG にすると 1024px で 2MB 近くなり、
//   アプリに何 MB も積むことになる。目視では劣化が分からず、サイズは 6 分の 1 になる。
//
// Android のアダプティブアイコンについて（ここを間違えると絵が切れる）：
//   2層とも 108dp の canvas だが、**実際に見えるのは中央 72dp（= 66.7%）だけ**。
//   角が丸く落ちるだけではない。だから foreground には絵を全面ではなく中央 66.7% に
//   収めて置く。外側は透過（不透明だとマスク形状に関わらず全面四角になる）。
//   background は絵の外側なので基本は見えないが、動きのある launcher 用に空グラデを敷く。
//
// monochrome（テーマアイコン）は写真的な絵からは作れないので、幕のシルエットを別に描く。

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'assets/icon-source.jpg');

/** アダプティブアイコンで実際に見える割合（108dp のうち中央 72dp） */
const ADAPTIVE_SAFE = 72 / 108;
/** maskable（PWA）の安全領域は中央 80%。Android より緩い */
const MASKABLE_SAFE = 0.8;

// DESIGN §3 の空グラデ（トークンそのまま）。背面に敷くだけなので彩度は上げない
const SKY = { top: '#FFD6E8', mid: '#E0D4FF', bottom: '#C4E8FF' };

function out(relative) {
  const path = resolve(ROOT, relative);
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

/**
 * PNG で書き出す。既定は 256 色のパレット（写真的な絵を素の PNG にすると 1024px で 2MB 近くなる）。
 * dither は切る：スポット光のようになめらかな面に点状のノイズが出る（実物で確認）。
 * 代わりに階調の段が出るが、アイコンとして出る大きさ（192px 以下）では見えない。
 * **大きく表示されるもの（ストアのバナー）だけ fullColor で書く**。あちらはアプリに積まれない
 */
async function write(relative, pipeline, { fullColor = false } = {}) {
  const info = await pipeline
    .png(fullColor ? { compressionLevel: 9 } : { compressionLevel: 9, palette: true, colors: 256, dither: 0 })
    .toFile(out(relative));
  console.log(`wrote ${relative} (${info.width}x${info.height}, ${info.size} bytes)`);
}

/** 絵をそのまま正方形に伸縮（全面に絵が出る用途） */
const fullBleed = (size) => sharp(SOURCE).resize(size, size);

/** 空グラデ1枚（縦3色。DESIGN §3 の 0 / 60% / 100%） */
function skySvg(width, height) {
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${SKY.top}"/>
        <stop offset="0.6" stop-color="${SKY.mid}"/>
        <stop offset="1" stop-color="${SKY.bottom}"/>
      </linearGradient></defs>
      <rect width="${width}" height="${height}" fill="url(#s)"/>
    </svg>`,
  );
}

/** 絵を安全領域の大きさに縮めて、透過キャンバスの中央に置く */
async function insetOnTransparent(size, safe) {
  const inner = Math.round(size * safe);
  const art = await sharp(SOURCE).resize(inner, inner).png().toBuffer();
  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: art, left: offset, top: offset }]);
}

/** 絵を安全領域に収めつつ、外側は空グラデで埋める（maskable 用） */
async function insetOnSky(size, safe) {
  const inner = Math.round(size * safe);
  const art = await sharp(SOURCE).resize(inner, inner).png().toBuffer();
  const offset = Math.round((size - inner) / 2);
  return sharp(skySvg(size, size)).composite([{ input: art, left: offset, top: offset }]);
}

/**
 * テーマアイコン用の幕のシルエット（黒／透過）。
 * 写真的な絵からは作れないので、房飾りと左右の垂れ幕だけを単純な形で描く。こちらも中央 66.7% に収める
 */
function monochromeSvg(size) {
  const m = (size * (1 - ADAPTIVE_SAFE)) / 2;
  const w = size * ADAPTIVE_SAFE;
  const panel = w * 0.26;
  const valance = w * 0.3;
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <g fill="#000">
        <path d="M ${m} ${m} L ${m + w} ${m} L ${m + w} ${m + valance}
                 Q ${m + w * 0.75} ${m + valance * 1.35} ${m + w * 0.5} ${m + valance}
                 Q ${m + w * 0.25} ${m + valance * 1.35} ${m} ${m + valance} Z"/>
        <path d="M ${m} ${m} L ${m + panel} ${m} L ${m + panel * 0.86} ${m + w} L ${m} ${m + w} Z"/>
        <path d="M ${m + w} ${m} L ${m + w - panel} ${m} L ${m + w - panel * 0.86} ${m + w} L ${m + w} ${m + w} Z"/>
      </g>
    </svg>`,
  );
}

/** Play のフィーチャーグラフィック（1024×500）。正方形の絵を中央に置き、両脇はぼかした同じ絵で埋める */
async function featureGraphic(width, height) {
  const art = await sharp(SOURCE).resize(height, height).png().toBuffer();
  const backdrop = await sharp(SOURCE)
    .resize(width, height, { fit: 'cover' })
    .blur(40)
    .modulate({ brightness: 1.06 })
    .png()
    .toBuffer();
  return sharp(backdrop).composite([{ input: art, left: Math.round((width - height) / 2), top: 0 }]);
}

await write('assets/images/icon.png', fullBleed(1024));
await write('assets/images/favicon.png', fullBleed(96));
// スプラッシュは 200dp 幅で出す（app.json の imageWidth）。512 あれば高密度でも足りる
await write('assets/images/splash-icon.png', fullBleed(512));

await write('public/icons/icon-192.png', fullBleed(192));
await write('public/icons/icon-512.png', fullBleed(512));
await write('public/icons/apple-touch-icon.png', fullBleed(180));
await write('public/icons/maskable-512.png', await insetOnSky(512, MASKABLE_SAFE));

await write('assets/images/android-icon-foreground.png', await insetOnTransparent(1024, ADAPTIVE_SAFE));
await write('assets/images/android-icon-background.png', sharp(skySvg(1024, 1024)));
await write('assets/images/android-icon-monochrome.png', sharp(monochromeSvg(1024)));

await write('../docs/store/feature-graphic.png', await featureGraphic(1024, 500), { fullColor: true });
