/**
 * オンボーディング／ログインの骨格（REQUIREMENTS §3.1：3枚以内のかんたん説明 →
 * Google ログイン → ニックネーム登録）。実装はチケット04。
 * 導線：せってい「つかいかたを見る」＋（04で）初回起動時フロー。
 */
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SkyBackground } from '@/components/sky-background';
import { spacing } from '@/constants/tokens';

export default function OnboardingScreen() {
  return (
    <SkyBackground>
      <View style={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">ようこそ</AppText>
        <AppCard style={styles.card}>
          <AppText variant="cardTitle">ワタシアターは、じぶんの博物館です</AppText>
          <AppText>
            お題にこたえるだけで、思い出と写真と声がひとつの博物館になります。（かんたん説明と
            Google ログインはチケット04で実装）
          </AppText>
        </AppCard>
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
