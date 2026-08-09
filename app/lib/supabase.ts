/**
 * Supabase クライアント（アプリ全体で共有する唯一のインスタンス）。
 * - セッションは AsyncStorage に永続化（再起動で自動ログイン。チケット04）
 * - RN はブラウザと違いフォーカスを自動検知できないため、AppState で
 *   トークン自動リフレッシュを起動/停止する（Supabase 公式指定のパターン）
 * - detectSessionInUrl は false（戻り URL は onboarding 側で明示的に処理する）
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // .env の作り忘れ（新規クローン時）を起動時に明確に知らせる
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が設定されていません。app/.env を用意してください（.env.example 参照）',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
