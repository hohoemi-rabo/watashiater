/**
 * オフライン閲覧用の端末キャッシュ（チケット19。REQUIREMENTS §4.2「お医者さんナビ方式」）。
 *
 * 設計判断：
 * - 置き場は AsyncStorage（すでに supabase の認証で使っている唯一の永続層。
 *   回答11＋じぶん史1＋写真55行で数十KB しかないため SQLite やファイル管理は要らない）。
 *   1リソース＝1キー＝1回の setItem なので部分書き込みが起きない
 * - キーは wt:v1: 接頭辞。スキーマを変えるときは v2 に上げるだけでよい（移行を書かない）。
 *   消すときは wt: の前方一致で掃くのでバージョンをまたいだゴミが残らない
 * - TTL は設けない。「最後に読めた内容」を保ち続け、取得成功のたびに上書きするだけ。
 *   同期キュー・書き戻し・バックグラウンド更新は作らない（書き込みはオンライン前提）
 * - 消すのはログアウトとアカウント削除のときだけ。家族と共用の端末に別の Google
 *   アカウントが入りうるので、前の人の博物館を残さない方を優先する
 *   （ログインし直すにはどのみち通信が要るため、オフライン閲覧を失う実害はない）
 * - 家族の博物館はキャッシュしない（各フック側で判定）。書き手が家族登録を解除しても
 *   端末に写しが残る事態を作らないため。結果として subject は常に最大1つ＝上限管理が不要
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';

const PREFIX = 'wt:v1:';
/** 全消し用。バージョンをまたいで掃く */
const SWEEP_PREFIX = 'wt:';

export const cacheKeys = {
  auth: `${PREFIX}auth`,
  prompts: (subjectId: string) => `${PREFIX}subject:${subjectId}:prompts`,
  story: (subjectId: string) => `${PREFIX}subject:${subjectId}:story`,
  board: (subjectId: string) => `${PREFIX}subject:${subjectId}:board`,
} as const;

/** 読めない・壊れている場合は null（キャッシュの都合で起動や表示を止めない） */
export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

/** 失敗しても呼び出し側は気にしない（次の取得でまた書ける） */
export async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 空き容量不足など。オフライン閲覧が効かなくなるだけで、オンラインの動作は変わらない
  }
}

/** ログアウト・アカウント削除で呼ぶ。写真の実体（expo-image のディスク）も一緒に消す */
export async function clearOfflineCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((key) => key.startsWith(SWEEP_PREFIX));
    if (ours.length > 0) {
      await AsyncStorage.multiRemove(ours);
    }
  } catch {
    // ここで失敗しても後続（サインアウト・画面遷移）は続ける
  }
  try {
    await Image.clearDiskCache();
  } catch {
    // 同上
  }
}
