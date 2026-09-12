/**
 * オンボーディング／ログイン（REQUIREMENTS §3.1：3枚以内のかんたん説明 → Google ログイン）。
 * ログイン済みのときは「使い方」の説明ページとして機能し、戻るだけを出す
 * （設定「使い方を見る」からの導線）。
 */
import { useRouter } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AddToHomeGuide } from '@/components/add-to-home-guide';
import { AppCard } from '@/components/app-card';
import { AppLogo } from '@/components/app-logo';
import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { PrimaryButton } from '@/components/primary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';

const GUIDE_CARDS = [
  {
    title: 'お題に答える',
    body: '「子どものころの話」など、決まったお題に好きなだけ答えます。全部答えなくても大丈夫。',
  },
  {
    title: '写真と声をのせる',
    body: '思い出の写真を添えたり、自分の声で話して残せます。',
  },
  {
    title: '家族に見せる',
    body: 'できあがった「自分の博物館」は、リンクひとつでお孫さんにも見てもらえます。',
  },
] as const;

export default function OnboardingScreen() {
  const { session, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /**
   * ログイン済みとして扱うかどうか。**ログイン処理中は session が入っても「まだ」扱いにする**：
   * ブラウザから戻ると session が先に入るので、そのまま反映すると遷移までの一瞬だけ
   * 戻る／ホームのヘッダーが現れて画面が飛び跳ねる（2026-09-12 ユーザー指摘）
   */
  const signedIn = Boolean(session) && !busy;

  const handleSignIn = async () => {
    setBusy(true);
    setErrorMessage(null);
    const result = await signInWithGoogle();
    if (result.status === 'success') {
      // **busy は落とさない**：落とすと遷移までの一瞬だけログイン前の姿
      // （「Google でログイン」ボタン）に描き直され、「ログインできていない画面が出た」
      // ように見える（2026-09-12 ユーザー指摘）。この画面はこのあとすぐ外れる
      //
      // 遷移判定は必ず result.hasSubject / hasMemberships を使う。context の state を読むと
      // ボタン押下時点の古い値（ログアウト直後＝null）を掴んで誤誘導する
      router.replace(result.hasSubject ? '/' : result.hasMemberships ? '/family' : '/nickname');
      return;
    }
    setBusy(false);
    if (result.status === 'error') {
      setErrorMessage(result.message ?? 'ログインできませんでした。もう一度試してください。');
    }
    // dismissed（ユーザーがブラウザを閉じた）は何も出さない
  };

  return (
    <SkyBackground>
      {/* ログイン前はこの画面が入口なので戻る先が無い。設定の「使い方」から来たときだけ出す */}
      {signedIn ? (
        <View style={styles.header}>
          <ScreenHeader showHome />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.content}>

        <AppLogo />
        <AppText style={styles.lead}>自分の博物館を作りましょう</AppText>

        {GUIDE_CARDS.map((card, index) => (
          <AppCard key={card.title} shadow="rest" style={styles.card}>
            <AppText variant="cardTitle">
              {index + 1}. {card.title}
            </AppText>
            <AppText>{card.body}</AppText>
          </AppCard>
        ))}

        {/* iPhone Safari のときだけ出る「ホーム画面に追加」の手順（チケット27）。
            ログイン前の初見でも、設定「使い方を見る」の再訪でも見える位置に置く */}
        <AddToHomeGuide />

        {signedIn ? null : (
          <>
            <PrimaryButton
              icon={LogIn}
              label={busy ? 'ログインしています…' : 'Google でログイン'}
              onPress={() => void handleSignIn()}
              disabled={busy}
            />
            {errorMessage ? (
              <AppCard style={styles.card}>
                <AppText variant="cardTitle" style={styles.errorTitle}>
                  うまくいきませんでした
                </AppText>
                <AppText>{errorMessage}</AppText>
              </AppCard>
            ) : null}
          </>
        )}
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.xl,
    // 上余白はヘッダー側が持つので、ここは「戻る」と見出しの間
    paddingTop: spacing.xxl,
    paddingBottom: spacing.section,
  },
  lead: {
    textAlign: 'center',
  },
  card: {
    gap: spacing.sm,
  },
  errorTitle: {
    color: colors.errorRed,
  },
});
