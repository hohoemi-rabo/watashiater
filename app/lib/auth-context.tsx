/**
 * 認証状態（セッション＋自分の subject）をアプリ全体に配る Provider。
 *
 * ログインはブラウザ経由の OAuth（Expo Go ではネイティブ Google Sign-In が使えない）：
 * signInWithOAuth で認可 URL をもらい WebBrowser で開く → 戻り URL のトークンで
 * setSession する（Supabase 公式の createSessionFromUrl パターン）。
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

import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { Tables } from '@/types/database.types';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri();

export type Subject = Tables<'subjects'>;

/** signInWithGoogle の結果。dismiss（ユーザーがブラウザを閉じた）はエラー扱いにしない */
type SignInResult = {
  status: 'success' | 'dismissed' | 'error';
  /**
   * success 時のみ。登録済みの subject があるか（遷移判定は必ずこれを使う。
   * context の subject state は setState 直後の再レンダー前だと古い値のままで、
   * ログアウト→再ログインでニックネーム画面へ誤誘導するバグの原因になった）
   */
  hasSubject?: boolean;
  message?: string;
};

type AuthContextValue = {
  /** null = 未ログイン。undefined は無い（loading 中は Provider が画面を出さない） */
  session: Session | null;
  /** ログイン済みでも未登録なら null（→ ニックネーム登録へ） */
  subject: Subject | null;
  /** セッション復元と subject 取得が終わるまで true */
  loading: boolean;
  /** subject の取得に失敗した場合のメッセージ（リトライ導線用） */
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
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /** state を更新しつつ、取得結果を戻り値でも返す（呼び出し直後の判定は戻り値を使う） */
  const loadSubject = useCallback(
    async (userId: string): Promise<{ ok: boolean; subject: Subject | null }> => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('owner_user_id', userId)
        .maybeSingle();
      if (error) {
        setSubjectError(
          'データを よみこめませんでした。でんぱの よいところで もういちど ためしてください。',
        );
        return { ok: false, subject: null };
      }
      setSubjectError(null);
      setSubject(data);
      return { ok: true, subject: data };
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
        await loadSubject(data.session.user.id);
      }
      if (!cancelled) {
        setLoading(false);
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setSubject(null);
        setSubjectError(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [loadSubject]);

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
      return { status: 'success', hasSubject: loaded.ok ? loaded.subject !== null : true };
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
  }, []);

  const refreshSubject = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await loadSubject(data.session.user.id);
    }
  }, [loadSubject]);

  return (
    <AuthContext.Provider
      value={{ session, subject, loading, subjectError, signInWithGoogle, signOut, refreshSubject }}>
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
