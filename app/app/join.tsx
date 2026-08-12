/**
 * かぞくとして登録する（チケット16。REQUIREMENTS §3.5(a)）。
 * 招待コード＋よびかた（表示名）を入れて redeem_invite_code RPC を呼ぶ。
 * - 表示名の初期値は Google アカウント名（user_metadata.full_name）。書き手に伝わる
 *   よびかた（例：たろう）へ自由に直せる（2026-08-12 ユーザー決定）
 * - 成功したらフォームを成功表示に置き換える（1画面1目的。REQUIREMENTS §4.1）
 * - コードの真の検証（期限・使用済み）はサーバー側。ここは結果 status を文言に写すだけ
 */
import { useRouter } from 'expo-router';
import { Check, DoorOpen } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { PrimaryButton } from '@/components/primary-button';
import { SkyBackground } from '@/components/sky-background';
import { TAP_TARGET_MIN, colors, fonts, fontSizes, radii, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';
import { redeemInviteCode, type RedeemResult } from '@/lib/family-join';
import { useIsOnline } from '@/lib/use-online';

const CODE_LENGTH = 6;

/** RPC の業務エラー status → 画面文言 */
const ERROR_MESSAGES: Record<string, string> = {
  not_found: 'この招待コードは 見つかりませんでした。コードを たしかめて、もういちど ためしてください。',
  already_used: 'この招待コードは すでに つかわれています。あたらしいコードを 発行してもらってください。',
  expired: 'この招待コードは 期限が すぎています。あたらしいコードを 発行してもらってください。',
  own_code: 'これは 自分の博物館の 招待コードです。',
  invalid_name: 'おなまえを 20文字までで 入れてください。',
  network_error:
    'とうろくできませんでした。インターネットに つながっているか たしかめて、もういちど ためしてください。',
};

export default function JoinScreen() {
  const { session, refreshSubject } = useAuth();
  const router = useRouter();

  const isOnline = useIsOnline();
  const metadataName = session?.user.user_metadata?.full_name;
  const [code, setCode] = useState('');
  const [name, setName] = useState(
    typeof metadataName === 'string' ? metadataName.slice(0, 20) : '',
  );
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joined, setJoined] = useState<{
    subjectId: string;
    nickname: string;
    already: boolean;
  } | null>(null);

  const trimmedCode = code.trim().toUpperCase();
  const trimmedName = name.trim();

  const handleJoin = async () => {
    setBusy(true);
    setErrorMessage(null);
    const result: RedeemResult = await redeemInviteCode(trimmedCode, trimmedName);
    setBusy(false);
    if (result.status === 'ok' || result.status === 'already_member') {
      // AuthGate と /family の判定が新しい登録を知っている状態にしてから成功表示へ
      await refreshSubject();
      setJoined({
        subjectId: result.subjectId,
        nickname: result.subjectNickname,
        already: result.status === 'already_member',
      });
      return;
    }
    setErrorMessage(ERROR_MESSAGES[result.status]);
  };

  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">かぞくとして登録する</AppText>

        {joined ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">
              {joined.already
                ? 'すでに かぞくとして 登録されています'
                : `${joined.nickname}さんの かぞくに なりました`}
            </AppText>
            <AppText>
              {joined.nickname}さんの 博物館（しゃしん・じぶん史）を いつでも 見られます。
            </AppText>
            <PrimaryButton
              icon={DoorOpen}
              label={`${joined.nickname}さんの博物館を見る`}
              onPress={() => router.replace(`/family/${joined.subjectId}`)}
            />
          </AppCard>
        ) : (
          <AppCard style={styles.card}>
            <AppText>おうちの方から きいた 6文字の招待コードを 入れてください。</AppText>
            <TextInput
              accessibilityLabel="招待コード"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={CODE_LENGTH}
              onChangeText={setCode}
              placeholder="れい：ABC234"
              placeholderTextColor={colors.textSoft}
              style={[styles.input, styles.codeInput]}
              value={code}
            />
            <AppText>あなたの よびかたを おしえてください。書き手の方に この名前で 伝わります。</AppText>
            <TextInput
              accessibilityLabel="あなたのおなまえ"
              maxLength={20}
              onChangeText={setName}
              placeholder="れい：たろう"
              placeholderTextColor={colors.textSoft}
              style={styles.input}
              value={name}
            />
            <PrimaryButton
              icon={Check}
              label={busy ? 'とうろくしています…' : 'とうろくする'}
              onPress={() => void handleJoin()}
              disabled={
                busy || trimmedCode.length !== CODE_LENGTH || trimmedName.length === 0 || !isOnline
              }
            />
            {errorMessage ? <AppText style={styles.error}>{errorMessage}</AppText> : null}
          </AppCard>
        )}
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  // 読み上げ・書き写しがしやすいよう、コードは大きく・字間を空けて表示する
  codeInput: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.screenTitle,
    letterSpacing: 6,
    textAlign: 'center',
  },
  content: {
    gap: spacing.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
  error: {
    color: colors.errorRed,
  },
  input: {
    borderColor: colors.textSoft,
    borderRadius: radii.button,
    borderWidth: 1,
    color: colors.stageNavy,
    fontFamily: fonts.body,
    fontSize: fontSizes.cardTitle,
    minHeight: TAP_TARGET_MIN,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
