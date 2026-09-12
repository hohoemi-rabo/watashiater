/**
 * 家族の博物館ハブ（チケット16・18）。自分が家族として登録されている博物館の一覧と、
 * 招待コード入力への導線。家族専用アカウント（自分の博物館なし）のホームでもあるため、
 * ログアウトとアカウント削除もここに置く（settings は subject 前提で到達できない。
 * アカウント削除はどの種類のアカウントにも必要＝REQUIREMENTS §4.3・Google Play 要件）。
 */
import { useRouter } from 'expo-router';
import { DoorOpen, KeyRound, LogOut, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { SecondaryButton } from '@/components/secondary-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, spacing } from '@/constants/tokens';
import { deleteAccount } from '@/lib/account';
import { showAlert } from '@/lib/app-alert';
import { useAuth } from '@/lib/auth-context';
import { useFamilyMuseums } from '@/lib/use-family-museums';

export default function FamilyHubScreen() {
  const router = useRouter();
  const { subject, signOut } = useAuth();
  const { museums, loading, error, refetch } = useFamilyMuseums();
  const [deleting, setDeleting] = useState(false);

  const runDelete = async () => {
    setDeleting(true);
    // 家族専用アカウントは R2 を持ち得ないので wipe をスキップ（lib/account.ts）
    const result = await deleteAccount(false);
    setDeleting(false);
    if (!result.ok) {
      showAlert('削除できませんでした', result.message, [{ text: 'わかりました' }]);
      return;
    }
    void signOut();
    router.replace('/onboarding');
  };

  const confirmDelete = () => {
    showAlert(
      'アカウントを削除しますか？',
      'もとに戻すことはできません。',
      [
        { text: 'やめる', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            // 最重度の破壊的操作なので確認を2段にする（settings と同じ）
            showAlert(
              '本当に削除してよろしいですか？',
              '登録した家族の博物館は見られなくなります。',
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
    showAlert('ログアウトしますか？', 'また Google でログインすれば、続きから使えます。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: 'ログアウトする',
        style: 'destructive',
        onPress: () => {
          void signOut();
          router.replace('/onboarding');
        },
      },
    ]);
  };

  return (
    <SkyBackground>
      {/* 自分の博物館を持つ人は settings から来る＝戻れる。家族専用はここがホーム */}
      {subject ? (
        <View style={styles.header}>
          <ScreenHeader />
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="screenTitle">家族の博物館</AppText>

        {loading ? <ActivityIndicator color={colors.stageNavy} size="large" /> : null}

        {!loading && error ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle" style={styles.errorTitle}>
              読み込めませんでした
            </AppText>
            <AppText>{error}</AppText>
            <SecondaryButton label="もう一度読み込む" onPress={() => void refetch()} />
          </AppCard>
        ) : null}

        {!loading && !error && museums.length === 0 ? (
          <AppCard style={styles.card}>
            <AppText variant="cardTitle">まだ登録した博物館がありません</AppText>
            <AppText>招待コードをもらったら、下のボタンから登録してください。</AppText>
          </AppCard>
        ) : null}

        {/* 博物館は複数ありうるので curtainRed（1画面1アクション）は使わない（DESIGN §3） */}
        {!loading && !error
          ? museums.map((museum) => (
              <AppCard key={museum.membershipId} shadow="raised" style={styles.card}>
                <AppText variant="cardTitle">{museum.nickname}さんの博物館</AppText>
                <SecondaryButton
                  icon={DoorOpen}
                  label="博物館に入る"
                  onPress={() => router.push(`/family/${museum.subjectId}`)}
                />
              </AppCard>
            ))
          : null}

        <SecondaryButton
          icon={KeyRound}
          label="招待コードで登録する"
          onPress={() => router.push('/join')}
        />
        {subject ? null : (
          <>
            <SecondaryButton icon={LogOut} label="ログアウト" onPress={confirmSignOut} />
            <SecondaryButton
              destructive
              icon={Trash2}
              label={deleting ? '削除しています…' : 'アカウントを削除する'}
              onPress={confirmDelete}
              disabled={deleting}
            />
          </>
        )}
      </ScrollView>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  card: {
    gap: spacing.lg,
  },
  content: {
    gap: spacing.xxl,
    padding: spacing.xl,
    // 上余白はヘッダー側が持つので、ここは「戻る」と見出しの間
    paddingTop: spacing.xxl,
    paddingBottom: spacing.section,
  },
  errorTitle: {
    color: colors.errorRed,
  },
});
