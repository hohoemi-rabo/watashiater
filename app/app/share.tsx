/**
 * みんなに見せる の骨格。招待コード発行・閲覧URL発行/無効化・家族一覧・みたよ一覧は
 * チケット16〜17で実装する。
 */
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SkyBackground } from '@/components/sky-background';
import { spacing } from '@/constants/tokens';

export default function ShareScreen() {
  return (
    <SkyBackground>
      <View style={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">みんなに見せる</AppText>
        <AppCard style={styles.card}>
          <AppText variant="cardTitle">かぞくを招待する</AppText>
          <AppText variant="caption">（招待コードはチケット16で実装）</AppText>
        </AppCard>
        <AppCard style={styles.card}>
          <AppText variant="cardTitle">見せる用リンクをつくる</AppText>
          <AppText variant="caption">（閲覧URLはチケット17で実装）</AppText>
        </AppCard>
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
});
