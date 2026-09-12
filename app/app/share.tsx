/**
 * みんなに見せる（チケット16：招待コード・家族一覧・見たよ一覧／チケット17：閲覧専用URL。
 * REQUIREMENTS §7-7）。
 * - 招待コードの発行がこの画面で最も重要なアクション＝唯一の curtainRed（DESIGN §3）。
 *   リンク系のボタンはすべて Secondary
 * - 送る導線は2本立て（チケット32）：主役級の「LINEで送る」（lineGreen・LINE を直接開く）と、
 *   その下の「ほかの方法で送る」（今までの共有シート）。生徒さんの送り先は事実上 LINE だが、
 *   LINE を使わない家族のために共有シートも残す。アクセントは curtainRed＋lineGreen の2色（§11-6）
 * - 送る本文は LINE と共有シートで同じものを使う（下の *Message を唯一の組み立て場所にする）

 * - コードは大きく・字間を空けて表示（電話で読み上げる・書き写す場面を想定）
 * - 見たよ一覧はアプリ内のみ・最新30件（通知は出さない。REQUIREMENTS §3.5(a)）
 * - リンクの再発行は「止める → 作り直す」の2段階（無効化は確認ダイアログ必須。§3.5(b)）
 */
import { Link2, Share2, StopCircle } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { LineButton } from '@/components/line-button';
import { PrimaryButton } from '@/components/primary-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, fonts, fontSizes, spacing } from '@/constants/tokens';
import { showAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';
import { createInviteCode } from '@/lib/invite';
import { shareViaLine } from '@/lib/line-share';
import { useIsOnline } from '@/lib/use-online';
import { useShareData } from '@/lib/use-share-data';
import { buildViewUrl, createViewLink, deactivateViewLink } from '@/lib/view-link';

function formatJaDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function ShareScreen() {
  const { subject } = useAuth();
  const { invite, viewLink, family, reactions, loading, error, refetch } = useShareData();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const isOnline = useIsOnline();
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

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

  // 送る本文は LINE でも共有シートでも同じ。文面をハンドラに直書きせず、ここだけで組み立てる
  const inviteMessage = invite
    ? `「ワタシアター」の招待コードです：${invite.code}\n` +
      'アプリの「家族として登録する」でこのコードを入れてください。'
    : '';

  const handleShareCode = async () => {
    if (!invite) {
      return;
    }
    // 共有シートへ。失敗してもコードは画面に見えているので何もしない
    try {
      await Share.share({ message: inviteMessage });
    } catch {
      // ユーザーが共有をやめた等。エラー表示は不要
    }
  };

  const handleCreateLink = async () => {
    if (!subject) {
      return;
    }
    setLinkBusy(true);
    setLinkError(null);
    const result = await createViewLink(subject.id);
    setLinkBusy(false);
    if (!result.ok) {
      setLinkError(result.message);
      return;
    }
    await refetch();
  };

  const linkMessage = viewLink
    ? `${subject?.nickname ?? '私'}の博物館「ワタシアター」です。ぜひ見てください。\n` +
      buildViewUrl(viewLink.slug)
    : '';

  const handleShareLink = async () => {
    if (!viewLink) {
      return;
    }
    try {
      await Share.share({ message: linkMessage });
    } catch {
      // ユーザーが共有をやめた等。エラー表示は不要
    }
  };

  const handleStopLink = () => {
    if (!viewLink) {
      return;
    }
    showAlert('リンクを止めますか？', 'このリンクでは見られなくなります。もう一度作ると、新しいリンクになります。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: '止める',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setLinkBusy(true);
            setLinkError(null);
            const result = await deactivateViewLink(viewLink.id);
            setLinkBusy(false);
            if (!result.ok) {
              setLinkError(result.message ?? null);
              return;
            }
            await refetch();
          })();
        },
      },
    ]);
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
              読み込めませんでした
            </AppText>
            <AppText>{error}</AppText>
            <SecondaryButton label="もう一度読み込む" onPress={() => void refetch()} />
          </AppCard>
        ) : null}

        {!loading && !error ? (
          <>
            <AppCard style={styles.card}>
              <AppText variant="cardTitle">家族を招待する</AppText>
              {invite ? (
                <>
                  <AppText>この招待コードを家族にお知らせください。</AppText>
                  <AppText style={styles.code}>{invite.code}</AppText>
                  <AppText variant="caption">
                    {formatJaDate(invite.expires_at)}まで使えます・1回だけ使えます
                  </AppText>
                  <LineButton label="LINEで送る" onPress={() => void shareViaLine(inviteMessage)} />
                  <SecondaryButton
                    icon={Share2}
                    label="ほかの方法で送る"
                    onPress={() => void handleShareCode()}
                  />
                </>
              ) : (
                <>
                  <AppText>
                    招待コードを家族にお知らせすると、家族はこの博物館を見て「見たよ」を
                    送れるようになります。
                  </AppText>
                  <PrimaryButton
                    label={creating ? '作っています…' : '招待コードを作る'}
                    onPress={() => void handleCreateCode()}
                    disabled={creating || !isOnline}
                  />
                </>
              )}
              {createError ? <AppText style={styles.errorText}>{createError}</AppText> : null}
            </AppCard>

            <AppCard style={styles.card}>
              <AppText variant="cardTitle">見せる用リンクを作る</AppText>
              {viewLink ? (
                <>
                  <AppText>このリンクを送ると、登録なしでブラウザから見られます。</AppText>
                  <AppText selectable style={styles.linkUrl}>
                    {buildViewUrl(viewLink.slug)}
                  </AppText>
                  <AppText variant="caption">
                    このリンクを知っている人はだれでも見られます。
                  </AppText>
                  <LineButton label="LINEで送る" onPress={() => void shareViaLine(linkMessage)} />
                  <SecondaryButton
                    icon={Share2}
                    label="ほかの方法で送る"
                    onPress={() => void handleShareLink()}
                  />
                  <SecondaryButton
                    icon={StopCircle}
                    label={linkBusy ? '止めています…' : 'リンクを止める'}
                    onPress={handleStopLink}
                    disabled={linkBusy || !isOnline}
                  />
                </>
              ) : (
                <>
                  <AppText>
                    リンクを送ると、登録なしでブラウザから見てもらえます（LINEで
                    お孫さんに送る、など）。
                  </AppText>
                  <AppText variant="caption">
                    このリンクを知っている人はだれでも見られます。
                  </AppText>
                  <SecondaryButton
                    icon={Link2}
                    label={linkBusy ? '作っています…' : '見せる用リンクを作る'}
                    onPress={() => void handleCreateLink()}
                    disabled={linkBusy || !isOnline}
                  />
                </>
              )}
              {linkError ? <AppText style={styles.errorText}>{linkError}</AppText> : null}
            </AppCard>

            <AppCard style={styles.card}>
              <AppText variant="cardTitle">家族</AppText>
              {family.length === 0 ? (
                <AppText>
                  まだ家族の登録がありません。招待コードを作ってお知らせください。
                </AppText>
              ) : (
                family.map((member) => (
                  <View key={member.id} style={styles.row}>
                    <AppText variant="bodyMedium">{member.displayName}さん</AppText>
                    <AppText variant="caption">{formatJaDate(member.joinedAt)}に登録</AppText>
                  </View>
                ))
              )}
            </AppCard>

            <AppCard style={styles.card}>
              <AppText variant="cardTitle">見たよ</AppText>
              {reactions.length === 0 ? (
                <AppText>まだ見たよはありません。</AppText>
              ) : (
                reactions.map((reaction) => (
                  <View key={reaction.id} style={styles.row}>
                    <AppText variant="bodyMedium">
                      {reaction.memberName}さんが見たよしました
                    </AppText>
                    <AppText variant="caption">
                      {reaction.kind === 'photo'
                        ? `写真「${reaction.photoTitle}」・${formatJaDate(reaction.createdAt)}`
                        : `自分史・${formatJaDate(reaction.createdAt)}`}
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
  // URL は等幅でなくてよいが、1文字も欠けず選択・書き写しできるよう全文表示する
  linkUrl: {
    color: colors.stageNavy,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.body,
  },
  row: {
    gap: spacing.xs,
  },
});
