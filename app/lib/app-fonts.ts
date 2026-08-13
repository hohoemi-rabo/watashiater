/**
 * ネイティブのフォント読み込み（DESIGN.md §4 の3書体）。
 *
 * **フォントは必ずウェイトのサブパスから import する**。@expo-google-fonts の
 * パッケージ index は全ウェイトを require しているため、ルートから import すると
 * 使わない Thin〜Black まで全部バンドルに入る（日本語書体は1ウェイト 4〜8MB）。
 *
 * Web は `app-fonts.web.ts` に差し替わる（チケット25）。ファイルごと分けているのは、
 * `Platform.OS` の分岐では **import 文が残って Metro が TTF を Web バンドルに同梱してしまう**ため。
 * ここを分けたことで Web 出力から TTF 4本 23MB が消える。
 */
import { NotoSansJP_400Regular } from '@expo-google-fonts/noto-sans-jp/400Regular';
import { NotoSansJP_500Medium } from '@expo-google-fonts/noto-sans-jp/500Medium';
import { ShipporiMincho_400Regular } from '@expo-google-fonts/shippori-mincho/400Regular';
import { ZenMaruGothic_700Bold } from '@expo-google-fonts/zen-maru-gothic/700Bold';

export const appFonts = {
  ZenMaruGothic_700Bold,
  NotoSansJP_400Regular,
  NotoSansJP_500Medium,
  ShipporiMincho_400Regular,
};
