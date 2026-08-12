/**
 * ギャラリー（机の上）閲覧モード（チケット13。REQUIREMENTS §3.4① / DESIGN §5・§7）。
 * 全お題の写真をポラロイドとして木目ボードにばら撒き配置する。
 * - 配置は board-layout.ts の契約どおり（board_seed で決定的・保存配置優先）
 * - 重なり順は「z 昇順に並べ替えて描画順」で表現する。zIndex や elevation の差は使わない
 *   （Android は同 elevation の兄弟なら描画順が安定して効く。影も3段規約のまま）
 * - ならべかえはチケット14、タップ拡大＋音声はチケット15
 * - この画面のアクセントは木肌＋spot-yellow バッジのみ。curtainRed を持ち込まない（DESIGN §11-6）
 */
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { BoardPolaroid, POLAROID_EXTRA_HEIGHT } from '@/components/board-polaroid';
import { DeskBoard, DeskGrain } from '@/components/desk-board';
import { SecondaryButton } from '@/components/secondary-button';
import { BOARD, resolveBoardPlacements } from '@/lib/board-layout';
import { colors, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';
import { useBoardPhotos } from '@/lib/use-board-photos';

export default function GalleryScreen() {
  const { width: boardWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { subject } = useAuth();
  const { items, loading, error, refetch } = useBoardPhotos();

  const boardSeed = subject?.board_seed ?? 0;
  const { placements, boardHeightFraction } = useMemo(
    () =>
      resolveBoardPlacements(
        items.map(({ photo }) => photo),
        boardSeed,
      ),
    [items, boardSeed],
  );

  // 重なり順：z 昇順（同値は入力順＝作成順）に並べて、その順で描画する
  const stacked = useMemo(() => {
    return items
      .map((item, index) => ({ item, placement: placements[index], index }))
      .sort((a, b) => a.placement.z - b.placement.z || a.index - b.index);
  }, [items, placements]);

  const polaroidWidth = BOARD.POLAROID_W * boardWidth;
  const polaroidHeight = polaroidWidth + POLAROID_EXTRA_HEIGHT;

  return (
    <DeskBoard>
      {/* SafeAreaView で囲まず inset を内側余白にする：木目をステータスバーの下まで敷くため */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.section }]}>
        {/* 木目はコンテンツ側に敷いて写真と一緒にスクロールさせる（desk-board.tsx の判断） */}
        <DeskGrain />
        <View style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
            <BackButton />
            <AppText variant="screenTitle" style={styles.title}>
              机の上
            </AppText>

            {loading ? <ActivityIndicator color={colors.cardWhite} size="large" /> : null}

            {!loading && error ? (
              <AppCard style={styles.card}>
                <AppText variant="cardTitle" style={styles.errorTitle}>
                  よみこめませんでした
                </AppText>
                <AppText>{error}</AppText>
                <SecondaryButton label="もういちどよみこむ" onPress={() => void refetch()} />
              </AppCard>
            ) : null}

            {!loading && !error && items.length === 0 ? (
              <AppCard style={styles.card}>
                <AppText variant="cardTitle">まだ写真がありません</AppText>
                <AppText>お題にこたえて写真をのせると、この机にならびます。</AppText>
              </AppCard>
            ) : null}
          </View>

          {!loading && !error && items.length > 0 ? (
            <View style={{ height: boardHeightFraction * boardWidth, width: '100%' }}>
              {stacked.map(({ item, placement }) => (
                <BoardPolaroid
                  key={item.photo.id}
                  cacheKey={item.photo.r2_key}
                  caption={item.caption}
                  hasRecording={item.hasRecording}
                  left={placement.x * boardWidth - polaroidWidth / 2}
                  rotation={placement.rotation}
                  top={placement.y * boardWidth - polaroidHeight / 2}
                  uri={item.viewUrl}
                  width={polaroidWidth}
                />
              ))}
            </View>
          ) : null}
      </ScrollView>
    </DeskBoard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.section,
  },
  errorTitle: {
    color: colors.errorRed,
  },
  // ボード（写真エリア）は全幅を使うため、余白はヘッダー側にだけ付ける
  // （paddingTop はステータスバー inset を足して gallery 本体で上書きする）
  header: {
    gap: spacing.xxl,
    padding: spacing.xl,
  },
  title: {
    color: colors.cardWhite,
  },
});
