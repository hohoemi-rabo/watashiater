/**
 * ルートレイアウト。
 * - DESIGN.md の3書体を読み込み、読み終わるまでスプラッシュを保持する
 *   （Expo Go ではフォントのネイティブ埋め込みが使えないため useFonts の実行時ロード）
 * - テーマはライト固定（DESIGN.md §11「黒背景・夜の劇場化」禁止）
 * - ネイティブヘッダは使わない。各画面が SkyBackground と大きな「もどる」を持つ
 */
import { NotoSansJP_400Regular, NotoSansJP_500Medium } from '@expo-google-fonts/noto-sans-jp';
import { ShipporiMincho_400Regular } from '@expo-google-fonts/shippori-mincho';
import { ZenMaruGothic_700Bold } from '@expo-google-fonts/zen-maru-gothic';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { colors } from '@/constants/tokens';

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
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
