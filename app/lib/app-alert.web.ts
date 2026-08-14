/**
 * app-alert.ts の Web 実装（チケット26）。react-native-web の Alert は no-op なので、
 * ブラウザ標準の window.alert / window.confirm で同じ契約を満たす。
 * 標準ダイアログを選んだ理由：自前のモーダルより確実（レイヤー順・フォーカスの奪い合いが
 * 無い）で、シニアにも OS なじみの見た目になる。ボタン文言は OK/キャンセル固定に
 * なってしまうため、元のボタン文言は本文の末尾に「OK＝〜」の形で添える
 */
import type { AlertButton } from 'react-native';

export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const actions = buttons ?? [];
  // Alert の慣習どおり、実行ボタンは cancel 以外の最後の1つ
  const confirmButton = [...actions].reverse().find((button) => button.style !== 'cancel');
  const cancelButton = actions.find((button) => button.style === 'cancel');
  const baseText = message ? `${title}\n\n${message}` : title;

  // ボタンが1つ以下＝情報表示。window.alert（OK のみ）で足りる
  if (actions.length <= 1 || !confirmButton) {
    window.alert(baseText);
    actions[0]?.onPress?.();
    return;
  }

  const text = `${baseText}\n\nOK＝${confirmButton.text} ／ キャンセル＝${cancelButton?.text ?? 'やめる'}`;
  if (window.confirm(text)) {
    confirmButton.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
