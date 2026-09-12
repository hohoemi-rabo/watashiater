/**
 * 家族から見た自分史（チケット16。読み取り専用＋見たよ）。
 * story.tsx の閲覧部分だけの縮小版（生成・編集・幕演出は書き手専用なので持たない）。
 * 紙質背景＋明朝（DESIGN §4）。本文の下に「見たよ」ボタン。
 */
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { MitayoButton } from '@/components/mitayo-button';
import { SecondaryButton } from '@/components/secondary-button';
import { colors, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';
import { useLifeStory } from '@/lib/use-life-story';
import { useMyReactions } from '@/lib/use-my-reactions';
import { useSubject } from '@/lib/use-subject';

function formatJaDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function FamilyStoryScreen() {
  const params = useLocalSearchParams<{ subjectId: string }>();
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;

  const { memberships } = useAuth();
  const memberId = memberships.find((m) => m.subject_id === subjectId)?.id ?? null;

  const { subject, loading: subjectLoading, error: subjectError } = useSubject(subjectId ?? null);
  const { story, loading, error, refetch } = useLifeStory(subjectId);
  const { hasReacted, react, error: reactionError } = useMyReactions(memberId);

  const busy = subjectLoading || loading;
  const anyError = subjectError ?? error;
  const removed = !busy && !anyError && subject === null;

  return (
    <View style={styles.paper}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <BackButton />
          <AppText variant="screenTitle">
            {subject ? `${subject.nickname}さんの自分史` : '自分史'}
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

          {!busy && !anyError && subject && !story ? (
            <AppCard style={styles.card}>
              <AppText variant="cardTitle">自分史は まだ ありません</AppText>
              <AppText>できあがったら、ここで 読めます。</AppText>
            </AppCard>
          ) : null}

          {!busy && !anyError && subject && story ? (
            <>
              <AppText variant="caption" style={styles.dateCaption}>
                {formatJaDate(story.generated_at)}につくりました
              </AppText>
              <AppText variant="story">{story.body_text}</AppText>
              {reactionError ? (
                <AppText style={styles.errorTitle}>{reactionError}</AppText>
              ) : null}
              <MitayoButton
                reacted={hasReacted('life_story', story.id)}
                onPress={() => react('life_story', story.id)}
              />
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  content: {
    gap: spacing.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  dateCaption: {
    textAlign: 'right',
  },
  errorTitle: {
    color: colors.errorRed,
  },
  paper: {
    backgroundColor: colors.storyPaper,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});
