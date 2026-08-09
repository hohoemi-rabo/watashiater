/**
 * お題一覧の骨格。実際のお題文言は DB（prompts テーブル）が唯一の情報源で、
 * 取得と演目札カード（半券ミシン目・済スタンプ）はチケット05で実装する。
 * ここではプレースホルダ10枚＋自由お題枠だけを置く。
 */
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { spacing } from '@/constants/tokens';

const PLACEHOLDER_PROMPT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export default function PromptsScreen() {
  const router = useRouter();

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">お題</AppText>

        {PLACEHOLDER_PROMPT_IDS.map((id) => (
          <Pressable key={id} onPress={() => router.push(`/answer/${id}`)}>
            <AppCard shadow="raised">
              <AppText variant="cardTitle">お題 {id}</AppText>
              <AppText variant="caption">（お題の文言はチケット05で DB から表示）</AppText>
            </AppCard>
          </Pressable>
        ))}

        <SecondaryButton
          icon={Plus}
          label="じぶんでお題をつくる"
          onPress={() => router.push('/answer/free')}
        />
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
});
