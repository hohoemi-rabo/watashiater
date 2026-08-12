/**
 * 端末がネットにつながっているか（チケット19）。
 *
 * 設計判断：
 * - 「オフライン」と断定するのは isConnected が明示的に false のときだけ。
 *   まだ分からない（undefined）ときはオンライン扱い＝これまでの動きを一切変えない
 * - isInternetReachable は見ない。誤って false になると読み込みを永久に止めてしまう。
 *   本当につながっていなければ通信が失敗し、そのときはキャッシュが受け止める
 *   （「Wi-Fi はあるがインターネットが無い」場合だけ数秒サーバーを待つが、
 *     キャッシュの表示が先に出ているのでスピナーも空白も見えない）
 */
import { getNetworkStateAsync, useNetworkState } from 'expo-network';

export function useIsOnline(): boolean {
  const state = useNetworkState();
  return state?.isConnected !== false;
}

/** フックを使えない場所（auth-context の起動処理）用 */
export async function isOnlineNow(): Promise<boolean> {
  try {
    const state = await getNetworkStateAsync();
    return state.isConnected !== false;
  } catch {
    return true;
  }
}
