/**
 * ワタシアター デザイントークン（DESIGN.md §3〜§5）
 * web 側の定義（web/tailwind.config.js）と値を一致させること（DESIGN.md §12）
 * 生値のハードコード禁止。UIの色・影・フォント・サイズは必ずここから参照する。
 */

/** DESIGN.md §3 カラーパレット（基本トークン8色＋規定の補助色2つ） */
export const colors = {
  skyTop: '#A8DCF0', // 背景グラデ上端（昼の空）
  skyBottom: '#FDF6E8', // 背景グラデ下端（光のクリーム色）
  cardWhite: '#FFFFFF', // カード面
  curtainRed: '#E0472F', // 幕の朱色。各画面で最も重要なアクション1つにだけ使う
  spotYellow: '#F5B93C', // スポットライトの黄。みたよ・達成・ハイライト（エラーには使わない）
  deskWood: '#C99A68', // 机の上ボードの木肌
  stageNavy: '#2B3A55', // 本文テキスト。真っ黒(#000)は使わない
  textSoft: '#6B7280', // 補助テキスト
  errorRed: '#C0392B', // エラー・削除系（curtain-red と区別する。DESIGN.md §3）
  storyPaper: '#FBF7EF', // じぶん史ページの紙背景（DESIGN.md §4）
} as const;

/**
 * DESIGN.md §5 影スケール（3段階。これ以外の影を発明しない）
 * iOS は shadow*、Android は elevation が効く。elevation は近似値のため
 * Android 実機で必ず目視確認すること（DESIGN.md §5）。
 */
export const shadows = {
  /** 置かれているカード・写真（CSS: y=2 blur=8 α=0.12） */
  rest: {
    shadowColor: colors.stageNavy,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 0.12,
    elevation: 2,
  },
  /** ボタン・タップ可能カード（CSS: y=4 blur=14 α=0.16） */
  raised: {
    shadowColor: colors.stageNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    shadowOpacity: 0.16,
    elevation: 4,
  },
  /** ドラッグ中の写真・モーダル（CSS: y=10 blur=28 α=0.24） */
  lifted: {
    shadowColor: colors.stageNavy,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 28,
    shadowOpacity: 0.24,
    elevation: 10,
  },
} as const;

/**
 * DESIGN.md §4 フォント3種
 * フォント名は @expo-google-fonts の命名。実装時に対応パッケージを導入して
 * useFonts で読み込むこと。
 */
export const fonts = {
  heading: 'ZenMaruGothic_700Bold', // 見出し・ロゴ・ボタン
  body: 'NotoSansJP_400Regular', // 本文・UI
  bodyMedium: 'NotoSansJP_500Medium', // 本文・UI（Medium）
  story: 'ShipporiMincho_400Regular', // じぶん史ページのみ
} as const;

/** DESIGN.md §4 サイズ表（アプリ用スケール。閲覧Webとは別スケール・変更機能なし） */
export const fontSizes = {
  screenTitle: 24, // Bold
  cardTitle: 18, // Bold
  body: 16, // 14px未満を本文に使わない
  caption: 13,
  button: 16, // Bold
  storyBody: 18, // じぶん史ページは読み物なので例外で18pxまで上げてよい
} as const;

/** DESIGN.md §4 行間（本文1.7。じぶん史ページは2.0） */
export const lineHeights = {
  body: 1.7,
  story: 2.0,
} as const;

/** REQUIREMENTS.md §4.1 タップターゲット最小サイズ（dp） */
export const TAP_TARGET_MIN = 48;

/**
 * 余白スケール（app 側の実装規約。チケット03で決定）
 * DESIGN.md に余白の定義は無いため、画面ごとに数値が散らばらないようここで固定する。
 * DESIGN.md §3 の「web と値一致必須」の対象（色8・影3・フォント3・サイズ）ではない
 * （web は Tailwind 標準スケールを使う）。
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
} as const;

/** 角丸スケール（app 側の実装規約。spacing と同じ扱い） */
export const radii = {
  button: 12,
  card: 16,
} as const;
