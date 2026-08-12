/**
 * オフラインのお知らせ（チケット19）。
 * 失敗でも達成でもない「状況の説明」なので errorRed も spotYellow も使わない
 * （DESIGN §3：spot-yellow はリアクション・お祝い・進捗、エラーは errorRed）。
 * 白カード＋補助色のアイコンで、静かに事実だけ伝える。
 */
import { WifiOff } from 'lucide-react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { colors, spacing } from '@/constants/tokens';
import { StyleSheet, View } from 'react-native';

type OfflineNoteProps = {
  /** 画面ごとの追記（例「ならべかえは つながってから できます。」） */
  detail?: string;
};

export function OfflineNote({ detail }: OfflineNoteProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.heading}>
        <WifiOff color={colors.textSoft} size={22} strokeWidth={2} />
        <AppText variant="cardTitle">インターネットに つながっていません</AppText>
      </View>
      <AppText>前に見たものは そのまま見られます。書きこみは つながってから できます。</AppText>
      {detail ? <AppText variant="caption">{detail}</AppText> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
