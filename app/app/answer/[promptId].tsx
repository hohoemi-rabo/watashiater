/**
 * 回答画面の骨格。promptId は '1'〜'10'（固定お題）または 'free'（自由お題）。
 * お題タイトルは DB から表示（チケット05）。
 * テキスト入力はチケット06、写真添付は09、録音は10で実装する。
 */
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SkyBackground } from '@/components/sky-background';
import { spacing } from '@/constants/tokens';
import { usePrompts } from '@/lib/use-prompts';

export default function AnswerScreen() {
  const { promptId } = useLocalSearchParams<{ promptId: string }>();
  const { items, freeAnswer, loading } = usePrompts();

  const isFree = promptId === 'free';
  const fixedTitle = items.find(({ prompt }) => String(prompt.id) === promptId)?.prompt.title;
  const title = isFree ? (freeAnswer?.custom_title ?? 'じぶんのお題') : fixedTitle;

  return (
    <SkyBackground>
      <View style={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">{loading ? '…' : (title ?? 'お題')}</AppText>
        <AppCard style={styles.card}>
          <AppText>
            ここに回答を書く画面が入ります。（テキスト入力はチケット06、写真は09、録音は10）
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
