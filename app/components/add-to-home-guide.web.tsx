/**
 * add-to-home-guide.tsx の Web 実装（チケット27）。iPhone の Safari で見ているときだけ、
 * 「ホーム画面に追加」の手順カードを onboarding（使い方）に出す。
 * - iOS 判定は userAgent（対象は iPhone の生徒さん＝REQUIREMENTS §3.7。PC には出さない）
 * - すでにホーム画面から起動している（standalone）ときは出さない。判定は display-mode と
 *   navigator.standalone（iOS Safari 独自プロパティ）の両建て
 * - iOS Safari には beforeinstallprompt が無いので、手順は文字で見せるしかない
 * 判定値はページの寿命の間変わらないので、モジュールスコープで一度だけ読む
 */
import { StyleSheet } from 'react-native';

import { AppCard } from '@/components/app-card';
import { AppText } from '@/components/app-text';
import { spacing } from '@/constants/tokens';

const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true;

const STEPS = [
  '画面の下の共有ボタン（四角から矢印が出ている印）を押します',
  '「ホーム画面に追加」を押します（見つからないときは下のほうにあります）',
  '右上の「追加」を押します',
] as const;

export function AddToHomeGuide() {
  if (!isIos || isStandalone) {
    return null;
  }
  return (
    <AppCard shadow="rest" style={styles.card}>
      <AppText variant="cardTitle">ホーム画面においておくとべんり</AppText>
      {STEPS.map((step, index) => (
        <AppText key={step}>
          {index + 1}. {step}
        </AppText>
      ))}
      <AppText>次からはホーム画面の「ワタシアター」を押すだけでひらけます。</AppText>
      {/* standalone は Safari とログインセッションを共有しない（docs/27 実機検証）。
          初回の再ログインで驚かせないための一文 */}
      <AppText variant="caption">
        ホーム画面から最初に開いたときは、もう一度ログインが必要です。一度
        ログインすれば、次からはそのまま使えます。
      </AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
});
