/**
 * かぞくの博物館ハブ（チケット16）。自分が家族として登録されている博物館の一覧と、
 * 招待コード入力への導線。家族専用アカウント（自分の博物館なし）のホームでもあるため、
 * ここにログアウトを置く（settings は subject 前提の画面なので家族専用だと到達できない）。
 */
import { useRouter } from 'expo-router';
import { DoorOpen, KeyRound, LogOut } from 'lucide-react-native';
import { ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';
import { useFamilyMuseums } from '@/lib/use-family-museums';

export default function FamilyHubScreen() {
  const router = useRouter();
  const { subject, signOut } = useAuth();
  const { museums, loading, error, refetch } = useFamilyMuseums();

  const confirmSignOut = () => {
    Alert.alert('ログアウトしますか？', 'また Google でログインすれば、つづきから つかえます。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: 'ログアウトする',
        style: 'destructive',
        onPress: () => {
          void signOut();
          router.replace('/onboarding');
        },
      },
    ]);
  };

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 自分の博物館を持つ人は settings から来る＝もどれる。家族専用はここがホーム */}
        {subject ? <BackButton /> : null}
        <AppText variant="screenTitle">かぞくの博物館</AppText>

        {loading ? <ActivityIndicator color={colors.stageNavy} size="large" /> : null}

        {!loading && error ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle" style={styles.errorTitle}>
              よみこめませんでした
            </AppText>
            <AppText>{error}</AppText>
            <SecondaryButton label="もういちどよみこむ" onPress={() => void refetch()} />
          </AppCard>
        ) : null}

        {!loading && !error && museums.length === 0 ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">まだ 登録した博物館が ありません</AppText>
            <AppText>招待コードを もらったら、下のボタンから 登録してください。</AppText>
          </AppCard>
        ) : null}

        {/* 博物館は複数ありうるので curtainRed（1画面1アクション）は使わない（DESIGN §3） */}
        {!loading && !error
          ? museums.map((museum) => (
              <AppCard key={museum.membershipId} shadow="raised" style={styles.card}>
                <AppText variant="cardTitle">{museum.nickname}さんの博物館</AppText>
                <SecondaryButton
                  icon={DoorOpen}
                  label="博物館に入る"
                  onPress={() => router.push(`/family/${museum.subjectId}`)}
                />
              </AppCard>
            ))
          : null}

        <SecondaryButton
          icon={KeyRound}
          label="招待コードで登録する"
          onPress={() => router.push('/join')}
        />
        {subject ? null : (
          <SecondaryButton icon={LogOut} label="ログアウト" onPress={confirmSignOut} />
        )}
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  content: {
    gap: spacing.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  errorTitle: {
    color: colors.errorRed,
  },
});
