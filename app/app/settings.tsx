/**
 * せってい（チケット04・18）。ニックネーム変更・つかいかた・かぞくの博物館・
 * ログアウト・アカウント削除。
 * - アカウント削除は二重確認（REQUIREMENTS §4.1 破壊的操作＋最重度なので2段）。
 *   削除の順序と失敗時の再開は lib/account.ts の判断コメント参照
 * - 削除ボタンは destructive（errorRed）。curtainRed は使わない（DESIGN §3）
 */
import { useRouter } from 'expo-router';
import { Check, CircleHelp, LogOut, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { TAP_TARGET_MIN, colors, fonts, fontSizes, radii, spacing } from '@/constants/tokens';
import { deleteAccount, updateNickname } from '@/lib/account';
import { useAuth } from '@/lib/auth-context';
import { useIsOnline } from '@/lib/use-online';

export default function SettingsScreen() {
  const router = useRouter();
  const { subject, signOut, refreshSubject } = useAuth();
  const isOnline = useIsOnline();

  const [nickname, setNickname] = useState(subject?.nickname ?? '');
  const [nicknameBusy, setNicknameBusy] = useState(false);
  const [nicknameSaved, setNicknameSaved] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const trimmed = nickname.trim();
  const unchanged = trimmed === (subject?.nickname ?? '');

  const handleSaveNickname = async () => {
    if (!subject || !trimmed) {
      return;
    }
    setNicknameBusy(true);
    setNicknameError(null);
    const result = await updateNickname(subject.id, trimmed);
    if (!result.ok) {
      setNicknameBusy(false);
      setNicknameError(result.message);
      return;
    }
    await refreshSubject();
    setNicknameBusy(false);
    setNicknameSaved(true);
  };

  const runDelete = async () => {
    setDeleting(true);
    const result = await deleteAccount(subject !== null);
    setDeleting(false);
    if (!result.ok) {
      Alert.alert('削除できませんでした', result.message, [{ text: 'わかりました' }]);
      return;
    }
    void signOut();
    router.replace('/onboarding');
  };

  const confirmDelete = () => {
    Alert.alert(
      'アカウントを削除しますか？',
      '写真・声・じぶん史など、すべてのデータが消えます。もとにもどすことは できません。',
      [
        { text: 'やめる', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            // 最重度の破壊的操作なので確認を2段にする
            Alert.alert(
              '本当に削除してよろしいですか？',
              '削除すると、家族も この博物館を 見られなくなります。',
              [
                { text: 'やめる', style: 'cancel' },
                { text: 'すべて削除する', style: 'destructive', onPress: () => void runDelete() },
              ],
            );
          },
        },
      ],
    );
  };

  const confirmSignOut = () => {
    Alert.alert('ログアウトしますか？', 'また Google でログインすれば、つづきから つかえます。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: 'ログアウトする',
        style: 'destructive',
        onPress: () => {
          void signOut();
          // ガードが onboarding へ送るが、明示的にも遷移しておく
          router.replace('/onboarding');
        },
      },
    ]);
  };

  return (
    <SkyBackground>
      <View style={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">せってい</AppText>
        <AppCard style={styles.card}>
          <AppText variant="cardTitle">ニックネーム</AppText>
          <TextInput
            accessibilityLabel="ニックネーム"
            value={nickname}
            onChangeText={(text) => {
              setNickname(text);
              setNicknameSaved(false);
            }}
            placeholder="れい：はなこ"
            placeholderTextColor={colors.textSoft}
            maxLength={20}
            style={styles.input}
          />
          <SecondaryButton
            icon={Check}
            label={nicknameBusy ? 'ほぞんしています…' : '保存する'}
            onPress={() => void handleSaveNickname()}
            disabled={nicknameBusy || trimmed.length === 0 || unchanged || !isOnline}
          />
          {nicknameSaved ? <AppText variant="caption">ほぞんしました</AppText> : null}
          {!isOnline ? (
            <AppText variant="caption">なまえの変更は つながってから できます。</AppText>
          ) : null}
          {nicknameError ? <AppText style={styles.error}>{nicknameError}</AppText> : null}
        </AppCard>
        <SecondaryButton
          icon={CircleHelp}
          label="つかいかたを見る"
          onPress={() => router.push('/onboarding')}
        />
        {/* 自分の博物館を持つ人が家族側（招待コード入力・閲覧）へ入る導線（チケット16） */}
        <SecondaryButton
          icon={Users}
          label="かぞくの博物館"
          onPress={() => router.push('/family')}
        />
        {/* オフラインでログアウトすると再ログインできず、キャッシュした博物館への
            入口を自分で閉じてしまう（チケット19） */}
        <SecondaryButton
          icon={LogOut}
          label="ログアウト"
          onPress={confirmSignOut}
          disabled={!isOnline}
        />
        <SecondaryButton
          destructive
          icon={Trash2}
          label={deleting ? '削除しています…' : 'アカウントを削除する'}
          onPress={confirmDelete}
          disabled={deleting || !isOnline}
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
    gap: spacing.md,
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
