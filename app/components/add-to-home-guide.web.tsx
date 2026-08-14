/**
 * add-to-home-guide.tsx の Web 実装（チケット27）。iPhone の Safari で見ているときだけ、
 * 「ホーム画面に追加」の手順カードを onboarding（つかいかた）に出す。
 * - iOS 判定は userAgent（対象は iPhone の生徒さん＝REQUIREMENTS §3.7。PC には出さない）
 * - すでにホーム画面から起動している（standalone）ときは出さない。判定は display-mode と
 *   navigator.standalone（iOS Safari 独自プロパティ）の両建て
 * - iOS Safari には beforeinstallprompt が無いので、手順は文字で見せるしかない
 * 判定値はページの寿命の間 変わらないので、モジュールスコープで一度だけ読む
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
  '画面の下の 共有ボタン（四角から 矢印が 出ている印）を おします',
  '「ホーム画面に追加」を おします（見つからないときは 下のほうに あります）',
  'みぎ上の「追加」を おします',
] as const;

export function AddToHomeGuide() {
  if (!isIos || isStandalone) {
    return null;
  }
  return (
    <AppCard shadow="rest" style={styles.card}>
      <AppText variant="cardTitle">ホーム画面に おいておくと べんり</AppText>
      {STEPS.map((step, index) => (
        <AppText key={step}>
          {index + 1}. {step}
        </AppText>
      ))}
      <AppText>つぎからは ホーム画面の「ワタシアター」を おすだけで ひらけます。</AppText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
});
