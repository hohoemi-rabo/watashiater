/**
 * じぶん史の骨格。この画面だけ背景を生成りの紙質（story-paper）にし、
 * 本文を Shippori Mincho にする（DESIGN.md §4「一冊の本」の空気）。
 * 生成・編集・再生成はチケット12で実装する。
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { colors, spacing } from '@/constants/tokens';

export default function StoryScreen() {
  return (
    // じぶん史は全画面共通の空グラデではなく紙色ベタ（DESIGN.md §4 の例外指定）
    <View style={styles.paper}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <BackButton />
          <AppText variant="screenTitle">じぶん史</AppText>
          <AppText variant="story">
            ここに、こたえたお題からつくった読み物が入ります。この文章は書体の確認用です。
            わたしの物語は、生まれた町の小さな路地からはじまります。（生成はチケット12）
          </AppText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: colors.storyPaper,
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    gap: spacing.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.section,
  },
});
