/**
 * 机の上ボードのポラロイド1枚（チケット13。DESIGN §5「質感」）。
 * - 白フチは上下左右8px・下だけ28px、角丸なし、shadow-rest、中心まわりに回転
 * - 下帯にキャプション（お題タイトル）＝Zen Maru Gothic 14px・1行省略
 * - 音声つきは写真の右下に spot-yellow のスピーカーバッジ（表示のみ。タップ再生はチケット15）
 * - props はすべてプリミティブにして React.memo を効かせる（最大55枚が1画面に載る）。
 *   位置・回転は親が px 変換して渡す：チケット14はこの外側にドラッグ用ラッパーを足すだけ、
 *   チケット15は Pressable で包むだけで、この中身は触らない想定
 */
import { Image } from 'expo-image';
import { Volume2 } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, fontSizes, shadows, spacing } from '@/constants/tokens';

/** 白フチ（px 固定。DESIGN §5） */
export const POLAROID_FRAME = { side: 8, top: 8, bottom: 28 } as const;
/** ポラロイドの高さ = 幅 + (写真が正方形のため) 上8 + 下28 − 左右16 = 幅 + 20 */
export const POLAROID_EXTRA_HEIGHT = POLAROID_FRAME.top + POLAROID_FRAME.bottom - POLAROID_FRAME.side * 2;

type BoardPolaroidProps = {
  uri: string | undefined;
  /** expo-image のディスクキャッシュキー（r2_key。署名URLのクエリは毎回変わるため） */
  cacheKey: string;
  caption: string;
  hasRecording: boolean;
  left: number;
  top: number;
  width: number;
  /** 度・時計回り（board-layout.ts の契約） */
  rotation: number;
};

export const BoardPolaroid = memo(function BoardPolaroid({
  uri,
  cacheKey,
  caption,
  hasRecording,
  left,
  top,
  width,
  rotation,
}: BoardPolaroidProps) {
  return (
    <View
      style={[
        styles.polaroid,
        { left, top, width, transform: [{ rotate: `${rotation}deg` }] },
      ]}>
      <View>
        <Image
          accessibilityLabel={hasRecording ? `「${caption}」の写真（声つき）` : `「${caption}」の写真`}
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri, cacheKey }}
          style={styles.photo}
          transition={150}
        />
        {hasRecording ? (
          <View style={styles.badge}>
            <Volume2 color={colors.stageNavy} size={14} strokeWidth={2} />
          </View>
        ) : null}
      </View>
      <View style={styles.captionBand}>
        <Text numberOfLines={1} style={styles.caption}>
          {caption}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: colors.spotYellow,
    borderRadius: 12,
    bottom: spacing.xs,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.xs,
    width: 24,
  },
  caption: {
    color: colors.stageNavy,
    fontFamily: fonts.heading,
    fontSize: fontSizes.polaroidCaption,
    paddingHorizontal: spacing.xs,
  },
  captionBand: {
    alignItems: 'center',
    height: POLAROID_FRAME.bottom,
    justifyContent: 'center',
  },
  photo: {
    aspectRatio: 1,
    backgroundColor: colors.skyBottom,
    width: '100%',
  },
  polaroid: {
    backgroundColor: colors.cardWhite,
    paddingHorizontal: POLAROID_FRAME.side,
    paddingTop: POLAROID_FRAME.top,
    position: 'absolute',
    ...shadows.rest,
  },
});
