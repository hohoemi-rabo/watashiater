/**
 * オンボーディング／ログイン（REQUIREMENTS §3.1：3枚以内のかんたん説明 → Google ログイン）。
 * ログイン済みのときは「つかいかた」の説明ページとして機能し、もどるだけを出す
 * （せってい「つかいかたを見る」からの導線）。
 */
import { useRouter } from 'expo-router';
import { LogIn } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { PrimaryButton } from '@/components/primary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';

const GUIDE_CARDS = [
  {
    title: 'お題に こたえる',
    body: '「子どものころの話」など、きまった お題に すきなだけ こたえます。ぜんぶ こたえなくても だいじょうぶ。',
  },
  {
    title: 'しゃしんと 声を のせる',
    body: 'おもいでの しゃしんを そえたり、じぶんの 声で はなして のこせます。',
  },
  {
    title: 'かぞくに 見せる',
    body: 'できあがった「じぶんの博物館」は、リンクひとつで おまごさんにも 見てもらえます。',
  },
] as const;

export default function OnboardingScreen() {
  const { session, subject, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setBusy(true);
    setErrorMessage(null);
    const result = await signInWithGoogle();
    setBusy(false);
    if (result.status === 'success') {
      // ガード任せにせず明示的に遷移する（subject は signIn 内で取得済み）
      router.replace(subject ? '/' : '/nickname');
      return;
    }
    if (result.status === 'error') {
      setErrorMessage(result.message ?? 'ログインできませんでした。もういちど ためしてください。');
    }
    // dismissed（ユーザーがブラウザを閉じた）は何も出さない
  };

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content}>
        {session ? <BackButton /> : null}

        <AppText variant="screenTitle" style={styles.logo}>
          ワタシアター
        </AppText>
        <AppText style={styles.lead}>じぶんの博物館を つくりましょう</AppText>

        {GUIDE_CARDS.map((card, index) => (
          <AppCard key={card.title} shadow="rest" style={styles.card}>
            <AppText variant="cardTitle">
              {index + 1}. {card.title}
            </AppText>
            <AppText>{card.body}</AppText>
          </AppCard>
        ))}

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
                  うまく いきませんでした
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
  logo: {
    color: colors.curtainRed,
    textAlign: 'center',
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
