/**
 * せってい の骨格。ニックネーム変更・アカウント削除はチケット18で実装する。
 * 「つかいかたを見る」からオンボーディングへ（チケット04で初回起動フローにも組み込む）。
 */
import { useRouter } from 'expo-router';
import { CircleHelp } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { spacing } from '@/constants/tokens';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SkyBackground>
      <View style={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">せってい</AppText>
        <AppCard style={styles.card}>
          <AppText variant="cardTitle">ニックネーム</AppText>
          <AppText variant="caption">（変更はチケット18で実装）</AppText>
        </AppCard>
        <SecondaryButton
          icon={CircleHelp}
          label="つかいかたを見る"
          onPress={() => router.push('/onboarding')}
        />
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
