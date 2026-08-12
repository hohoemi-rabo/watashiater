/**
 * ニックネーム登録（初回ログイン直後）。subjects へ自分の博物館レコードを作る。
 * この INSERT が RLS（本人のみ作成可）の実地テストを兼ねる（チケット04）。
 */
import { useRouter } from 'expo-router';
import { Check, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { PrimaryButton } from '@/components/primary-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { TAP_TARGET_MIN, colors, fonts, fontSizes, radii, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/lib/use-online';

export default function NicknameScreen() {
  const { session, refreshSubject } = useAuth();
  const router = useRouter();
  const isOnline = useIsOnline();
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmed = nickname.trim();

  const handleSave = async () => {
    if (!session || !trimmed) {
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    const { error } = await supabase.from('subjects').insert({
      owner_user_id: session.user.id,
      nickname: trimmed,
    });
    if (error) {
      // 23505 = unique 制約違反。すでに博物館がある（登録済みユーザーが何かの拍子に
      // この画面へ来た）ケースなので、エラーではなく既存データを読み直してホームへ
      if (error.code === '23505') {
        await refreshSubject();
        setBusy(false);
        router.replace('/');
        return;
      }
      setBusy(false);
      setErrorMessage(
        'ほぞんできませんでした。インターネットに つながっているか たしかめて、もういちど ためしてください。',
      );
      return;
    }
    await refreshSubject();
    setBusy(false);
    router.replace('/');
  };

  return (
    <SkyBackground>
      <View style={styles.content}>
        <AppText variant="screenTitle">なんと よびましょうか？</AppText>
        <AppCard style={styles.card}>
          <AppText>ニックネームを おしえてください。あとから かえられます。</AppText>
          <TextInput
            accessibilityLabel="ニックネーム"
            value={nickname}
            onChangeText={setNickname}
            placeholder="れい：はなこ"
            placeholderTextColor={colors.textSoft}
            maxLength={20}
            style={styles.input}
          />
          <PrimaryButton
            icon={Check}
            label={busy ? 'ほぞんしています…' : 'これで けってい'}
            onPress={() => void handleSave()}
            disabled={busy || trimmed.length === 0 || !isOnline}
          />
          {errorMessage ? (
            <AppText style={styles.error}>{errorMessage}</AppText>
          ) : null}
        </AppCard>

        {/* 家族専用アカウント（自分の博物館を作らない人）の入口（チケット16） */}
        <SecondaryButton
          icon={Users}
          label="かぞくに招待された方はこちら"
          onPress={() => router.push('/join')}
        />
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
    gap: spacing.lg,
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
  error: {
    color: colors.errorRed,
  },
});
