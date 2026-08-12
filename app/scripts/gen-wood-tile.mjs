// 机の上ボードの木目タイル生成（チケット13。DESIGN §5「軽量テクスチャ画像1枚」方式）
// 使い方: node scripts/gen-wood-tile.mjs assets/images/wood-tile.png
// - 依存なし（Node 組み込み zlib で PNG エンコード）
// - 512x1024・縦にシームレス（全ての y 依存項は高さで整数周期）
// - 横はタイル境界＝板の継ぎ目なので不連続が見えない
// - 乱数は固定 seed（再生成しても同じ絵。見た目を変えたいときは seed か定数を調整）
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const W = 512;
const H = 1024;
const BASE = [0xc9, 0x9a, 0x68]; // colors.deskWood #C99A68

// ---- 決定的乱数（生成のたびに絵が変わらないように） ----
let seed = 20260812;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

// ---- 板（プランク）ごとのパラメータ。継ぎ目は x=0(=512) と x=256 ----
const PLANKS = [0, 1].map(() => ({
  tint: (rand() * 2 - 1) * 0.035, // 板ごとの明暗差 ±3.5%
  ringCenter: (0.3 + rand() * 0.4) * 256, // 年輪の中心（板内 px）
  ringScale: 30 + rand() * 16, // 年輪の基本間隔 px
  spacingPhase: rand() * Math.PI * 2,
  phase: rand() * Math.PI * 2,
  phase2: rand() * Math.PI * 2,
  waveAmp: 10 + rand() * 8,
}));

// 縦の細い筋ノイズ（x ごとに固定＝縦方向シームレス）
const streak = Array.from({ length: W }, () => (rand() * 2 - 1) * 0.02);
// 筋を少しなめらかに
for (let i = 0; i < W; i++) {
  streak[i] = (streak[i] + streak[(i + 1) % W] + streak[(i + W - 1) % W]) / 3;
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

const rows = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  const rowOff = y * (1 + W * 3);
  rows[rowOff] = 0; // filter: None
  for (let x = 0; x < W; x++) {
    const plankIndex = x < 256 ? 0 : 1;
    const p = PLANKS[plankIndex];
    const plankX0 = plankIndex * 256;

    // 年輪の揺らぎ：低周波の緩いうねりだけ（高周波だと水面に見える）。
    // y は整数周期＝タイル縦方向シームレス
    const t = (y / H) * Math.PI * 2;
    const wave = Math.sin(t + p.phase) * p.waveAmp + Math.sin(t * 3 + p.phase2) * (p.waveAmp * 0.3);

    // 年輪：間隔をなだらかに揺らした位相 u。整数位置に「細く濃い晩材線」、間は広い明るい地
    const d = x - plankX0 - p.ringCenter + wave;
    const spacing = p.ringScale * (1 + 0.35 * Math.sin(d * 0.011 + p.spacingPhase));
    const u = d / spacing;
    const f = u - Math.floor(u); // 0..1
    const nearLine = Math.min(f, 1 - f); // 線（f=0）からの距離
    const lateWood = Math.exp(-((nearLine / 0.09) ** 2)); // 細く濃い線
    const earlyWood = Math.sin(u * Math.PI * 2) * 0.012; // 広くごく薄い濃淡
    // 線ごとに濃さをばらつかせる（均一だと印刷物っぽくなる）
    const ringIndex = Math.round(u) + plankIndex * 1000;
    const ringStrength = 0.045 + (Math.abs(Math.sin(ringIndex * 12.9898 + 4.1414)) % 1) * 0.055;

    let lum = 1 - lateWood * ringStrength + earlyWood + p.tint + streak[x];

    // 板の継ぎ目：溝（暗）＋右側1pxのハイライト（面取りの光）
    const seamDist = ((x % 256) + 256) % 256;
    if (seamDist <= 1 || seamDist >= 254) lum *= 0.86;
    else if (seamDist === 2) lum *= 1.05;

    const o = rowOff + 1 + x * 3;
    rows[o] = clamp(BASE[0] * lum);
    rows[o + 1] = clamp(BASE[1] * lum);
    rows[o + 2] = clamp(BASE[2] * lum);
  }
}

// ---- PNG エンコード ----
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
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(rows, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = process.argv[2] ?? 'wood-tile.png';
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
