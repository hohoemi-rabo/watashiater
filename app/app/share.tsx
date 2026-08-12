/**
 * みんなに見せる（チケット16：招待コード・かぞく一覧・みたよ一覧。REQUIREMENTS §7-7）。
 * 閲覧URLの発行・無効化はチケット17で実装する。
 * - 招待コードの発行がこの画面で最も重要なアクション＝唯一の curtainRed（DESIGN §3）
 * - コードは大きく・字間を空けて表示（電話で読み上げる・書き写す場面を想定）
 * - みたよ一覧はアプリ内のみ・最新30件（通知は出さない。REQUIREMENTS §3.5(a)）
 */
import { Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { PrimaryButton } from '@/components/primary-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, fonts, fontSizes, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';
import { createInviteCode } from '@/lib/invite';
import { useShareData } from '@/lib/use-share-data';

function formatJaDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function ShareScreen() {
  const { subject } = useAuth();
  const { invite, family, reactions, loading, error, refetch } = useShareData();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateCode = async () => {
    if (!subject) {
      return;
    }
    setCreating(true);
    setCreateError(null);
    const result = await createInviteCode(subject.id);
    setCreating(false);
    if (!result.ok) {
      setCreateError(result.message);
      return;
    }
    await refetch();
  };

  const handleShareCode = async () => {
    if (!invite) {
      return;
    }
    // 共有シート（LINE 等）へ。失敗してもコードは画面に見えているので何もしない
    try {
      await Share.share({
        message:
          `「ワタシアター」の招待コードです：${invite.code}\n` +
          'アプリの「かぞくとして登録する」で このコードを入れてください。',
      });
    } catch {
      // ユーザーが共有をやめた等。エラー表示は不要
    }
  };

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">みんなに見せる</AppText>

        {loading ? <ActivityIndicator color={colors.stageNavy} size="large" /> : null}

        {!loading && error ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle" style={styles.errorText}>
              よみこめませんでした
            </AppText>
            <AppText>{error}</AppText>
            <SecondaryButton label="もういちどよみこむ" onPress={() => void refetch()} />
          </AppCard>
        ) : null}

        {!loading && !error ? (
          <>
            <AppCard style={styles.card}>
              <AppText variant="cardTitle">かぞくを招待する</AppText>
              {invite ? (
                <>
                  <AppText>この招待コードを かぞくに おしらせください。</AppText>
                  <AppText style={styles.code}>{invite.code}</AppText>
                  <AppText variant="caption">
                    {formatJaDate(invite.expires_at)}まで つかえます・1回だけ つかえます
                  </AppText>
                  <SecondaryButton icon={Share2} label="LINEなどで おくる" onPress={() => void handleShareCode()} />
                </>
              ) : (
                <>
                  <AppText>
                    招待コードを かぞくに おしらせすると、かぞくは この博物館を 見て「みたよ」を
                    おくれるように なります。
                  </AppText>
                  <PrimaryButton
                    label={creating ? 'つくっています…' : '招待コードをつくる'}
                    onPress={() => void handleCreateCode()}
                    disabled={creating}
                  />
                </>
              )}
              {createError ? <AppText style={styles.errorText}>{createError}</AppText> : null}
            </AppCard>

            <AppCard style={styles.card}>
              <AppText variant="cardTitle">見せる用リンクをつくる</AppText>
              <AppText variant="caption">（閲覧URLはチケット17で実装）</AppText>
            </AppCard>

            <AppCard style={styles.card}>
              <AppText variant="cardTitle">かぞく</AppText>
              {family.length === 0 ? (
                <AppText>
                  まだ かぞくの登録が ありません。招待コードを つくって おしらせください。
                </AppText>
              ) : (
                family.map((member) => (
                  <View key={member.id} style={styles.row}>
                    <AppText variant="bodyMedium">{member.displayName}さん</AppText>
                    <AppText variant="caption">{formatJaDate(member.joinedAt)}に 登録</AppText>
                  </View>
                ))
              )}
            </AppCard>

            <AppCard style={styles.card}>
              <AppText variant="cardTitle">みたよ</AppText>
              {reactions.length === 0 ? (
                <AppText>まだ みたよ は ありません。</AppText>
              ) : (
                reactions.map((reaction) => (
                  <View key={reaction.id} style={styles.row}>
                    <AppText variant="bodyMedium">
                      {reaction.memberName}さんが みたよ しました
                    </AppText>
                    <AppText variant="caption">
                      {reaction.kind === 'photo'
                        ? `写真「${reaction.photoTitle}」・${formatJaDate(reaction.createdAt)}`
                        : `じぶん史・${formatJaDate(reaction.createdAt)}`}
                    </AppText>
                  </View>
                ))
              )}
            </AppCard>
          </>
        ) : null}
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  // 読み上げ・書き写し用に大きく（サイズはトークンの screenTitle を使う。発明しない）
  code: {
    color: colors.stageNavy,
    fontFamily: fonts.heading,
    fontSize: fontSizes.screenTitle,
    letterSpacing: 8,
    textAlign: 'center',
  },
  content: {
    gap: spacing.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  errorText: {
    color: colors.errorRed,
  },
  row: {
    gap: spacing.xs,
  },
});
