/**
 * ギャラリー（机の上）閲覧＋ならべかえ（チケット13・14。REQUIREMENTS §3.4① / DESIGN §5・§7）。
 * 全お題の写真をポラロイドとして木目ボードにばら撒き配置する。
 * - 配置は board-layout.ts の契約どおり（board_seed で決定的・保存配置優先）
 * - 重なり順は「z 昇順に並べ替えて描画順」で表現する。zIndex はドラッグ中の1枚だけ
 *   （Android は同 elevation の兄弟なら描画順が安定して効く。影も3段規約のまま）
 * - ならべかえ（チケット14）：長押しでつまんでドラッグ。ドロップ毎に board_* を保存し、
 *   見た目は「基準位置＋offset 共有値」で動かす（詳細は draggable-polaroid.tsx）。
 *   overrides は z ソート・ボード高さ・DB 保存にだけ使い、基準 props は変えない
 * - タップ拡大＋音声（チケット15）：閲覧モードのタップで PhotoLightbox を開く。
 *   オーバーレイのアンマウント＝プレイヤー解放なので、閉じる・Android 戻るで音声は必ず止まる
 * - この画面のアクセントは木肌＋spot-yellow バッジのみ。curtainRed を持ち込まない（DESIGN §11-6）
 */
import { usePreventRemove } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Check, Hand, Undo2 } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { BackButton } from '@/components/back-button';
import { POLAROID_EXTRA_HEIGHT } from '@/components/board-polaroid';
import { DeskBoard, DeskGrain } from '@/components/desk-board';
import { DraggablePolaroid } from '@/components/draggable-polaroid';
import { PhotoLightbox } from '@/components/photo-lightbox';
import { SecondaryButton } from '@/components/secondary-button';
import { BOARD, resolveBoardPlacements, type BoardPlacement } from '@/lib/board-layout';
import { colors, spacing } from '@/constants/tokens';
import { useAuth } from '@/lib/auth-context';
import { resetBoardPlacements, saveBoardPlacement } from '@/lib/board-save';
import { useBoardPhotos } from '@/lib/use-board-photos';

