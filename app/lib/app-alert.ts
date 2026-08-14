/**
 * Alert.alert の置き換え口（チケット26）。Web は app-alert.web.ts に差し替わる。
 * ファイルごと分けるのは実装が丸ごと違うため（CLAUDE.md の分岐基準1）：
 * react-native-web の Alert は no-op で、確認ダイアログが「押しても何も起きない」＝
 * 離脱ガード（usePreventRemove）だと画面から出られなくなる事故になる。
 *
 * 呼び出し側は Alert.alert と同じ形で使うが、Web が window.confirm（OK/キャンセルの
 * 2択固定）で表現できる範囲に限る：ボタンは最大2つ・style:'cancel' は1つまで。
 * 3ボタンが要る場面は作らない（2段確認は showAlert の onPress 内で showAlert を重ねる）
 */
import { Alert, type AlertButton } from 'react-native';

export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  Alert.alert(title, message, buttons);
}
