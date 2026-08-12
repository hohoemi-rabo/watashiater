/**
 * 認証状態（セッション＋自分の subject＋家族としての登録）をアプリ全体に配る Provider。
 *
 * ログインはブラウザ経由の OAuth（Expo Go ではネイティブ Google Sign-In が使えない）：
 * signInWithOAuth で認可 URL をもらい WebBrowser で開く → 戻り URL のトークンで
 * setSession する（Supabase 公式の createSessionFromUrl パターン）。
 *
 * オフライン時のふるまい（チケット19）：最後に取れた subject / memberships を端末に
 * 残し、通信できないときはそこから戻す（restoredFromCache）。機内モードで開き直しても
 * ログイン画面に飛ばさないため。
 * セキュリティ：これは認証の迂回ではない。キャッシュから戻すのは「この端末で前に
 * 読み込んだ自分のデータの写し」だけで、サーバーへの問い合わせは従来どおり有効な
 * トークンを要求する（セッションが無い間は問い合わせ自体を行わない）。
 */
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { cacheKeys, clearOfflineCache, readCache, writeCache } from '@/lib/offline-cache';
import { supabase } from '@/lib/supabase';
import { isOnlineNow } from '@/lib/use-online';
import type { Session } from '@supabase/supabase-js';
import type { Tables } from '@/types/database.types';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri();

export type Subject = Tables<'subjects'>;
/** 自分が家族として登録されている博物館（チケット16。/family の導線判定と一覧に使う） */
export type Membership = Pick<Tables<'family_members'>, 'id' | 'subject_id' | 'display_name'>;

/** signInWithGoogle の結果。dismiss（ユーザーがブラウザを閉じた）はエラー扱いにしない */
type SignInResult = {
  status: 'success' | 'dismissed' | 'error';
  /**
   * success 時のみ。登録済みの subject があるか（遷移判定は必ずこれを使う。
   * context の subject state は setState 直後の再レンダー前だと古い値のままで、
   * ログアウト→再ログインでニックネーム画面へ誤誘導するバグの原因になった）
   */
  hasSubject?: boolean;
  /** success 時のみ。家族としての登録が1件以上あるか（hasSubject と同じ理由で戻り値） */
  hasMemberships?: boolean;
  message?: string;
};

/** 端末に残す認証まわりのスナップショット（チケット19） */
type CachedAuth = { userId: string; subject: Subject | null; memberships: Membership[] };

