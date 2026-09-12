/**
 * オンボーディング／ログイン（REQUIREMENTS §3.1：3枚以内のかんたん説明 → Google ログイン）。
 * ログイン済みのときは「使い方」の説明ページとして機能し、戻るだけを出す
 * （設定「使い方を見る」からの導線）。
 */
import { useRouter } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AddToHomeGuide } from '@/components/add-to-home-guide';
import { AppCard } from '@/components/app-card';
import { AppLogo } from '@/components/app-logo';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
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

  const handleSignIn = async () => {
    setBusy(true);
    setErrorMessage(null);
    const result = await signInWithGoogle();
    setBusy(false);
    if (result.status === 'success') {
      // 遷移判定は必ず result.hasSubject / hasMemberships を使う。context の state を読むと
      // ボタン押下時点の古い値（ログアウト直後＝null）を掴んで誤誘導する
      router.replace(result.hasSubject ? '/' : result.hasMemberships ? '/family' : '/nickname');
      return;
    }
    if (result.status === 'error') {
      setErrorMessage(result.message ?? 'ログインできませんでした。もう一度試してください。');
    }
    // dismissed（ユーザーがブラウザを閉じた）は何も出さない
  };

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content}>
        {session ? <BackButton /> : null}

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

        {session ? null : (
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
  content: {
    gap: spacing.lg,
    padding: spacing.xl,
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
