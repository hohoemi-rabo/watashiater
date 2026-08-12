/**
 * 家族から見た博物館のメニュー（チケット16）。机の上・じぶん史・お題カードへの入り口。
 * subject が RLS で見えない（家族登録が解除された）ときは「見られなくなりました」を出す。
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, Images, ScrollText } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, spacing } from '@/constants/tokens';
import { useSubject } from '@/lib/use-subject';

export default function FamilyMuseumScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId: string }>();
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const { subject, loading, error, refetch } = useSubject(subjectId ?? null);

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />

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

        {!loading && !error && !subject ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">この博物館は 見られなくなりました</AppText>
            <AppText>くわしくは、博物館の もちぬしの方に きいてみてください。</AppText>
          </AppCard>
        ) : null}

        {!loading && !error && subject ? (
          <>
            <AppText variant="screenTitle">{subject.nickname}さんの博物館</AppText>
            <SecondaryButton
              icon={Images}
              label="机の上（しゃしん）"
              onPress={() => router.push(`/family/${subject.id}/gallery`)}
            />
            <SecondaryButton
              icon={ScrollText}
              label="じぶん史"
              onPress={() => router.push(`/family/${subject.id}/story`)}
            />
            <SecondaryButton
              icon={BookOpen}
              label="お題カード"
              onPress={() => router.push(`/family/${subject.id}/prompts`)}
            />
          </>
        ) : null}
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