type AuthContextValue = {
  /** null = 未ログイン。undefined は無い（loading 中は Provider が画面を出さない） */
  session: Session | null;
  /** ログイン済みでも未登録なら null（→ ニックネーム登録へ） */
  subject: Subject | null;
  /** 家族として登録されている博物館の一覧（無ければ空配列） */
  memberships: Membership[];
  /** subject / memberships が端末キャッシュ由来（＝オフライン表示中）か（チケット19） */
  restoredFromCache: boolean;
  /** セッション復元と subject 取得が終わるまで true */
  loading: boolean;
  /** subject / memberships の取得に失敗した場合のメッセージ（リトライ導線用） */
  subjectError: string | null;
  signInWithGoogle: () => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshSubject: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) {
    throw new Error(errorCode);
  }
  const { access_token: accessToken, refresh_token: refreshToken } = params;
  if (!accessToken || !refreshToken) {
    return null;
  }
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    throw error;
  }
  return data.session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [restoredFromCache, setRestoredFromCache] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * subject（自分の博物館）と memberships（家族登録）を並列で取得する。
   * state を更新しつつ、取得結果を戻り値でも返す（呼び出し直後の判定は戻り値を使う）。
   * どちらか一方でも失敗したら subjectError（単一のエラー state。AuthGate のリトライ画面が引き受ける）
   *
   * @param allowCache 取得に失敗したとき、この端末のキャッシュから戻してよいか（チケット19）。
   *   起動時と電波復帰時だけ true。ログイン直後は false（遷移判定を鈍らせない）
   */
  const loadSubject = useCallback(
    async (
      userId: string,
      allowCache = false,
    ): Promise<{ ok: boolean; subject: Subject | null; memberships: Membership[] }> => {
      const [subjectResult, membershipsResult] = await Promise.all([
        supabase.from('subjects').select('*').eq('owner_user_id', userId).maybeSingle(),
        supabase
          .from('family_members')
          .select('id, subject_id, display_name')
          .eq('member_user_id', userId),
      ]);
      if (subjectResult.error || membershipsResult.error) {
        if (allowCache) {
          const cached = await readCache<CachedAuth>(cacheKeys.auth);
          // 同じ人の端末キャッシュだけ戻す（別アカウントが入ったら復元しない）
          if (cached && cached.userId === userId) {
            setMemberships(cached.memberships);
            setSubject(cached.subject);
            setSubjectError(null);
            setRestoredFromCache(true);
            return { ok: false, subject: cached.subject, memberships: cached.memberships };
          }
        }
        setSubjectError(
          'データを よみこめませんでした。でんぱの よいところで もういちど ためしてください。',
        );
        return { ok: false, subject: null, memberships: [] };
      }
      setSubjectError(null);
      setRestoredFromCache(false);
      // memberships → subject の順で反映（AuthGate は subject を見て誘導するため、
      // 家族専用アカウントが一瞬 /nickname に飛ぶ隙間を作らない）
      setMemberships(membershipsResult.data);
      setSubject(subjectResult.data);
      void writeCache(cacheKeys.auth, {
        userId,
        subject: subjectResult.data,
        memberships: membershipsResult.data,
      } satisfies CachedAuth);
      return { ok: true, subject: subjectResult.data, memberships: membershipsResult.data };
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) {
        return;
      }
      setSession(data.session);
      if (data.session) {
        await loadSubject(data.session.user.id, true);
      } else {
        // セッションが無い＝ふつうは未ログイン。ただし機内モードでは、期限切れの
        // アクセストークンを更新できずに null が返る（GoTrue はネットワーク失敗では
        // セッションを消さない）。前にこの端末でログインした人なら onboarding へ
        // 飛ばさず、キャッシュした博物館を見せる（チケット19。REQUIREMENTS §4.2）
        const cached = await readCache<CachedAuth>(cacheKeys.auth);
        if (cached && !(await isOnlineNow()) && !cancelled) {
          setMemberships(cached.memberships);
          setSubject(cached.subject);
          setRestoredFromCache(true);
        }
      }
      if (!cancelled) {
        setLoading(false);
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      // 捨てるのは明示的なログアウトのときだけ。`!nextSession` で捨てると、
      // 起動直後に届く INITIAL_SESSION(null) がキャッシュ復元を消してしまう（チケット19）
      if (event === 'SIGNED_OUT') {
        setSubject(null);
        setMemberships([]);
        setSubjectError(null);
        setRestoredFromCache(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [loadSubject]);

  // 電波が戻ってセッションも生きているなら、キャッシュ表示から静かに最新へ入れ替える
  // （失敗しても deps が変わらないのでループしない）
  useEffect(() => {
    if (session && restoredFromCache) {
      void loadSubject(session.user.id, true);
    }
  }, [session, restoredFromCache, loadSubject]);

  const signInWithGoogle = useCallback(async (): Promise<SignInResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        return {
          status: 'error',
          message: 'ログインの じゅんびが できませんでした。もういちど ためしてください。',
        };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') {
        return { status: 'dismissed' };
      }

      const newSession = await createSessionFromUrl(result.url);
      if (!newSession) {
        return {
          status: 'error',
          message: 'ログインできませんでした。もういちど ためしてください。',
        };
      }
      const loaded = await loadSubject(newSession.user.id);
      // 取得に失敗したときは hasSubject: true を返してニックネーム登録へは送らない
      // （既存ユーザーの二重登録誘導を防ぐ。AuthGate のリトライ画面が引き受ける）
      return {
        status: 'success',
        hasSubject: loaded.ok ? loaded.subject !== null : true,
        hasMemberships: loaded.ok ? loaded.memberships.length > 0 : false,
      };
    } catch {
      return {
        status: 'error',
        message:
          'ログインできませんでした。インターネットに つながっているか たしかめて、もういちど ためしてください。',
      };
    }
  }, [loadSubject]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // 家族と共用の端末に別の Google アカウントが入りうるので、前の人の博物館を残さない
    // （ログインし直すにはどのみち通信が要るため、オフライン閲覧を失う実害はない）
    await clearOfflineCache();
  }, []);

  const refreshSubject = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await loadSubject(data.session.user.id);
    }
  }, [loadSubject]);

  return (
    <AuthContext.Provider
      value={{
        session,
        subject,
        memberships,
        restoredFromCache,
        loading,
        subjectError,
        signInWithGoogle,
        signOut,
        refreshSubject,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth は AuthProvider の中でだけ使えます');
  }
  return value;
}
