/**
 * 家族から見たお題カード一覧（チケット16。読み取り専用）。
 * 回答済みのカードをタイトル＋本文全文で並べる（編集はできない。回答画面は書き手専用）。
 * 声の録音があるカードには「声の録音つき」を添える（再生は机の上の写真タップから）。
 */
import { useLocalSearchParams } from 'expo-router';
import { Volume2 } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, spacing } from '@/constants/tokens';
import { useFamilyCards } from '@/lib/use-family-cards';
import { useSubject } from '@/lib/use-subject';

export default function FamilyPromptsScreen() {
  const params = useLocalSearchParams<{ subjectId: string }>();
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;

  const { subject, loading: subjectLoading, error: subjectError } = useSubject(subjectId ?? null);
  const { cards, loading, error, refetch } = useFamilyCards(subjectId ?? null);

  const busy = subjectLoading || loading;
  const anyError = subjectError ?? error;
  const removed = !busy && !anyError && subject === null;

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">
          {subject ? `${subject.nickname}さんのお題カード` : 'お題カード'}
        </AppText>

        {busy ? <ActivityIndicator color={colors.stageNavy} size="large" /> : null}

        {!busy && anyError ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle" style={styles.errorTitle}>
              よみこめませんでした
            </AppText>
            <AppText>{anyError}</AppText>
            <SecondaryButton label="もういちどよみこむ" onPress={() => void refetch()} />
          </AppCard>
        ) : null}

        {removed ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">この博物館は 見られなくなりました</AppText>
          </AppCard>
        ) : null}

        {!busy && !anyError && subject && cards.length === 0 ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">まだ 回答が ありません</AppText>
          </AppCard>
        ) : null}

        {!busy && !anyError && subject
          ? cards.map((card) => (
              <AppCard key={card.answerId} style={styles.card}>
                <AppText variant="cardTitle">{card.title}</AppText>
                {card.bodyText.trim() !== '' ? <AppText>{card.bodyText}</AppText> : null}
                {card.hasRecording ? (
                  <View style={styles.recordingRow}>
                    <Volume2 color={colors.spotYellow} size={16} strokeWidth={2} />
                    <AppText variant="caption">声の録音つき（机の上の写真から聞けます）</AppText>
                  </View>
                ) : null}
              </AppCard>
            ))
          : null}
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  errorTitle: {
    color: colors.errorRed,
  },
  recordingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
