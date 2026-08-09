/**
 * ルートレイアウト。
 * - DESIGN.md の3書体を読み込み、読み終わるまでスプラッシュを保持する
 *   （Expo Go ではフォントのネイティブ埋め込みが使えないため useFonts の実行時ロード）
 * - テーマはライト固定（DESIGN.md §11「黒背景・夜の劇場化」禁止）
 * - 認証ガード：未ログイン → onboarding／subject 未登録 → nickname。
 *   ログイン済み＋登録済みは強制遷移しない（onboarding を「つかいかた」として開けるように）
 */
import { NotoSansJP_400Regular, NotoSansJP_500Medium } from '@expo-google-fonts/noto-sans-jp';
import { ShipporiMincho_400Regular } from '@expo-google-fonts/shippori-mincho';
import { ZenMaruGothic_700Bold } from '@expo-google-fonts/zen-maru-gothic';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { RefreshCw } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, spacing } from '@/constants/tokens';
import { AuthProvider, useAuth } from '@/lib/auth-context';

void SplashScreen.preventAutoHideAsync();

// 背景は各画面の SkyBackground が描くが、遷移の一瞬に見えるナビゲータ地の色も
// 夜化させないため、テーマの背景を sky-bottom に合わせておく
const lightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.skyBottom,
    card: colors.cardWhite,
    text: colors.stageNavy,
    primary: colors.curtainRed,
  },
};

function AuthGate({ children }: { children: ReactNode }) {
  const { session, subject, loading, subjectError, refreshSubject } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!session) {
      if (pathname !== '/onboarding') {
        router.replace('/onboarding');
      }
      return;
    }
    // 取得失敗（subjectError）のときはリトライ画面を出すので誘導しない。
    // 「subject なし」と確定した場合だけニックネーム登録へ
    if (!subject && !subjectError && pathname !== '/nickname') {
      router.replace('/nickname');
      return;
    }
    // 登録済みユーザーがニックネーム画面に居たらホームへ返す
    // （二重登録の誤誘導に対する安全網）
    if (subject && pathname === '/nickname') {
      router.replace('/');
    }
  }, [loading, session, subject, subjectError, pathname, router]);

  // セッション復元が終わるまで何も出さない（スプラッシュが出続ける）
  if (loading) {
    return null;
  }

  // 通信失敗で subject を確かめられていない：既存ユーザーをニックネーム登録へ
  // 誤誘導しないよう、リトライ画面で止める
  if (session && !subject && subjectError) {
    return (
      <SkyBackground>
        <View style={styles.errorContent}>
          <AppCard style={styles.errorCard}>
            <AppText variant="cardTitle">よみこめませんでした</AppText>
            <AppText>{subjectError}</AppText>
            <SecondaryButton
              icon={RefreshCw}
              label="もういちど よみこむ"
              onPress={() => void refreshSubject()}
            />
          </AppCard>
        </View>
      </SkyBackground>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorCard: {
    gap: spacing.lg,
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ZenMaruGothic_700Bold,
    NotoSansJP_400Regular,
    NotoSansJP_500Medium,
    ShipporiMincho_400Regular,
  });

  useEffect(() => {
    // フォントが読めない端末でも起動は止めない（エラー時もスプラッシュを閉じる）
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={lightTheme}>
      <AuthProvider>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGate>
      </AuthProvider>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
