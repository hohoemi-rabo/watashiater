/**
 * 家族から見た博物館のメニュー（チケット16）。机の上・自分史・お題カードへの入り口。
 * subject が RLS で見えない（家族登録が解除された）ときは「見られなくなりました」を出す。
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, Images, ScrollText } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
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
      <View style={styles.header}>
        <ScreenHeader showHome />
      </View>
      <ScrollView contentContainerStyle={styles.content}>

        {loading ? <ActivityIndicator color={colors.stageNavy} size="large" /> : null}

        {!loading && error ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle" style={styles.errorTitle}>
              読み込めませんでした
            </AppText>
            <AppText>{error}</AppText>
            <SecondaryButton label="もう一度読み込む" onPress={() => void refetch()} />
          </AppCard>
        ) : null}

        {!loading && !error && !subject ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">この博物館は見られなくなりました</AppText>
            <AppText>詳しくは、博物館の持ち主の方に聞いてみてください。</AppText>
          </AppCard>
        ) : null}

        {!loading && !error && subject ? (
          <>
            <AppText variant="screenTitle">{subject.nickname}さんの博物館</AppText>
            <SecondaryButton
              icon={Images}
              label="ギャラリー（写真）"
              onPress={() => router.push(`/family/${subject.id}/gallery`)}
            />
            <SecondaryButton
              icon={ScrollText}
              label="自分史"
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
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  card: {
    gap: spacing.lg,
  },
  content: {
    gap: spacing.xxl,
    padding: spacing.xl,
    // 上余白はヘッダー側が持つので、ここは「戻る」と見出しの間
    paddingTop: spacing.xxl,
    paddingBottom: spacing.section,
  },
  errorTitle: {
    color: colors.errorRed,
  },
});
