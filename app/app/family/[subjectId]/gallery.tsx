/**
 * 家族から見た机の上（チケット16。閲覧＋みたよのみ。REQUIREMENTS §3.5(a)）。
 * gallery.tsx の閲覧モード相当の縮小版：ならべかえ関連（モード切替・保存・override）は
 * 持たない。配置は書き手本人と同じ（対象 subject の board_seed＋保存済み board_*）なので、
 * 「本人がならべた机」がそのまま見える。タップ拡大＋声の再生はチケット15の PhotoLightbox を
 * そのまま使い、家族のときだけ「みたよ」ボタンを渡す。
 */
import { usePreventRemove } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { POLAROID_EXTRA_HEIGHT } from '@/components/board-polaroid';
import { DeskBoard, DeskGrain } from '@/components/desk-board';
import { DraggablePolaroid } from '@/components/draggable-polaroid';
import { PhotoLightbox } from '@/components/photo-lightbox';
import { SecondaryButton } from '@/components/secondary-button';
import { colors, spacing } from '@/constants/tokens';
import { BOARD, resolveBoardPlacements } from '@/lib/board-layout';
import { useAuth } from '@/lib/auth-context';
import { useBoardPhotos } from '@/lib/use-board-photos';
import { useMyReactions } from '@/lib/use-my-reactions';
import { useSubject } from '@/lib/use-subject';

const noop = () => {};

export default function FamilyGalleryScreen() {
  const { width: boardWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ subjectId: string }>();
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;

  const { memberships } = useAuth();
  const memberId = memberships.find((m) => m.subject_id === subjectId)?.id ?? null;

  const { subject, loading: subjectLoading, error: subjectError } = useSubject(subjectId ?? null);
  const { items, loading, error, refetch } = useBoardPhotos(subjectId);
  const { hasReacted, react, error: reactionError } = useMyReactions(memberId);

  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const { placements, boardHeightFraction } = useMemo(
    () =>
      resolveBoardPlacements(
        items.map(({ photo }) => photo),
        subject?.board_seed ?? 0,
      ),
    [items, subject?.board_seed],
  );

  const polaroidWidth = BOARD.POLAROID_W * boardWidth;
  const polaroidHeight = polaroidWidth + POLAROID_EXTRA_HEIGHT;
  const boardHeightPx = boardHeightFraction * boardWidth;

  const busy = subjectLoading || loading;
  const anyError = subjectError ?? error;
  const removed = !busy && !anyError && subject === null;

  const lightboxItem = lightboxId
    ? (items.find(({ photo }) => photo.id === lightboxId) ?? null)
    : null;

  // Android 戻る1回目はライトボックスだけ閉じる（gallery.tsx と同じ）
  usePreventRemove(lightboxItem !== null, () => {
    setLightboxId(null);
  });

  return (
    <DeskBoard>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.section }]}>
        <DeskGrain />
        <View style={[styles.header, { paddingTop: insets.top + spacing.xl }]}>
          <BackButton />
          <AppText variant="screenTitle" style={styles.title}>
            {subject ? `${subject.nickname}さんのギャラリー` : 'ギャラリー'}
          </AppText>

          {busy ? <ActivityIndicator color={colors.cardWhite} size="large" /> : null}

          {!busy && anyError ? (
            <AppCard style={styles.card}>
              <AppText variant="cardTitle" style={styles.errorTitle}>
                よみこめませんでした
              </AppText>
              <AppText>{anyError}</AppText>
              <SecondaryButton label="もういちどよみこむ" onPress={() => void refetch()} />
            </AppCard>
          ) : null}

          {removed ? (
            <AppCard style={styles.card}>
              <AppText variant="cardTitle">この博物館は 見られなくなりました</AppText>
            </AppCard>
          ) : null}

          {!busy && !anyError && subject && items.length === 0 ? (
            <AppCard style={styles.card}>
              <AppText variant="cardTitle">まだ 写真が ありません</AppText>
            </AppCard>
          ) : null}

          {reactionError ? (
            <AppCard style={styles.card}>
              <AppText style={styles.errorTitle}>{reactionError}</AppText>
            </AppCard>
          ) : null}
        </View>

        {!busy && !anyError && subject && items.length > 0 ? (
          <View style={{ height: boardHeightPx, width: '100%' }}>
            {items
              .map((item, index) => ({ item, index }))
              .sort(
                (a, b) =>
                  placements[a.index].z - placements[b.index].z || a.index - b.index,
              )
              .map(({ item, index }) => (
                <DraggablePolaroid
                  key={item.photo.id}
                  photoId={item.photo.id}
                  cacheKey={item.photo.r2_key}
                  caption={item.caption}
                  hasRecording={item.hasRecording}
                  uri={item.viewUrl}
                  baseLeft={placements[index].x * boardWidth - polaroidWidth / 2}
                  baseTop={placements[index].y * boardWidth - polaroidHeight / 2}
                  width={polaroidWidth}
                  height={polaroidHeight}
                  rotation={placements[index].rotation}
                  boardWidth={boardWidth}
                  boardHeight={boardHeightPx}
                  rearrange={false}
                  dragging={false}
                  revertSignal={0}
                  onLift={noop}
                  onDrop={noop}
                  onOpen={setLightboxId}
                />
              ))}
          </View>
        ) : null}
      </ScrollView>

      {/* ライトボックスは SafeArea の外＝全画面（gallery.tsx と同じ） */}
      {lightboxItem ? (
        <PhotoLightbox
          key={lightboxItem.photo.id}
          bodyText={lightboxItem.bodyText}
          cacheKey={lightboxItem.photo.r2_key}
          caption={lightboxItem.caption}
          hasRecording={lightboxItem.hasRecording}
          recordingUrl={lightboxItem.recordingUrl}
          uri={lightboxItem.viewUrl}
          onClose={() => setLightboxId(null)}
          onRetry={() => void refetch()}
          reaction={{
            reacted: hasReacted('photo', lightboxItem.photo.id),
            onReact: () => react('photo', lightboxItem.photo.id),
          }}
        />
      ) : null}
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
  header: {
    gap: spacing.xxl,
    padding: spacing.xl,
  },
  title: {
    color: colors.cardWhite,
  },
});
