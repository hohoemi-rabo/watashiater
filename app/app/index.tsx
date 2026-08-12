/**
 * ホーム（ハブ）。DESIGN.md §7：上部ロゴ／中央に進捗（演目札ドット）と「つづきをかく」／
 * 「じぶん史をつくる」（回答1問以上で有効。REQUIREMENTS §3.3）／
 * 下部にギャラリーへの入り口（木目のミニプレビュー）。
 */
import { useRouter } from 'expo-router';
import { BookOpen, Images, ScrollText, Settings, Share2, Users } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { PrimaryButton } from '@/components/primary-button';
import { ProgressDots } from '@/components/progress-dots';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, radii, shadows, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';
import { usePrompts } from '@/lib/use-prompts';

const PROMPT_TOTAL = 10;

export default function HomeScreen() {
  const router = useRouter();
  const { subject, memberships } = useAuth();
  const { answeredCount, loading, error } = usePrompts();

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
          {error ? (
            <AppText variant="caption">{error}</AppText>
          ) : (
            <>
              <AppText>
                {loading
                  ? 'よみこんでいます…'
                  : `${PROMPT_TOTAL}このうち ${answeredCount}つ こたえました`}
              </AppText>
              <ProgressDots total={PROMPT_TOTAL} filled={loading ? 0 : answeredCount} />
            </>
          )}
          <PrimaryButton icon={BookOpen} label="つづきをかく" onPress={() => router.push('/prompts')} />
        </AppCard>

        <SecondaryButton
          icon={ScrollText}
          label="じぶん史をつくる"
          onPress={() => router.push('/story')}
          disabled={loading || answeredCount === 0}
        />

        {/* ギャラリーへの入り口（木目のミニプレビュー。DESIGN §7） */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/gallery')}
          style={({ pressed }) => [styles.deskPreview, pressed && styles.deskPreviewPressed]}>
          <Images color={colors.cardWhite} size={28} strokeWidth={2} />
          <View style={styles.deskTextGroup}>
            <AppText variant="cardTitle" style={styles.deskTitle}>
              机の上（ギャラリー）
            </AppText>
            <AppText variant="caption" style={styles.deskCaption}>
              しゃしんが ここに ならびます
            </AppText>
          </View>
        </Pressable>

        <View style={styles.menu}>
          <SecondaryButton icon={Share2} label="みんなに見せる" onPress={() => router.push('/share')} />
          {/* 自分も誰かの家族として登録しているときだけ出す（チケット16。純粋な書き手の
              ホームを混み合わせない。未登録者の入口は settings の「かぞくの博物館」） */}
          {memberships.length > 0 ? (
            <SecondaryButton
              icon={Users}
              label="かぞくの博物館"
              onPress={() => router.push('/family')}
            />
          ) : null}
          <SecondaryButton icon={Settings} label="せってい" onPress={() => router.push('/settings')} />
        </View>
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
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
  deskPreview: {
    alignItems: 'center',
    backgroundColor: colors.deskWood,
    borderRadius: radii.card,
    flexDirection: 'row',
    gap: spacing.lg,
    minHeight: 96,
    paddingHorizontal: spacing.xl,
    ...shadows.raised,
  },
  deskPreviewPressed: {
    transform: [{ scale: 0.98 }],
    ...shadows.rest,
  },
  deskTextGroup: {
    gap: spacing.xs,
  },
  deskTitle: {
    color: colors.cardWhite,
  },
  deskCaption: {
    color: colors.cardWhite,
  },
  menu: {
    gap: spacing.lg,
  },
});
