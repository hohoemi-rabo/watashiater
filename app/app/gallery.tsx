/**
 * ギャラリー（机の上）の骨格。desk-wood のボード・ポラロイド・ならべかえは
 * チケット13〜15で実装する。
 */
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { SkyBackground } from '@/components/sky-background';
import { colors, radii, shadows, spacing } from '@/constants/tokens';

export default function GalleryScreen() {
  return (
    <SkyBackground>
      <View style={styles.content}>
        <BackButton />
        <AppText variant="screenTitle">机の上</AppText>
        {/* 机の上ボードのプレビュー枠。木肌の質感・ポラロイドはチケット13 */}
        <View style={styles.board}>
          <AppText style={styles.boardText}>
            ここに写真がならびます（チケット13で実装）
          </AppText>
        </View>
      </View>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: spacing.xxl,
    padding: spacing.xl,
  },
  board: {
    alignItems: 'center',
    backgroundColor: colors.deskWood,
    borderRadius: radii.card,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    ...shadows.rest,
  },
  boardText: {
    color: colors.cardWhite,
    textAlign: 'center',
  },
});