export default function GalleryScreen() {
  const { width: boardWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { subject } = useAuth();
  const { items, loading, error, refetch } = useBoardPhotos();

  const [mode, setMode] = useState<'view' | 'rearrange'>('view');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // ドロップ済み（DB反映待ち・反映済み）の配置。refetch が着地したら DB が真実になるので捨てる
  const [overrides, setOverrides] = useState<Record<string, BoardPlacement>>({});
  // インクリメントで該当写真の offset を 0 に戻す（保存失敗・もとにもどす）
  const [revertSignals, setRevertSignals] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingSaves, setPendingSaves] = useState(0);
  // タップ拡大中の写真（チケット15）。id で持ち、refetch で消えたら自然に閉じる
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const boardSeed = subject?.board_seed ?? 0;
  const { placements, boardHeightFraction } = useMemo(
    () =>
      resolveBoardPlacements(
        items.map(({ photo }) => photo),
        boardSeed,
      ),
    [items, boardSeed],
  );

  // refetch 着地＝DB が真実（保存成功分は基準位置に取り込まれている）
  useEffect(() => {
    setOverrides({});
    setDraggingId(null);
  }, [items]);

  // 実効配置（z ソート・ボード高さ・次の z の計算に使う。描画位置は基準＋offset 側）
  const effective = useMemo(
    () => items.map((item, index) => overrides[item.photo.id] ?? placements[index]),
    [items, overrides, placements],
  );

  // 重なり順：z 昇順（同値は入力順＝作成順）に並べて、その順で描画する
  const stacked = useMemo(() => {
    return items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => effective[a.index].z - effective[b.index].z || a.index - b.index);
  }, [items, effective]);

  // ドロップで下へ広げた分もボードを伸ばす
  const effectiveHeightFraction = useMemo(() => {
    const halfHeight = (BOARD.POLAROID_W * BOARD.EST_ASPECT) / 2;
    return Object.values(overrides).reduce(
      (max, p) => Math.max(max, p.y + halfHeight + BOARD.BOTTOM_MARGIN),
      boardHeightFraction,
    );
  }, [overrides, boardHeightFraction]);

  const polaroidWidth = BOARD.POLAROID_W * boardWidth;
  const polaroidHeight = polaroidWidth + POLAROID_EXTRA_HEIGHT;
  const boardHeightPx = effectiveHeightFraction * boardWidth;
  const rearrange = mode === 'rearrange';

  const lightboxItem = lightboxId
    ? (items.find(({ photo }) => photo.id === lightboxId) ?? null)
    : null;

  // Android 戻る1回目はライトボックスだけ閉じる（画面を出るのは2回目）
  usePreventRemove(lightboxItem !== null, () => {
    setLightboxId(null);
  });

  const handleLift = (photoId: string) => {
    // つまめた手応え（音は出ない軽い振動）
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraggingId(photoId);
  };

  const handleDrop = (photoId: string, left: number, top: number) => {
    const index = items.findIndex(({ photo }) => photo.id === photoId);
    if (index < 0) {
      setDraggingId(null);
      return;
    }
    const current = effective[index];
    const maxZ = effective.reduce((max, p) => Math.max(max, p.z), 0);
    const placement: BoardPlacement = {
      // 契約どおり中心座標・幅正規化で保存（board-layout.ts）
      x: (left + polaroidWidth / 2) / boardWidth,
      y: (top + polaroidHeight / 2) / boardWidth,
      // 回転はドラッグで変えない（現在の実効値をそのまま書き戻す）
      rotation: current.rotation,
      // 既に最前面ならそのまま、そうでなければ最前面へ
      z: current.z === maxZ ? current.z : maxZ + 1,
    };
    // override と draggingId クリアを同一コミットにして zIndex の受け渡しに隙間を作らない
    setOverrides((prev) => ({ ...prev, [photoId]: placement }));
    setDraggingId(null);
    setPendingSaves((n) => n + 1);
    void (async () => {
      const saved = await saveBoardPlacement(photoId, placement);
      setPendingSaves((n) => n - 1);
      if (saved.ok) {
        // 電波が戻って保存できたら、前回の失敗表示は消す（出しっぱなしにしない）
        setActionError(null);
        return;
      }
      // 保存できなかった配置は見せ続けない：override を捨てて元の位置へ滑って戻す
      setActionError(saved.message ?? null);
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[photoId];
        return next;
      });
      setRevertSignals((prev) => ({ ...prev, [photoId]: (prev[photoId] ?? 0) + 1 }));
    })();
  };

  const handleReset = () => {
    Alert.alert('ならびを もとにもどしますか？', 'じぶんでならべた配置は もどせません。', [
      { text: 'やめる', style: 'cancel' },
      {
        text: 'もとにもどす',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const result = await resetBoardPlacements(items.map(({ photo }) => photo.id));
            if (!result.ok) {
              setActionError(result.message ?? null);
              return;
            }
            setActionError(null);
            // セッション中に動かした写真は refetch でも基準位置が変わらない
            // （offset が残る）ため、明示的に 0 へ帰す
            setRevertSignals((prev) => {
              const next = { ...prev };
              for (const id of Object.keys(overrides)) {
                next[id] = (next[id] ?? 0) + 1;
              }
              return next;
            });
            setOverrides({});
            void refetch();
          })();
        },
      },
    ]);
  };

  return (
    <DeskBoard>
      {/* SafeAreaView で囲まず inset を内側余白にする：木目をステータスバーの下まで敷くため */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.section }]}
        scrollEnabled={draggingId === null}>
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

          {!loading && !error && items.length > 0 ? (
            rearrange ? (
              <View style={styles.modeActions}>
                <SecondaryButton
                  icon={Check}
                  label="おわる"
                  onPress={() => {
                    setMode('view');
                    setActionError(null);
                  }}
                />
                <SecondaryButton
                  icon={Undo2}
                  label="もとにもどす"
                  onPress={handleReset}
                  disabled={pendingSaves > 0 || draggingId !== null}
                />
                <AppText variant="caption" style={styles.hint}>
                  写真を長押しすると、動かせます
                </AppText>
              </View>
            ) : (
              <SecondaryButton icon={Hand} label="ならべかえ" onPress={() => setMode('rearrange')} />
            )
          ) : null}

          {actionError ? (
            <AppCard style={styles.card}>
              <AppText style={styles.errorTitle}>{actionError}</AppText>
            </AppCard>
          ) : null}
        </View>

        {!loading && !error && items.length > 0 ? (
          <View style={{ height: boardHeightPx, width: '100%' }}>
            {stacked.map(({ item, index }) => (
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
                rearrange={rearrange}
                dragging={draggingId === item.photo.id}
                revertSignal={revertSignals[item.photo.id] ?? 0}
                onLift={handleLift}
                onDrop={handleDrop}
                onOpen={setLightboxId}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* ライトボックスは SafeArea の外＝ステータスバーまで含む全画面を覆う（curtain-overlay と同じ） */}
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
  // ボード（写真エリア）は全幅を使うため、余白はヘッダー側にだけ付ける
  // （paddingTop はステータスバー inset を足して gallery 本体で上書きする）
  header: {
    gap: spacing.xxl,
    padding: spacing.xl,
  },
  hint: {
    color: colors.cardWhite,
    textAlign: 'center',
  },
  modeActions: {
    gap: spacing.md,
  },
  title: {
    color: colors.cardWhite,
  },
});
