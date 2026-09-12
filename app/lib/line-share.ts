/**
 * LINE へ本文を渡して送る（チケット32）。生徒さんの送り先は事実上 LINE なので、
 * 共有シートを経ずに直接 LINE を開く。
 *
 * 実装の判断：
 * - 使うのは公式ドキュメントの共有リンク `https://line.me/R/share?text=…` だけ
 *   （本文は UTF-8 でパーセントエンコード）。**旧 `line://` スキームは LINE 自身が
 *   非推奨としているので使わない**（2026-09-12 に公式ドキュメントで確認）
 * - ネイティブと Web で URL は同じ＝`Platform.OS` 分岐は要らない。LINE が入っていれば
 *   アプリが開き、入っていなければブラウザで LINE のページが開く
 * - **LINE が入っていないことは検出できない**（https なので openURL は失敗しないし、
 *   `Linking.canOpenURL` は Android 11+ でマニフェストの `<queries>` が無いと常に false）。
 *   LINE を使わない家族向けの受け皿は、画面側に並べた「ほかの方法で送る」に任せる
 * - openURL が throw するのは想定外の失敗のときだけ。押しても何も起きない状態を作らないよう、
 *   そのときだけ共有シートへ落とす（それも失敗したら何も出さない＝コードや URL は画面に見えている）
 */
import { Linking, Share } from 'react-native';

const LINE_SHARE_URL = 'https://line.me/R/share?text=';

export async function shareViaLine(text: string): Promise<void> {
  try {
    await Linking.openURL(`${LINE_SHARE_URL}${encodeURIComponent(text)}`);
    return;
  } catch {
    // LINE 未インストールではここへ来ない（ブラウザが受ける）。想定外の失敗のときだけ下へ
  }
  try {
    await Share.share({ message: text });
  } catch {
    // 共有をやめた等。エラー表示は不要
  }
}
