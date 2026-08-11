/**
 * 回答画面の写真エリア（チケット09）。表示・追加・削除・アップロード進捗をまとめる。
 * - ポラロイド仕様は DESIGN §5：白フチ 左右上8px・下28px・shadow-rest・±3°以内の傾き。
 *   傾きは index 決定的（再レンダーで揺れない）
 * - 削除系は errorRed（curtain-red はこの画面では保存ボタン専用。DESIGN §3）
 * - 画像は r2_key を cacheKey にしてディスクキャッシュ（署名URLのクエリは毎回変わるため）
 */
import { Image } from 'expo-image';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { SecondaryButton } from '@/components/secondary-button';
import { colors, shadows, spacing } from '@/constants/tokens';
import { PHOTO_MAX_PER_ANSWER } from '@/lib/photo-attach';
import type { Photo } from '@/lib/use-photos';

/** ±3°以内・index 決定的な傾き */
const TILTS = ['-2deg', '1.5deg', '-1deg', '2deg', '-1.5deg'];

type PhotoStripProps = {
  photos: Photo[];
  viewUrls: Record<string, string>;
  loading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  uploadState: { done: number; total: number } | null;
  uploadError: string | null;
  onRetryUpload: () => void;
  onAdd: () => void;
  onDelete: (photo: Photo) => void;
};

export function PhotoStrip({
  photos,
  viewUrls,
  loading,
  loadError,
  onRetryLoad,
  uploadState,
  uploadError,
  onRetryUpload,
  onAdd,
  onDelete,
}: PhotoStripProps) {
  const uploading = uploadState !== null;

  return (
    <View style={styles.container}>
      {photos.map((photo, index) => (
        <View key={photo.id} style={styles.item}>
          <View
            style={[styles.polaroid, { transform: [{ rotate: TILTS[index % TILTS.length] }] }]}>
            <Image
              accessibilityLabel="のせた写真"
              source={{ uri: viewUrls[photo.r2_key], cacheKey: photo.r2_key }}
              cachePolicy="memory-disk"
              contentFit="cover"
              transition={150}
              style={styles.photo}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="この写真をけす"
            disabled={uploading}
            hitSlop={8}
            onPress={() => onDelete(photo)}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.deletePressed]}>
            <Trash2 color={colors.errorRed} size={16} strokeWidth={2} />
            <AppText variant="caption" style={styles.deleteLabel}>
              けす
            </AppText>
          </Pressable>
        </View>
      ))}

      {loading ? <ActivityIndicator color={colors.stageNavy} /> : null}

      {loadError ? (
        <View style={styles.centerBlock}>
          <AppText variant="caption" style={styles.errorText}>
            {loadError}
          </AppText>
          <SecondaryButton label="もういちど よみこむ" onPress={onRetryLoad} />
        </View>
      ) : null}

      {!loading && !loadError && photos.length === 0 && !uploading ? (
        // 写真ゼロのときだけポラロイド型の空枠（「ここに写真がのる」が形で分かる。DESIGN §7）
        <View style={styles.polaroid}>
          <View style={styles.emptyInner}>
            <AppText variant="caption" style={styles.emptyText}>
              おもいでの写真を のせられます
            </AppText>
          </View>
        </View>
      ) : null}

      {uploading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator color={colors.stageNavy} />
          <AppText variant="caption">
            写真をのせています…（{uploadState.done}/{uploadState.total}）
          </AppText>
        </View>
      ) : null}

      {uploadError && !uploading ? (
        <View style={styles.centerBlock}>
          <AppText variant="caption" style={styles.errorText}>
            {uploadError}
          </AppText>
          <SecondaryButton icon={ImagePlus} label="もういちど のせる" onPress={onRetryUpload} />
        </View>
      ) : null}

      {!uploading && !uploadError && !loadError && photos.length < PHOTO_MAX_PER_ANSWER ? (
        <SecondaryButton icon={ImagePlus} label="写真をのせる" onPress={onAdd} disabled={loading} />
      ) : null}
      {photos.length >= PHOTO_MAX_PER_ANSWER ? (
        <AppText variant="caption" style={styles.limitText}>
          写真は 5まいまで のせられます
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
  item: {
    gap: spacing.sm,
  },
  // ポラロイドの白フチ：左右上8・下28（DESIGN §5）
  polaroid: {
    alignSelf: 'center',
    backgroundColor: colors.cardWhite,
    paddingBottom: 28,
    paddingHorizontal: 8,
    paddingTop: 8,
    transform: [{ rotate: '-2deg' }],
    width: '70%',
    ...shadows.rest,
  },
  photo: {
    aspectRatio: 1,
    backgroundColor: colors.skyBottom,
    width: '100%',
  },
  emptyInner: {
    alignItems: 'center',
    aspectRatio: 1,
    borderColor: colors.textSoft,
    borderRadius: 2,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
  },
  deleteButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: spacing.section,
    paddingHorizontal: spacing.lg,
  },
  deletePressed: {
    opacity: 0.6,
  },
  deleteLabel: {
    color: colors.errorRed,
  },
  centerBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    color: colors.errorRed,
    textAlign: 'center',
  },
  limitText: {
    textAlign: 'center',
  },
});
