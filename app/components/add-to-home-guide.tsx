/**
 * 「ホーム画面に追加」の案内カード（チケット27）。Web は add-to-home-guide.web.tsx に
 * 差し替わる。ファイルごと分けるのは、表示判定がブラウザ専用 API（navigator /
 * matchMedia）だけで書かれており native では意味を持たないため（CLAUDE.md の分岐基準1）。
 * native アプリはストアから入れるので案内自体が不要＝常に何も描かない
 */
export function AddToHomeGuide() {
  return null;
}
