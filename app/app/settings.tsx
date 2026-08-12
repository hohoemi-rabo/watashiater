/**
 * せってい の骨格。ニックネーム変更・アカウント削除はチケット18で実装する。
 * 「つかいかたを見る」からオンボーディングへ。ログアウトは認証の最小機能として
 * チケット04で実装（破壊的操作なので確認ダイアログを挟む。REQUIREMENTS §4.1）。
 */
import { useRouter } from 'expo-router';
import { CircleHelp, LogOut, Users } from 'lucide-react-native';
import { Alert, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';

export default function SettingsScreen() {
  const router = useRouter();
  const { subject, signOut } = useAuth();

  const confirmSignOut = () => {
    Alert.alert('ログアウトしますか？', 'また Google でログインすれば、つづきから つかえます。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: 'ログアウトする',
        style: 'destructive',
        onPress: () => {
          void signOut();
          // ガードが onboarding へ送るが、明示的にも遷移しておく
          router.replace('/onboarding');
        },
      },
    ]);
  };

  return (
    <SkyBackground>
      <View style={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">せってい</AppText>
        <AppCard style={styles.card}>
          <AppText variant="cardTitle">ニックネーム</AppText>
          <AppText>{subject?.nickname ?? '（みとうろく）'}</AppText>
          <AppText variant="caption">（変更はチケット18で実装）</AppText>
        </AppCard>
        <SecondaryButton
          icon={CircleHelp}
          label="つかいかたを見る"
          onPress={() => router.push('/onboarding')}
        />
        {/* 自分の博物館を持つ人が家族側（招待コード入力・閲覧）へ入る導線（チケット16） */}
        <SecondaryButton
          icon={Users}
          label="かぞくの博物館"
          onPress={() => router.push('/family')}
        />
        <SecondaryButton icon={LogOut} label="ログアウト" onPress={confirmSignOut} />
      </View>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    padding: spacing.xl,
  },
  card: {
    gap: spacing.md,
  },
});
