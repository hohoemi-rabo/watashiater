/**
 * Web のフォント読み込み（チケット25）。
 *
 * Web では `public/fonts/fonts.css` の `@font-face` がブラウザに読ませるので、
 * useFonts には**何も渡さない**。書体名は `constants/tokens.ts` の fonts と
 * CSS 側で一致させてあるので、画面のコードは native と共通のまま動く。
 *
 * この空マップにすることで得られること：
 * - TTF 4本（23MB）が Web バンドルに入らない（import 自体がここに無い）
 * - `useFonts({})` は即座に [true, null] を返すので、フォント待ちで白画面にならない
 * - `@font-face` は実際に使われた書体しか取りに行かない＝
 *   Shippori Mincho はじぶん史を開くまで読み込まれない
 */
export const appFonts = {};
