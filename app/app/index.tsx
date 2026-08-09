/**
 * ホーム（ハブ）。DESIGN.md §7：上部ロゴ／中央に進捗と「つづきをかく」／下部にギャラリーへの入り口。
 * 進捗表示（演目札ドット）はチケット05、認証ガードはチケット04で実装する。ここは骨格。
 */
import { useRouter } from 'expo-router';
import { BookOpen, Images, ScrollText, Settings, Share2 } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { PrimaryButton } from '@/components/primary-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';

export default function HomeScreen() {
  const router = useRouter();
  const { subject } = useAuth();

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="screenTitle" style={styles.logo}>
          ワタシアター
        </AppText>

        <AppCard shadow="raised" style={styles.progressCard}>
          <AppText variant="cardTitle">
            {subject ? `${subject.nickname}さんの博物館` : 'わたしの博物館'}
          </AppText>
          <AppText>10このうち 0こ こたえました</AppText>
          <PrimaryButton
            icon={BookOpen}
            label="つづきをかく"
            onPress={() => router.push('/prompts')}
          />
        </AppCard>

        <View style={styles.menu}>
          <SecondaryButton
            icon={Images}
            label="ギャラリー（机の上）"
            onPress={() => router.push('/gallery')}
          />
          <SecondaryButton
            icon={ScrollText}
            label="じぶん史"
            onPress={() => router.push('/story')}
          />
          <SecondaryButton
            icon={Share2}
            label="みんなに見せる"
            onPress={() => router.push('/share')}
          />
          <SecondaryButton
            icon={Settings}
            label="せってい"
            onPress={() => router.push('/settings')}
          />
        </View>
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  logo: {
    color: colors.curtainRed,
    textAlign: 'center',
  },
  progressCard: {
    gap: spacing.lg,
  },
  menu: {
    gap: spacing.lg,
  },
});
