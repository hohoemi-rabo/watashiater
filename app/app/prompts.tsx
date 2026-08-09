/**
 * お題一覧（REQUIREMENTS §7-3）。演目札カードの縦積み。
 * お題の文言・順序は DB（prompts テーブル）が唯一の情報源。
 * 自由お題枠は最後に「＋じぶんでお題をつくる」（作成済みならそのタイトル）。
 */
import { useRouter } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { PromptCard } from '@/components/prompt-card';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, spacing } from '@/constants/tokens';
import { usePrompts } from '@/lib/use-prompts';

export default function PromptsScreen() {
  const router = useRouter();
  const { items, freeAnswer, loading, error, refetch } = usePrompts();

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">お題</AppText>

        {loading ? <ActivityIndicator color={colors.curtainRed} size="large" /> : null}

        {error ? (
          <AppCard style={styles.errorCard}>
            <AppText variant="cardTitle">よみこめませんでした</AppText>
            <AppText>{error}</AppText>
            <SecondaryButton icon={RefreshCw} label="もういちど よみこむ" onPress={() => void refetch()} />
          </AppCard>
        ) : null}

        {items.map(({ prompt, answer }) => (
          <PromptCard
            key={prompt.id}
            title={prompt.title}
            answered={answer !== null}
            preview={answer?.body_text.trim() || undefined}
            onPress={() => router.push(`/answer/${prompt.id}`)}
          />
        ))}

        {!loading && !error ? (
          <PromptCard
            title={freeAnswer?.custom_title ?? '＋じぶんでお題をつくる'}
            answered={freeAnswer !== null}
            preview={freeAnswer?.body_text.trim() || undefined}
            onPress={() => router.push('/answer/free')}
          />
        ) : null}
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  errorCard: {
    gap: spacing.lg,
  },
});
