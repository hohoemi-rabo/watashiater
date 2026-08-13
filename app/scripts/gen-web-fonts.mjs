// 書き手Web（PWA）のフォント CSS 生成（チケット25。DESIGN §4 の3書体）
// 使い方: node scripts/gen-web-fonts.mjs
//
// なぜこれが要るか：
//   ネイティブは @expo-google-fonts の TTF を useFonts で読むが、同じ経路を Web でも通すと
//   **4ウェイトで 23MB** をブラウザに配ることになる（チケット24 の Web 出力で実測）。
//   Web は CSS の @font-face に切り替える。@font-face は「実際に使われた書体しか落ちない」ので、
//   じぶん史を開くまで Shippori Mincho は読み込まれない。
//
// 方式（チケット25 でユーザーが選択）：
//   CSS は自前で持ち、woff2 の本体は fonts.gstatic.com から読む。
//   Google の CSS は unicode-range で 492 スライスに分かれていて、ブラウザは
//   **画面に出る文字を含むスライスだけ**を取りに行く（初回およそ 200KB）。
//   自前でサブセットを作ると全ウェイトぶんを丸ごと落とすことになり、この賢さを捨てることになる。
//
// 生成物 public/fonts/fonts.css は**コミットする**（wood-tile.png と同じ扱い）。
//   ビルド時にネットワークを使わないため、Vercel のビルドが Google の都合で落ちない。

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/fonts/fonts.css');

const CSS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Noto+Sans+JP:wght@400;500' +
  '&family=Shippori+Mincho' +
  '&family=Zen+Maru+Gothic:wght@700' +
  '&display=swap';

// Google は User-Agent で応答を変える。woff2＋unicode-range が返る現代ブラウザとして名乗る
// （対象は iPhone Safari と PC Chrome/Edge。どちらも woff2 対応。docs/24 の対応表）
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

// Google の書体名 → constants/tokens.ts の fonts が指す名前。
// **この対応があるおかげで tokens.ts も各画面も変えずに済む**（RN Web は
// fontFamily をそのまま CSS の font-family として出すため、名前さえ合っていればよい）
const FAMILY_MAP = {
  'Noto Sans JP|400': 'NotoSansJP_400Regular',
  'Noto Sans JP|500': 'NotoSansJP_500Medium',
  'Zen Maru Gothic|700': 'ZenMaruGothic_700Bold',
  'Shippori Mincho|400': 'ShipporiMincho_400Regular',
};

/** @font-face ブロックから欲しい値だけ抜く */
function parseFace(block) {
  const pick = (prop) => block.match(new RegExp(`${prop}:\\s*([^;]+);`))?.[1]?.trim();
  return {
    family: pick('font-family')?.replace(/^['"]|['"]$/g, ''),
    weight: pick('font-weight'),
    src: pick('src'),
    unicodeRange: pick('unicode-range'),
  };
}

const response = await fetch(CSS_URL, { headers: { 'user-agent': UA } });
if (!response.ok) {
  throw new Error(`Google Fonts の CSS を取得できませんでした: ${response.status}`);
}
const source = await response.text();

const blocks = source.match(/@font-face\s*\{[^}]*\}/g) ?? [];
if (blocks.length === 0) {
  throw new Error('@font-face が1つも見つかりません。CSS の形式が変わった可能性があります');
}

const seen = new Set();
const rules = [];
for (const block of blocks) {
  const face = parseFace(block);
  const key = `${face.family}|${face.weight}`;
  const name = FAMILY_MAP[key];
  // 想定外の family/weight は黙って捨てない。Google 側の変更で書体が1つ欠けたまま
  // 出荷されるほうが、生成が失敗するより高くつく
  if (!name) {
    throw new Error(`対応表にない書体です: ${key}`);
  }
  if (!face.src || !face.unicodeRange) {
    throw new Error(`src か unicode-range が読めません: ${key}`);
  }
  seen.add(key);
  rules.push(
    [
      '@font-face {',
      `  font-family: '${name}';`,
      '  font-style: normal;',
      // 太さは範囲で宣言する。書体名にウェイトが含まれている（＝1名前1ファイル）ので、
      // 呼び出し側が fontWeight: 'bold' を付けても合成太字にせずこのファイルを使わせたい
      '  font-weight: 100 900;',
      '  font-display: swap;',
      `  src: ${face.src};`,
      `  unicode-range: ${face.unicodeRange};`,
      '}',
    ].join('\n'),
  );
}

const missing = Object.keys(FAMILY_MAP).filter((key) => !seen.has(key));
if (missing.length > 0) {
  throw new Error(`応答に含まれなかった書体があります: ${missing.join(', ')}`);
}

const header = [
  '/*',
  ' * 自動生成（app/scripts/gen-web-fonts.mjs）。手で編集しない。',
  ' * 書き手Web（PWA）のフォント。書体名は constants/tokens.ts の fonts と一致させてある。',
  ' * woff2 の本体は fonts.gstatic.com にあり、unicode-range によって',
  ' * 画面に出る文字を含むスライスだけが読み込まれる（チケット25）。',
  ' */',
  '',
].join('\n');

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${header}${rules.join('\n\n')}\n`);

const counts = {};
for (const block of blocks) {
  const face = parseFace(block);
  const name = FAMILY_MAP[`${face.family}|${face.weight}`];
  counts[name] = (counts[name] ?? 0) + 1;
}
console.log(`${OUT} を書きました（${rules.length} スライス）`);
for (const [name, count] of Object.entries(counts)) {
  console.log(`  ${name}: ${count}`);
}
