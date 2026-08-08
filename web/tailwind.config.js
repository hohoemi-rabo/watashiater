/** @type {import('tailwindcss').Config} */
// ワタシアター デザイントークン（DESIGN.md §3〜§5）
// app 側の定義（app/src/constants/tokens.ts）と値を一致させること（DESIGN.md §12）
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // DESIGN.md §3 基本トークン（8色）
        'sky-top': '#A8DCF0', // 背景グラデ上端（昼の空）
        'sky-bottom': '#FDF6E8', // 背景グラデ下端（光のクリーム色）
        'card-white': '#FFFFFF', // カード面
        'curtain-red': '#E0472F', // 幕の朱色。各画面で最も重要なアクション1つにだけ使う
        'spot-yellow': '#F5B93C', // スポットライトの黄。みたよ・達成・ハイライト（エラーには使わない）
        'desk-wood': '#C99A68', // 机の上ボードの木肌
        'stage-navy': '#2B3A55', // 本文テキスト。真っ黒(#000)は使わない
        'text-soft': '#6B7280', // 補助テキスト
        // DESIGN.md §3 使い方のルール：エラー・削除系（curtain-red と区別する）
        'error-red': '#C0392B',
        // DESIGN.md §4：じぶん史ページだけ背景を生成りの紙質にする
        'story-paper': '#FBF7EF',
      },
      boxShadow: {
        // DESIGN.md §5 影スケール（3段階。これ以外の影を発明しない）
        rest: '0 2px 8px rgba(43, 58, 85, 0.12)', // 置かれているカード・写真
        raised: '0 4px 14px rgba(43, 58, 85, 0.16)', // ボタン・タップ可能カード
        lifted: '0 10px 28px rgba(43, 58, 85, 0.24)', // ドラッグ中の写真・モーダル
      },
      fontFamily: {
        // DESIGN.md §4 フォント3種（next/font で読み込み、CSS変数で受け渡す想定）
        heading: ['var(--font-zen-maru-gothic)', 'sans-serif'], // 見出し・ロゴ・ボタン（Bold）
        body: ['var(--font-noto-sans-jp)', 'sans-serif'], // 本文・UI
        story: ['var(--font-shippori-mincho)', 'serif'], // じぶん史ページのみ
      },
      fontSize: {
        // DESIGN.md §4 サイズ表（閲覧Web用スケール。アプリとは別スケール・変更機能なし）
        'screen-title': ['28px', { fontWeight: '700' }],
        'card-title': ['20px', { fontWeight: '700' }],
        body: ['18px', { lineHeight: '1.8' }],
        caption: ['14px'],
        button: ['18px', { fontWeight: '700' }],
        'story-body': ['18px', { lineHeight: '2.0' }], // じぶん史ページの行間は 2.0
      },
      backgroundImage: ({ theme }) => ({
        // DESIGN.md §3：背景は常に sky-top → sky-bottom の縦グラデーション（全画面共通）
        sky: `linear-gradient(to bottom, ${theme('colors.sky-top')}, ${theme('colors.sky-bottom')})`,
      }),
    },
  },
  plugins: [],
}
