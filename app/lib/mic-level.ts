/**
 * 録音中のマイク入力レベル（0〜1）の取得口（チケット26）。Web は mic-level.web.ts に
 * 差し替わる。ファイルごと分けるのは、Web 実装がブラウザ専用 API（AudioContext /
 * AnalyserNode）だけで書かれており native バンドルに入れる意味がないため
 * （CLAUDE.md の分岐基準1）。
 * native のレベルは recorderState.metering が担うので、こちらは何もしない：
 * read() が undefined を返し、呼び出し側（recording-box）が metering に切り替える
 */
export const micLevelMeter = {
  /** 録音ボタン押下の同期スタック内で呼ぶ（Web の AudioContext 都合。native は no-op） */
  prime(): void {},
  /** prepareToRecordAsync() の後に recorder を渡す（native は no-op） */
  attach(_recorder: unknown): void {},
  /** 現在のレベル 0〜1。native は常に undefined（metering を使う） */
  read(): number | undefined {
    return undefined;
  },
  detach(): void {},
};
